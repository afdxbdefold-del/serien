"""
ads.txt reachability tests (Iteration 20)

Verifies /ads.txt on the Next.js dev server:
  - GET returns 200 + correct headers + full body
  - HEAD returns 200 + headers + Content-Length, no body
  - OPTIONS returns 204 + CORS preflight headers
  - Works with empty and various User-Agents (middleware matcher excludes .txt)
"""
import pytest
import requests

BASE_URL = "http://localhost:3000"
ADS_URL = f"{BASE_URL}/ads.txt"

EXPECTED_LINES = [
    "OWNERDOMAIN=serien.de",
    "MANAGERDOMAIN=themoneytizer.com",
    "advertising-alliance.de, 35673, DIRECT",
    "advertising-alliance.de, serien.de, DIRECT",
    "yieldlab.net, 35673, RESELLER",
]


@pytest.fixture(scope="module")
def get_response():
    # Do NOT follow redirects — /ads.txt should return 200 directly (rewrite, not redirect)
    return requests.get(ADS_URL, allow_redirects=False, timeout=15)


# ---------------- GET tests ----------------
class TestGetAdsTxt:
    def test_status_200(self, get_response):
        assert get_response.status_code == 200

    def test_content_type(self, get_response):
        assert get_response.headers.get("Content-Type", "").lower() == "text/plain; charset=utf-8"

    def test_cors_allow_origin(self, get_response):
        assert get_response.headers.get("Access-Control-Allow-Origin") == "*"

    def test_x_robots_tag(self, get_response):
        assert get_response.headers.get("X-Robots-Tag") == "all"

    def test_cache_control(self, get_response):
        cc = get_response.headers.get("Cache-Control", "")
        assert "public" in cc
        assert "max-age=86400" in cc
        assert "stale-while-revalidate=604800" in cc, f"got: {cc}"

    @pytest.mark.parametrize("line", EXPECTED_LINES)
    def test_body_contains_line(self, get_response, line):
        assert line in get_response.text, f"missing: {line!r}"


# ---------------- HEAD tests ----------------
class TestHeadAdsTxt:
    @pytest.fixture(scope="class")
    def head_response(self):
        return requests.head(ADS_URL, allow_redirects=False, timeout=15)

    def test_status_200(self, head_response):
        assert head_response.status_code == 200

    def test_no_body(self, head_response):
        # HEAD must not include a body
        assert head_response.text == "" or head_response.content == b""

    def test_cors_headers(self, head_response):
        assert head_response.headers.get("Access-Control-Allow-Origin") == "*"
        assert head_response.headers.get("X-Robots-Tag") == "all"
        cc = head_response.headers.get("Cache-Control", "")
        assert "public" in cc and "max-age=86400" in cc and "stale-while-revalidate=604800" in cc

    def test_content_length_matches_body(self, head_response, get_response):
        cl = head_response.headers.get("Content-Length")
        assert cl is not None, "Content-Length header missing on HEAD"
        expected = len(get_response.content)
        assert int(cl) == expected, f"Content-Length={cl}, actual body bytes={expected}"


# ---------------- OPTIONS preflight ----------------
class TestOptionsAdsTxt:
    @pytest.fixture(scope="class")
    def opt_response(self):
        return requests.options(ADS_URL, allow_redirects=False, timeout=15)

    def test_status_204(self, opt_response):
        assert opt_response.status_code == 204

    def test_allow_methods(self, opt_response):
        allow = opt_response.headers.get("Access-Control-Allow-Methods", "")
        # normalize spaces
        methods = {m.strip().upper() for m in allow.split(",")}
        assert methods == {"GET", "HEAD", "OPTIONS"}, f"got: {allow!r}"

    def test_allow_origin(self, opt_response):
        assert opt_response.headers.get("Access-Control-Allow-Origin") == "*"


# ---------------- User-Agent variants (middleware must skip .txt) ----------------
UA_VARIANTS = [
    ("empty", ""),
    ("curl", "curl/8.5.0"),
    ("python-requests", "python-requests/2.31.0"),
    ("googlebot", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"),
]


@pytest.mark.parametrize("label,ua", UA_VARIANTS)
def test_get_with_user_agent(label, ua):
    # requests always sets a UA if we don't override; force empty via headers dict
    session = requests.Session()
    # Wipe default UA
    session.headers.pop("User-Agent", None)
    headers = {"User-Agent": ua} if ua else {}
    # For empty UA we still need to strip requests' auto-added default
    if not ua:
        headers = {}
    r = session.get(ADS_URL, headers=headers, allow_redirects=False, timeout=15)
    assert r.status_code == 200, f"UA={label!r} got {r.status_code}"
    assert r.headers.get("Content-Type", "").lower() == "text/plain; charset=utf-8"
    # Body content sanity: OWNERDOMAIN must be first non-empty line
    first_line = r.text.splitlines()[0] if r.text else ""
    assert first_line == "OWNERDOMAIN=serien.de", f"UA={label!r} first line: {first_line!r}"
    # Cross-origin still open
    assert r.headers.get("Access-Control-Allow-Origin") == "*"
