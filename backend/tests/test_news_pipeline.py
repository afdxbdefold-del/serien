"""
Regression tests for serien.de news pipeline + public pages.

Covers:
  * Module: supervisor pipeline-scheduler health (tsx binary durability)
  * Module: news freshness (DB-backed, via public pages)
  * Module: public page smoke (/, /news, article detail)

NOTE: These tests are strictly READ-ONLY. They never invoke
scripts/news-scheduler.ts or any LLM/OpenAI call (real cost on user key).
"""

import os
import re
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests

BASE_URL = os.environ.get("PREVIEW_URL") or os.environ.get("preview_endpoint")
if not BASE_URL:
    raise RuntimeError("preview_endpoint / PREVIEW_URL missing from environment")
BASE_URL = BASE_URL.rstrip("/")

# Middleware hard-blocks HeadlessChrome / default curl UAs with HTTP 204.
CHROME_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

SCHEDULER_LOG = Path("/var/log/supervisor/pipeline-scheduler.log")
SUPERVISOR_CONF = Path("/etc/supervisor/conf.d/supervisord.conf")
PROJECT = Path("/app/serien-nextjs")


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"User-Agent": CHROME_UA})
    return s


def _get(client, path, retries=2):
    """GET with one retry to absorb Neon cold-start blips."""
    last = None
    for _ in range(retries):
        try:
            r = client.get(f"{BASE_URL}{path}", timeout=60)
            if r.status_code == 200:
                return r
            last = r
        except requests.RequestException as e:  # noqa: PERF203
            last = e
    if isinstance(last, Exception):
        pytest.fail(f"GET {path} raised: {last}")
    return last


# ---------------------------------------------------------------- scheduler
class TestPipelineSchedulerHealth:
    """tsx durability fix: process must run, not crash-loop."""

    def test_scheduler_process_is_running(self):
        out = subprocess.run(
            ["supervisorctl", "status", "pipeline-scheduler"],
            capture_output=True, text=True,
        ).stdout
        assert "RUNNING" in out, f"pipeline-scheduler not RUNNING: {out.strip()}"
        assert "FATAL" not in out and "BACKOFF" not in out, out.strip()

    def test_supervisor_uses_local_tsx_binary(self):
        conf = SUPERVISOR_CONF.read_text(encoding="utf-8")
        assert "node_modules/.bin/tsx" in conf, \
            "pipeline-scheduler must use the project-local tsx binary, not global npx"

    def test_tsx_is_a_project_devdependency(self):
        pkg = (PROJECT / "package.json").read_text(encoding="utf-8")
        assert '"tsx"' in pkg, "tsx missing from package.json (won't survive pod restart)"
        assert (PROJECT / "node_modules/.bin/tsx").exists(), "node_modules/.bin/tsx missing"

    def test_no_recent_tsx_not_found_crash(self):
        """
        Log AFTER the most recent successful scheduler boot must be free of the
        crash-loop signature. (Historical 'tsx: not found' lines from before the
        fix legitimately remain earlier in the same log file.)
        """
        log = SCHEDULER_LOG.read_text(encoding="utf-8", errors="ignore")
        marker = "NEWS AUTO-SCHEDULER STARTED"
        assert marker in log, "scheduler never booted successfully"
        since_boot = log[log.rindex(marker):]
        assert "tsx: not found" not in since_boot, \
            "pipeline-scheduler is still crash-looping with 'tsx: not found'"

    def test_scheduler_completed_a_run(self):
        """A run since the last boot either finished or is actively processing."""
        log = SCHEDULER_LOG.read_text(encoding="utf-8", errors="ignore")
        marker = "NEWS AUTO-SCHEDULER STARTED"
        assert marker in log, "scheduler never booted successfully"
        since_boot = log[log.rindex(marker):]
        assert ("Import complete" in since_boot) or ("PIPELINE V2" in since_boot), \
            "no scheduler run (finished or in-progress) found since the last boot"

    def test_scheduler_actually_published_since_boot(self):
        """Regression for the dead-end-source bug: runs must yield real publishes."""
        log = SCHEDULER_LOG.read_text(encoding="utf-8", errors="ignore")
        marker = "NEWS AUTO-SCHEDULER STARTED"
        assert marker in log, "scheduler never booted successfully"
        since_boot = log[log.rindex(marker):]
        assert "Status: PUBLISHED" in since_boot, \
            "scheduler processed articles but published none since last boot"


# ------------------------------------------------- pipeline config sanity
class TestPipelineSourceConfig:
    """The scheduler's only source must not be blocked by pipeline-v2."""

    def test_scheduler_source_is_not_in_weak_hosts(self):
        raw = (PROJECT / "scripts/news-scheduler.ts").read_text(encoding="utf-8")
        pipeline = (PROJECT / "scripts/pipeline-v2.ts").read_text(encoding="utf-8")

        # Strip block + line comments so documentation of the old bug does not
        # count as a real call site.
        code = re.sub(r"/\*.*?\*/", "", raw, flags=re.S)
        code = re.sub(r"//.*", "", code)

        uses_screenrant = "processScreenrantNews(" in code
        weak_block = re.search(r"WEAK_HOSTS\s*=\s*\[(.*?)\]", pipeline, re.S)
        assert weak_block, "WEAK_HOSTS list not found in pipeline-v2.ts"
        screenrant_blocked = "screenrant.com" in weak_block.group(1)

        assert not (uses_screenrant and screenrant_blocked), (
            "DEAD-END PIPELINE: news-scheduler.ts scrapes ONLY screenrant.com, but "
            "pipeline-v2.ts hard-blocks screenrant.com via WEAK_HOSTS. Every scheduled "
            "run therefore publishes 0 articles while reporting 'Processed: N / SUCCESS'."
        )
        assert "processAllNews(" in code, \
            "news-scheduler.ts must call processAllNews() (multi-source, non-blocked)"


# ---------------------------------------------------------------- freshness
class TestNewsFreshness:
    def test_news_page_has_a_recent_article(self, client):
        r = _get(client, "/news")
        assert r.status_code == 200

        months = {
            "Jan": 1, "Feb": 2, "Mär": 3, "Apr": 4, "Mai": 5, "Jun": 6,
            "Jul": 7, "Aug": 8, "Sep": 9, "Okt": 10, "Nov": 11, "Dez": 12,
        }
        found = re.findall(
            r"(\d{1,2})\.\s*(Jan|Feb|Mär|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)[a-zä]*\.?\s*(\d{4})",
            r.text,
        )
        assert found, "no publish dates rendered on /news"

        dates = [datetime(int(y), months[m], int(d), tzinfo=timezone.utc)
                 for d, m, y in found]
        newest = max(dates)
        age = datetime.now(timezone.utc) - newest
        assert age <= timedelta(days=3), (
            f"Newest article on /news is {age.days} days old ({newest.date()}). "
            "Automated news publishing is not producing fresh articles."
        )


# ------------------------------------------------------------ page smoke
class TestPublicPages:
    def test_homepage_loads(self, client):
        r = _get(client, "/")
        assert r.status_code == 200
        assert len(r.text) > 50000
        assert "serien.de" in r.text.lower()

    def test_news_page_loads_and_lists_articles(self, client):
        r = _get(client, "/news")
        assert r.status_code == 200
        # Articles live at root-level slugs, not /news/<slug>.
        slugs = {
            h for h in re.findall(r'href="(/[a-z0-9][a-z0-9-]{24,})"', r.text)
            if not h.startswith("/news/")
        }
        assert len(slugs) >= 5, f"expected >=5 article links on /news, got {len(slugs)}"

    def test_article_detail_page_renders(self, client):
        listing = _get(client, "/news")
        slugs = [
            h for h in re.findall(r'href="(/[a-z0-9][a-z0-9-]{24,})"', listing.text)
            if not h.startswith("/news/")
        ]
        assert slugs, "no article slug discovered on /news"

        r = _get(client, slugs[0])
        assert r.status_code == 200, f"article {slugs[0]} returned {r.status_code}"
        assert "<h1" in r.text
        assert len(r.text) > 30000, "article page looks empty"

    def test_middleware_blocks_headless_ua(self):
        """Guardrail: confirms the 204 bot-block still behaves as designed."""
        r = requests.get(
            f"{BASE_URL}/news",
            headers={"User-Agent": "Mozilla/5.0 HeadlessChrome/126.0.0.0"},
            timeout=60,
        )
        assert r.status_code == 204, f"expected 204 for HeadlessChrome, got {r.status_code}"
