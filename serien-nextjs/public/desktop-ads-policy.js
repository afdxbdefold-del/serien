/* Shared by the application bundle and the standalone ad test. Fail closed. */
(function (root) {
  var mediaQuery = '(min-width: 1024px) and (hover: hover) and (pointer: fine)';

  function canLoadDesktopAds(win, nav) {
    try {
      if (!win || !nav || typeof win.matchMedia !== 'function') return false;
      if (!win.matchMedia(mediaQuery).matches) return false;
      if (nav.userAgentData && nav.userAgentData.mobile === true) return false;
      if (/Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle|PlayBook|BlackBerry|IEMobile|Opera Mini/i.test(nav.userAgent || '')) return false;
      // iPadOS can identify as a Mac, including when a mouse is attached.
      if (/Mac/i.test(nav.platform || '') && Number(nav.maxTouchPoints) > 1) return false;
      return true;
    } catch (_) {
      return false;
    }
  }

  var policy = { mediaQuery: mediaQuery, canLoadDesktopAds: canLoadDesktopAds };
  if (typeof module === 'object' && module.exports) module.exports = policy;
  else if (root) root.__serienDesktopAdsAllowed = function () {
    return canLoadDesktopAds(root, root.navigator);
  };
})(typeof window === 'undefined' ? null : window);
