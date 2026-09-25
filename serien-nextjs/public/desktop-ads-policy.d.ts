declare const policy: {
  mediaQuery: string;
  canLoadDesktopAds(
    win: { matchMedia?: (query: string) => { matches: boolean } } | undefined,
    nav: {
      userAgent?: string;
      platform?: string;
      maxTouchPoints?: number;
      userAgentData?: { mobile?: boolean };
    } | undefined,
  ): boolean;
};
export default policy;
