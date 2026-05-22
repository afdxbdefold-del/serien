import { NextResponse } from 'next/server';

// ads.txt is managed externally via Ads.txt Manager.
// Equivalent to:
//   <?php header('Location: https://srv.adstxtmanager.com/84335/serien.de'); exit; ?>
// We use a 302 redirect so Google/IAB crawlers fetch the managed file.
const ADS_TXT_MANAGER_URL = 'https://srv.adstxtmanager.com/84335/serien.de';

export async function GET() {
  return NextResponse.redirect(ADS_TXT_MANAGER_URL, 302);
}
