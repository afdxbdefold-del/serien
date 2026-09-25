'use client';

import { useEffect } from 'react';
import { useDesktopAds } from './DesktopOnlyAds';
import { canLoadDesktopAds } from '@/lib/desktop-ads';

// Existing CMP tag, unchanged apart from removal of its adtest bypass.
// Desktop-only is a delivery rule, not a change to consent requirements.
const CMP_BOOTSTRAP = "(function(){/* InMobi Choice. Consent Manager Tag v3.0 (for TCF 2.3) */\n(function(){var host=\"www.themoneytizer.de\";var element=document.createElement('script');var firstScript=document.getElementsByTagName('script')[0];var url='https://cmp.inmobi.com'.concat('/choice/','6Fv0cGNfc_bw8','/',host,'/choice.js?tag_version=V3');var uspTries=0;var uspTriesLimit=3;element.async=true;element.type='text/javascript';element.src=url;firstScript.parentNode.insertBefore(element,firstScript);function makeStub(){var TCF_LOCATOR_NAME='__tcfapiLocator';var queue=[];var win=window;var cmpFrame;function addFrame(){var doc=win.document;var otherCMP=!!(win.frames[TCF_LOCATOR_NAME]);if(!otherCMP){if(doc.body){var iframe=doc.createElement('iframe');iframe.style.cssText='display:none';iframe.name=TCF_LOCATOR_NAME;doc.body.appendChild(iframe);}else{setTimeout(addFrame,5);}}return !otherCMP;}function tcfAPIHandler(){var gdprApplies;var args=arguments;if(!args.length){return queue;}else if(args[0]==='setGdprApplies'){if(args.length>3&&args[2]===2&&typeof args[3]==='boolean'){gdprApplies=args[3];if(typeof args[2]==='function'){args[2]('set',true);}}}else if(args[0]==='ping'){var retr={gdprApplies:gdprApplies,cmpLoaded:false,cmpStatus:'stub'};if(typeof args[2]==='function'){args[2](retr);}}else{if(args[0]==='init'&&typeof args[3]==='object'){args[3]=Object.assign(args[3],{tag_version:'V3'});}queue.push(args);}}function postMessageEventHandler(event){var msgIsString=typeof event.data==='string';var json={};try{if(msgIsString){json=JSON.parse(event.data);}else{json=event.data;}}catch(ignore){}var payload=json.__tcfapiCall;if(payload){window.__tcfapi(payload.command,payload.version,function(retValue,success){var returnMsg={__tcfapiReturn:{returnValue:retValue,success:success,callId:payload.callId}};if(msgIsString){returnMsg=JSON.stringify(returnMsg);}if(event&&event.source&&event.source.postMessage){event.source.postMessage(returnMsg,'*');}},payload.parameter);}}while(win){try{if(win.frames[TCF_LOCATOR_NAME]){cmpFrame=win;break;}}catch(ignore){}if(win===window.top){break;}win=win.parent;}if(!cmpFrame){addFrame();win.__tcfapi=tcfAPIHandler;win.addEventListener('message',postMessageEventHandler,false);}}makeStub();var uspStubFunction=function(){var arg=arguments;if(typeof window.__uspapi!==uspStubFunction){setTimeout(function(){if(typeof window.__uspapi!=='undefined'){window.__uspapi.apply(window.__uspapi,arg);}},500);}};var checkIfUspIsReady=function(){uspTries++;if(window.__uspapi===uspStubFunction&&uspTries<uspTriesLimit){console.warn('USP is not accessible');}else{clearInterval(uspInterval);}};if(typeof window.__uspapi==='undefined'){window.__uspapi=uspStubFunction;var uspInterval=setInterval(checkIfUspIsReady,6000);}})();})();";

const FREESTAR_INIT =
  'var freestar = window.freestar = window.freestar || {}; ' +
  'freestar.queue = freestar.queue || []; ' +
  'freestar.config = freestar.config || {}; ' +
  'freestar.config.enabled_slots = []; ' +
  'freestar.initCallback = function () { (freestar.config.enabled_slots.length === 0) ? freestar.initCallbackCalled = false : freestar.newAdSlots(freestar.config.enabled_slots) };';

// Loaded SDKs cannot be unloaded by removing a script node. Never bootstrap
// them twice on a viewport transition or StrictMode effect replay.
const installed = new Set<string>();

function script(id: string, options: { src?: string; text?: string; body?: boolean; cfasync?: boolean }) {
  if (!canLoadDesktopAds() || installed.has(id) || document.getElementById(id)) return;
  const node = document.createElement('script');
  node.id = id;
  if (options.cfasync === false) node.setAttribute('data-cfasync', 'false');
  if (options.src) { node.src = options.src; node.async = true; }
  if (options.text) node.textContent = options.text;
  installed.add(id);
  (options.body ? document.body : document.head).appendChild(node);
}

/** No provider requests, stylesheets or preconnects on mobile/tablet/SSR. */
export default function DesktopAdProviders() {
  const allowed = useDesktopAds();
  useEffect(() => {
    if (!allowed || !canLoadDesktopAds()) return;
    const links: HTMLLinkElement[] = [];
    const preconnects = [
      'https://cmp.inmobi.com', 'https://a.pub.network/', 'https://b.pub.network/',
      'https://c.pub.network/', 'https://d.pub.network/', 'https://btloader.com/',
      'https://api.btloader.com/',
    ];
    for (const href of preconnects) {
      if (!canLoadDesktopAds()) break;
      const link = document.createElement('link');
      link.rel = 'preconnect'; link.href = href; link.crossOrigin = '';
      document.head.appendChild(link); links.push(link);
    }
    if (!canLoadDesktopAds()) { links.forEach((link) => link.remove()); return; }
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://a.pub.network/serien-de/cls.css';
    document.head.appendChild(css); links.push(css);

    // Install the existing consent stub before any advertising SDK.
    script('desktop-inmobi-choice', { text: CMP_BOOTSTRAP });
    script('ezstandalone-init', { text: 'window.ezstandalone = window.ezstandalone || {}; window.ezstandalone.cmd = window.ezstandalone.cmd || [];' });
    script('ezoic-sa', { src: 'https://www.ezojs.com/ezoic/sa.min.js' });
    script('ezoic-analytics', { src: 'https://ezoicanalytics.com/analytics.js' });
    script('freestar-init', { text: FREESTAR_INIT, cfasync: false });
    script('freestar-pubfig', { src: 'https://a.pub.network/serien-de/pubfig.min.js', cfasync: false });
    script('primis-slider', { src: 'https://live.primis.tech/live/liveView.php?s=122209', body: true });

    return () => { links.forEach((link) => link.remove()); };
  }, [allowed]);
  return null;
}
