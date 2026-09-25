import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import DesktopAdProviders from '../../components/DesktopAdProviders';
import DesktopGlobalTags from '../../components/DesktopGlobalTags';
import GlobalDesktopAds from '../../components/GlobalDesktopAds';
import ClientAdSlot from '../../components/ClientAdSlot';
import InfeedAdCard from '../../components/InfeedAdCard';
import MobileTopAd from '../../components/MobileTopAd';
import { ThemePageAdTop, ThemePageAdBottom } from '../../components/ThemePageAds';
import type { GlobalTag } from '../../lib/global-tags';

const globalTags: GlobalTag[] = [{
  id: 'fixture-global', name: 'Fixture global ad', placement: 'body-end', hideFromBots: false, sortOrder: 0,
  html: '<img data-fixture-global-ad src="https://ads.invalid/global-pixel.gif">' +
    '<iframe data-fixture-global-ad src="https://ads.invalid/global-frame"></iframe>' +
    '<script src="https://ads.invalid/global.js"></script>',
}];

// Exercise React's actual server snapshot even with desktop browser globals present.
document.documentElement.dataset.adsSsr = renderToString(<>
  <DesktopAdProviders />
  <GlobalDesktopAds />
  <DesktopGlobalTags placement="body-end" tags={globalTags} />
</>);

function Fixture() {
  useEffect(() => { document.documentElement.dataset.fixtureMounted = 'true'; }, []);
  return <>
    <p id="editorial-content">Editorial content remains available.</p>
    <DesktopAdProviders />
    <GlobalDesktopAds />
    <ThemePageAdTop />
    <ThemePageAdBottom />
    <ClientAdSlot position="article_bottom" />
    <InfeedAdCard />
    <MobileTopAd />
    <DesktopGlobalTags placement="body-end" tags={globalTags} />
  </>;
}

createRoot(document.getElementById('fixture-root')!).render(<Fixture />);
