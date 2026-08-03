"""Tests for /ads_tm.php (TheMoneytizer live-merge ads.txt route).

Verifies rewrite (/ads_tm.php -> /api/ads-tm), TMN upstream merge,
dedup, headers, CORS, HEAD/OPTIONS methods, and middleware bypass
for .php extension across different User-Agents.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("SERIEN_BASE_URL", "http://localhost:3000").rstrip("/")
URL = f"{BASE_URL}/ads_tm.php"


@pytest.fixture(scope="module")
def get_response():
    return requests.get(URL, timeout=30)


class TestAdsTmBasics:
    def test_status_200(self, get_response):
        assert get_response.status_code == 200

    def test_content_type(self, get_response):
        assert get_response.headers.get("content-type") == "text/plain; charset=utf-8"

    def test_starts_with_ownerdomain_managerdomain(self, get_response):
        lines = get_response.text.splitlines()
        assert lines[0] == "OWNERDOMAIN=serien.de"
        assert lines[1] == "MANAGERDOMAIN=themoneytizer.com"

    def test_no_mytickets_ownerdomain(self, get_response):
        assert "OWNERDOMAIN=mytickets.de" not in get_response.text


class TestAdsTmContent:
    def test_contains_tm_direct(self, get_response):
        assert "themoneytizer.com, 131755, DIRECT" in get_response.text

    def test_contains_aa_35673(self, get_response):
        assert "advertising-alliance.de, 35673, DIRECT" in get_response.text

    def test_contains_aa_serien(self, get_response):
        assert "advertising-alliance.de, serien.de, DIRECT" in get_response.text

    def test_contains_yieldlab_reseller(self, get_response):
        assert "yieldlab.net, 35673, RESELLER" in get_response.text

    def test_tm_direct_no_duplicate(self, get_response):
        count = get_response.text.count("themoneytizer.com, 131755, DIRECT")
        assert count == 1, f"Expected exactly 1 occurrence, got {count}"


class TestAdsTmHeaders:
    def test_cache_control(self, get_response):
        cc = get_response.headers.get("cache-control", "")
        assert "public" in cc
        assert "max-age=300" in cc
        assert "stale-while-revalidate=86400" in cc

    def test_cors_origin(self, get_response):
        assert get_response.headers.get("access-control-allow-origin") == "*"

    def test_cors_methods(self, get_response):
        methods = get_response.headers.get("access-control-allow-methods", "")
        for m in ("GET", "HEAD", "OPTIONS"):
            assert m in methods

    def test_x_robots_tag(self, get_response):
        assert get_response.headers.get("x-robots-tag") == "all"


class TestAdsTmHead:
    def test_head_status_and_body(self, get_response):
        r = requests.head(URL, timeout=30)
        assert r.status_code == 200
        assert r.content == b""
        cl = int(r.headers.get("content-length", "0"))
        assert cl == len(get_response.content), (
            f"HEAD content-length {cl} != GET body length {len(get_response.content)}"
        )


class TestAdsTmOptions:
    def test_options(self):
        r = requests.options(URL, timeout=30)
        assert r.status_code == 204
        assert r.headers.get("access-control-allow-origin") == "*"
        methods = r.headers.get("access-control-allow-methods", "")
        for m in ("GET", "HEAD", "OPTIONS"):
            assert m in methods


class TestAdsTmUserAgents:
    @pytest.mark.parametrize("ua", [
        None,
        "curl/8.5.0",
        "python-requests/2.31.0",
    ])
    def test_various_user_agents(self, ua):
        headers = {}
        if ua is None:
            # requests always adds a UA; strip it
            s = requests.Session()
            s.headers.pop("User-Agent", None)
            r = s.get(URL, headers={"User-Agent": ""}, timeout=30)
        else:
            r = requests.get(URL, headers={"User-Agent": ua}, timeout=30)
        assert r.status_code == 200, f"UA={ua!r} → {r.status_code}"
        assert r.text.startswith("OWNERDOMAIN=serien.de")
