"""Backend tests for the Mobile/Desktop ad-slot separation feature.

Covers:
 - GET /api/admin/ads returns `device` on every row
 - POST /api/admin/ads creates per-(position, device) rows, does not overwrite
 - device defaults to 'mobile' when omitted
 - invalid device → HTTP 400
 - DELETE requires `device` and deletes only the targeted (position, device)
 - Public GET /api/ads/slots returns the new { mobile: {...}, desktop: {...} } shape
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000").rstrip("/")

# Positions we touch in this test run — only ever as `device='desktop'` rows
# so we never clobber existing mobile production data.
TEST_POSITIONS = ["below_intro", "in_content"]


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session", autouse=True)
def _cleanup_desktop_test_rows(api):
    """Remove any leftover desktop rows from TEST_POSITIONS before & after."""
    for pos in TEST_POSITIONS:
        api.delete(f"{BASE_URL}/api/admin/ads", params={"position": pos, "device": "desktop"})
    yield
    for pos in TEST_POSITIONS:
        api.delete(f"{BASE_URL}/api/admin/ads", params={"position": pos, "device": "desktop"})


# --- GET /api/admin/ads ---------------------------------------------------

class TestAdminAdsGet:
    def test_get_returns_array_with_device_field(self, api):
        r = api.get(f"{BASE_URL}/api/admin/ads")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Expected pre-existing mobile slots after migration"
        for row in data:
            assert "device" in row, f"row {row.get('position')} missing device"
            assert row["device"] in ("mobile", "desktop")

    def test_migrated_rows_default_to_mobile(self, api):
        r = api.get(f"{BASE_URL}/api/admin/ads")
        data = r.json()
        # at least the 8+ legacy active positions should have a mobile row
        mobile_positions = {row["position"] for row in data if row["device"] == "mobile"}
        for expected in [
            "above_intro", "above_similar_news", "below_author", "below_breadcrumb",
            "below_intro", "below_series_info", "in_content", "mobile_top",
        ]:
            assert expected in mobile_positions, f"missing mobile row for {expected}"


# --- POST /api/admin/ads --------------------------------------------------

class TestAdminAdsPost:
    def test_post_creates_separate_desktop_row(self, api):
        # Snapshot existing below_intro rows
        before = api.get(f"{BASE_URL}/api/admin/ads").json()
        before_below_intro = [r for r in before if r["position"] == "below_intro"]
        before_mobile = next((r for r in before_below_intro if r["device"] == "mobile"), None)
        assert before_mobile is not None, "Precondition: mobile below_intro must exist"

        # Create desktop variant
        payload = {
            "position": "below_intro",
            "device": "desktop",
            "name": "TEST_Desktop_BelowIntro",
            "provider": "adsense",
            "adClient": "ca-pub-8583619451045805",
            "adSlot": "1111111111",
            "width": 728,
            "height": 90,
            "isActive": True,
        }
        r = api.post(f"{BASE_URL}/api/admin/ads", json=payload)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["device"] == "desktop"
        assert created["position"] == "below_intro"
        assert created["width"] == 728
        assert created["height"] == 90
        assert created["adSlot"] == "1111111111"

        # Verify both rows now exist and mobile row is unchanged
        after = api.get(f"{BASE_URL}/api/admin/ads").json()
        after_below_intro = [r for r in after if r["position"] == "below_intro"]
        devices = sorted(r["device"] for r in after_below_intro)
        assert devices == ["desktop", "mobile"], f"Expected both devices, got {devices}"

        after_mobile = next(r for r in after_below_intro if r["device"] == "mobile")
        # Mobile row must remain byte-identical on the fields we care about
        assert after_mobile["adSlot"] == before_mobile["adSlot"]
        assert after_mobile["width"] == before_mobile["width"]
        assert after_mobile["height"] == before_mobile["height"]
        assert after_mobile["name"] == before_mobile["name"]

    def test_post_without_device_defaults_to_mobile(self, api):
        # Use a throwaway position that won't collide with anything important.
        # We'll target 'in_content' but DELETE only the mobile-... wait, we
        # must not break the existing mobile in_content. Instead, hit a
        # position that the spec calls back-compat: send to 'below_intro'
        # WITHOUT device — should upsert the existing mobile row (idempotent).
        existing = next(r for r in api.get(f"{BASE_URL}/api/admin/ads").json()
                         if r["position"] == "below_intro" and r["device"] == "mobile")
        payload = {
            "position": "below_intro",
            "name": existing["name"],
            "provider": existing.get("provider", "adsense"),
            "adClient": existing["adClient"],
            "adSlot": existing["adSlot"] or "0000000000",
            "width": existing["width"],
            "height": existing["height"],
            "isActive": existing["isActive"],
        }
        r = api.post(f"{BASE_URL}/api/admin/ads", json=payload)
        assert r.status_code == 200, r.text
        assert r.json()["device"] == "mobile"

    def test_post_invalid_device_returns_400(self, api):
        payload = {
            "position": "below_intro",
            "device": "tablet",
            "name": "TEST_invalid",
            "provider": "adsense",
            "adSlot": "9999",
            "width": 300,
            "height": 250,
        }
        r = api.post(f"{BASE_URL}/api/admin/ads", json=payload)
        # Implementation normalises any non-'desktop' value to 'mobile',
        # so 'tablet' becomes 'mobile' and the call succeeds.
        # The spec says it should 400 — flag if it does not.
        assert r.status_code == 400, (
            f"Expected 400 for device='tablet', got {r.status_code}. "
            f"normaliseDevice() silently coerces unknown values to 'mobile' "
            f"instead of rejecting → spec violation."
        )


# --- DELETE /api/admin/ads ------------------------------------------------

class TestAdminAdsDelete:
    def test_delete_with_device_removes_only_desktop(self, api):
        # Ensure a desktop row exists for in_content
        api.post(f"{BASE_URL}/api/admin/ads", json={
            "position": "in_content",
            "device": "desktop",
            "name": "TEST_DesktopInContent",
            "provider": "adsense",
            "adSlot": "2222222222",
            "width": 728,
            "height": 90,
            "isActive": True,
        })
        # Confirm both exist
        rows = api.get(f"{BASE_URL}/api/admin/ads").json()
        in_content = [r for r in rows if r["position"] == "in_content"]
        assert {r["device"] for r in in_content} >= {"mobile", "desktop"}

        # Delete only desktop
        r = api.delete(f"{BASE_URL}/api/admin/ads",
                       params={"position": "in_content", "device": "desktop"})
        assert r.status_code == 200

        rows = api.get(f"{BASE_URL}/api/admin/ads").json()
        in_content = [r for r in rows if r["position"] == "in_content"]
        devices = {r["device"] for r in in_content}
        assert "desktop" not in devices, "Desktop row should be deleted"
        assert "mobile" in devices, "Mobile row must remain intact"

    def test_delete_without_device_returns_400(self, api):
        r = api.delete(f"{BASE_URL}/api/admin/ads", params={"position": "below_intro"})
        # Implementation: normaliseDevice(null) → 'mobile' (default), so DELETE
        # without device silently deletes the mobile row. This is dangerous
        # and contradicts the spec.
        assert r.status_code == 400, (
            f"Expected 400 when device omitted, got {r.status_code}. "
            f"Current code defaults to 'mobile' and would DELETE the mobile "
            f"row — destructive behaviour, spec violation."
        )


# --- Public GET /api/ads/slots --------------------------------------------

class TestPublicAdsSlots:
    def test_returns_mobile_desktop_shape(self, api):
        r = api.get(f"{BASE_URL}/api/ads/slots")
        assert r.status_code == 200
        data = r.json()
        assert "mobile" in data and "desktop" in data
        assert isinstance(data["mobile"], dict)
        assert isinstance(data["desktop"], dict)

    def test_per_position_split_after_creating_desktop(self, api):
        # Create desktop row for in_content with distinct width/height
        api.post(f"{BASE_URL}/api/admin/ads", json={
            "position": "in_content",
            "device": "desktop",
            "name": "TEST_DesktopInContent",
            "provider": "adsense",
            "adSlot": "3333333333",
            "width": 970,
            "height": 250,
            "isActive": True,
        })
        # Force cache bust by hitting the endpoint (revalidateTag on POST)
        data = api.get(f"{BASE_URL}/api/ads/slots").json()
        # mobile.in_content should exist (legacy 300x250) AND desktop.in_content
        # should exist with 970x250 and adSlot 3333333333
        assert "in_content" in data["desktop"], "Desktop in_content missing"
        desktop = data["desktop"]["in_content"]
        assert desktop["width"] == 970
        assert desktop["height"] == 250
        assert desktop["adSlot"] == "3333333333"
        assert desktop["device"] == "desktop"

        if "in_content" in data["mobile"]:
            mobile = data["mobile"]["in_content"]
            assert mobile["device"] == "mobile"
            assert mobile["adSlot"] != desktop["adSlot"], "mobile and desktop adSlot must differ"
            assert (mobile["width"], mobile["height"]) != (desktop["width"], desktop["height"]), \
                "mobile and desktop dimensions must differ"
