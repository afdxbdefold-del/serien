import { NextResponse } from 'next/server';

/**
 * Server-seitige Sellers.json-Chain-Verifizierung für /adtest-direct.
 * Läuft server-side statt im Browser, weil advertising-alliance.de/sellers.json
 * keine Access-Control-Allow-Origin-Header setzt und Client-Fetches per CORS
 * blockt (verifiziert 2026-03).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPPLY_ID = '35673';

type Seller = { seller_id?: string; domain?: string; seller_type?: string; name?: string };
type ChainCheck = { label: string; pass: boolean | null; detail: string };

async function fetchSellers(url: string): Promise<Seller[] | null> {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.sellers ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const results: ChainCheck[] = [];

  const aaSellers = await fetchSellers('https://advertising-alliance.de/sellers.json');
  if (aaSellers === null) {
    results.push({ label: 'advertising-alliance.de/sellers.json', pass: null, detail: 'Fetch fehlgeschlagen oder Timeout' });
  } else {
    const aaMatch = aaSellers.find((s) => s.seller_id === 'serien.de');
    results.push({
      label: 'ads.txt: advertising-alliance.de, serien.de, DIRECT',
      pass: !!aaMatch && aaMatch.domain === 'serien.de',
      detail: aaMatch
        ? `✅ AA sellers.json listet seller_id="serien.de" (domain=${aaMatch.domain}, type=${aaMatch.seller_type})`
        : '❌ AA sellers.json hat KEINEN seller_id="serien.de"',
    });
    const aa35673 = aaSellers.find((s) => s.seller_id === SUPPLY_ID);
    results.push({
      label: 'Alte Zeile: advertising-alliance.de, 35673, DIRECT (ENTFERNT)',
      pass: !aa35673,
      detail: aa35673
        ? '⚠️ Unerwartet: AA listet jetzt doch seller_id="35673" — Zeile könnte wieder rein'
        : '✅ Bestätigt ungültig — AA sellers.json kennt seller_id="35673" nicht. Zeile korrekt entfernt.',
    });
  }

  const ylSellers = await fetchSellers('https://yieldlab.net/sellers.json');
  if (ylSellers === null) {
    results.push({ label: 'yieldlab.net/sellers.json', pass: null, detail: 'Fetch fehlgeschlagen oder Timeout' });
  } else {
    const ylMatch = ylSellers.find((s) => s.seller_id === SUPPLY_ID);
    results.push({
      label: `ads.txt: yieldlab.net, ${SUPPLY_ID}, RESELLER`,
      pass: !!ylMatch && ylMatch.domain === 'advertising-alliance.de',
      detail: ylMatch
        ? `✅ Yieldlab sellers.json: seller_id="${SUPPLY_ID}" = "${ylMatch.name}" (domain=${ylMatch.domain}, type=${ylMatch.seller_type})`
        : `❌ Yieldlab sellers.json hat KEINEN seller_id="${SUPPLY_ID}"`,
    });
  }

  return NextResponse.json({ checks: results });
}
