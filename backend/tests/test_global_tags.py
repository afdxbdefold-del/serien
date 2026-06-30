"""
Integration tests for the Global Tags feature.

Coverage:
- CRUD via /api/admin/global-tags (GET, POST, DELETE)
- Article page injection (Chrome UA): marker present
- Bot filter: Googlebot UA does NOT see hideFromBots tag
- Bot filter off: Googlebot UA DOES see tag when hideFromBots=false
- Non-article pages (homepage, /neue-serien, /serie/<slug>, /admin/login)
  must NOT inject the marker
- Placement order: head < body-start < body-end
- sortOrder within same placement
- Cleanup after run

Local dev server: http://localhost:3000 (Next.js ssr supervisor process).
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("LOCAL_NEXT_URL", "http://localhost:3000").rstrip("/")
API = f"{BASE_URL}/api/admin/global-tags"

CHROME_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
GOOGLEBOT_UA = (
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
)

# A known published article slug. The dev server uses real DB content.
# Use a slug we already verified renders 200.
ARTICLE_SLUG = "sheridan-rechnet-mit-kritikern-und-studios-ab"

MARKER_PREFIX = "TEST-GTAG-MARKER"  # uniquely identify our test tags

created_ids: list[str] = []


def _post(payload: dict) -> dict:
    r = requests.post(API, json=payload, timeout=15)
    assert r.status_code == 200, f"POST failed {r.status_code} {r.text}"
    data = r.json()
    if "id" in data and data["id"] not in created_ids:
        created_ids.append(data["id"])
    return data


def _delete(tag_id: str) -> int:
    return requests.delete(f"{API}?id={tag_id}", timeout=15).status_code


def _fetch(path: str, ua: str) -> tuple[int, str]:
    r = requests.get(
        f"{BASE_URL}{path}", headers={"User-Agent": ua}, timeout=30, allow_redirects=True
    )
    return r.status_code, r.text


@pytest.fixture(scope="session", autouse=True)
def cleanup_all():
    """Pre-clean any leftover TEST markers then cleanup at end."""
    try:
        existing = requests.get(API, timeout=10).json()
        for t in existing:
            if MARKER_PREFIX in t.get("html", "") or t.get("name", "").startswith("TEST_"):
                _delete(t["id"])
    except Exception:
        pass
    yield
    # Final cleanup
    try:
        existing = requests.get(API, timeout=10).json()
        for t in existing:
            if (
                MARKER_PREFIX in t.get("html", "")
                or t.get("name", "").startswith("TEST_")
                or t["id"] in created_ids
            ):
                _delete(t["id"])
    except Exception:
        pass


# ---------------------------------------------------------------- CRUD


def test_get_endpoint_works():
    r = requests.get(API, timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_tag():
    data = _post(
        {
            "name": "TEST_basic",
            "html": f"<!--{MARKER_PREFIX}-BASIC-->",
            "placement": "body-end",
            "isActive": True,
            "hideFromBots": True,
            "sortOrder": 0,
        }
    )
    assert data["name"] == "TEST_basic"
    assert data["placement"] == "body-end"
    assert data["isActive"] is True

    # Verify persistence
    listing = requests.get(API, timeout=10).json()
    assert any(t["id"] == data["id"] for t in listing)


def test_update_tag_sortorder_persists():
    create = _post(
        {
            "name": "TEST_update",
            "html": f"<!--{MARKER_PREFIX}-UPDATE-->",
            "placement": "body-end",
            "isActive": True,
            "hideFromBots": True,
            "sortOrder": 1,
        }
    )
    upd = _post({**create, "sortOrder": 99})
    assert upd["sortOrder"] == 99
    listing = requests.get(API, timeout=10).json()
    found = next((t for t in listing if t["id"] == create["id"]), None)
    assert found and found["sortOrder"] == 99


def test_delete_tag():
    create = _post(
        {
            "name": "TEST_delete",
            "html": f"<!--{MARKER_PREFIX}-DEL-->",
            "placement": "body-end",
            "isActive": True,
            "hideFromBots": True,
            "sortOrder": 0,
        }
    )
    assert _delete(create["id"]) == 200
    listing = requests.get(API, timeout=10).json()
    assert not any(t["id"] == create["id"] for t in listing)


def test_post_validation_missing_name():
    r = requests.post(API, json={"html": "<x/>"}, timeout=10)
    assert r.status_code == 400


def test_post_validation_invalid_placement():
    r = requests.post(
        API,
        json={"name": "x", "html": "<x/>", "placement": "footer"},
        timeout=10,
    )
    assert r.status_code == 400


# ------------------------------------------------- Article integration


@pytest.fixture
def chrome_marker_tag():
    """Active tag at body-start, visible to humans only."""
    data = _post(
        {
            "name": "TEST_chrome_marker",
            "html": f"<!--{MARKER_PREFIX}-CHROME-->",
            "placement": "body-start",
            "isActive": True,
            "hideFromBots": True,
            "sortOrder": 0,
        }
    )
    time.sleep(1.5)  # let unstable_cache settle (revalidateTag invalidates)
    yield data
    _delete(data["id"])


def test_article_chrome_sees_marker(chrome_marker_tag):
    status, html = _fetch(f"/{ARTICLE_SLUG}", CHROME_UA)
    assert status == 200, f"article slug not reachable, got {status}"
    assert f"<!--{MARKER_PREFIX}-CHROME-->" in html, "Marker missing from Chrome HTML"
    assert 'data-global-tag="TEST_chrome_marker"' in html, "Wrapper attr missing"


def test_article_googlebot_blocked(chrome_marker_tag):
    status, html = _fetch(f"/{ARTICLE_SLUG}", GOOGLEBOT_UA)
    assert status == 200
    assert (
        f"<!--{MARKER_PREFIX}-CHROME-->" not in html
    ), "Bot should NOT see hideFromBots tag"


def test_bot_sees_when_hide_off():
    data = _post(
        {
            "name": "TEST_bot_visible",
            "html": f"<!--{MARKER_PREFIX}-BOTVIS-->",
            "placement": "body-start",
            "isActive": True,
            "hideFromBots": False,
            "sortOrder": 0,
        }
    )
    time.sleep(1.5)
    try:
        status, html = _fetch(f"/{ARTICLE_SLUG}", GOOGLEBOT_UA)
        assert status == 200
        assert (
            f"<!--{MARKER_PREFIX}-BOTVIS-->" in html
        ), "Bot should see tag when hideFromBots=false"
    finally:
        _delete(data["id"])


# ---------------------------------------------- Non-article pages


@pytest.fixture
def non_article_tag():
    data = _post(
        {
            "name": "TEST_nonarticle",
            "html": f"<!--{MARKER_PREFIX}-NONART-->",
            "placement": "body-start",
            "isActive": True,
            "hideFromBots": False,  # so Chrome AND bots would see if injected
            "sortOrder": 0,
        }
    )
    time.sleep(1.5)
    yield data
    _delete(data["id"])


@pytest.mark.parametrize(
    "path",
    ["/", "/neue-serien", "/admin/login"],
)
def test_non_article_pages_no_marker(non_article_tag, path):
    status, html = _fetch(path, CHROME_UA)
    # Pages may 404 or 200; only assert marker absent if reachable
    if status >= 500:
        pytest.skip(f"{path} returned {status}")
    assert (
        f"<!--{MARKER_PREFIX}-NONART-->" not in html
    ), f"Marker leaked into non-article page {path}"


def test_serie_page_no_marker(non_article_tag):
    """Find any series slug and ensure no marker injection."""
    # Try a couple of common series paths
    candidates = ["/serie/the-bear", "/serie/breaking-bad", "/serie/stranger-things"]
    hit = None
    for c in candidates:
        s, h = _fetch(c, CHROME_UA)
        if s == 200:
            hit = (c, h)
            break
    if not hit:
        pytest.skip("no series page reachable on dev server")
    _, html = hit
    assert f"<!--{MARKER_PREFIX}-NONART-->" not in html


# ------------------------------------------------- Placement order


def test_placement_order_and_sort():
    head = _post(
        {
            "name": "TEST_head",
            "html": f"<!--{MARKER_PREFIX}-HEAD-->",
            "placement": "head",
            "isActive": True,
            "hideFromBots": False,
            "sortOrder": 0,
        }
    )
    bstart = _post(
        {
            "name": "TEST_bstart",
            "html": f"<!--{MARKER_PREFIX}-BSTART-->",
            "placement": "body-start",
            "isActive": True,
            "hideFromBots": False,
            "sortOrder": 0,
        }
    )
    bend1 = _post(
        {
            "name": "TEST_bend1",
            "html": f"<!--{MARKER_PREFIX}-BEND1-->",
            "placement": "body-end",
            "isActive": True,
            "hideFromBots": False,
            "sortOrder": 1,
        }
    )
    bend2 = _post(
        {
            "name": "TEST_bend2",
            "html": f"<!--{MARKER_PREFIX}-BEND2-->",
            "placement": "body-end",
            "isActive": True,
            "hideFromBots": False,
            "sortOrder": 2,
        }
    )
    time.sleep(2)
    try:
        status, html = _fetch(f"/{ARTICLE_SLUG}", CHROME_UA)
        assert status == 200

        pos_head = html.find(f"<!--{MARKER_PREFIX}-HEAD-->")
        pos_bstart = html.find(f"<!--{MARKER_PREFIX}-BSTART-->")
        pos_bend1 = html.find(f"<!--{MARKER_PREFIX}-BEND1-->")
        pos_bend2 = html.find(f"<!--{MARKER_PREFIX}-BEND2-->")

        # Head and body-start must exist and head before body-start
        assert pos_head >= 0, "HEAD marker missing"
        assert pos_bstart >= 0, "BODY-START marker missing"
        assert pos_head < pos_bstart, "head must come before body-start"

        # Body-end is REQUIRED by PRD but currently not injected in page.tsx.
        # Capture this failure clearly.
        assert pos_bend1 >= 0, (
            "BODY-END marker missing — <GlobalTags placement='body-end'/> is "
            "NOT injected in app/[slug]/page.tsx"
        )
        assert pos_bend2 >= 0
        assert pos_bend1 < pos_bend2, "sortOrder 1 must precede sortOrder 2"
        assert pos_bstart < pos_bend1, "body-start must precede body-end"
    finally:
        for t in (head, bstart, bend1, bend2):
            _delete(t["id"])
