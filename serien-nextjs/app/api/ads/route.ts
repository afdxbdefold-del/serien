import { NextResponse } from 'next/server';

const ADS_TXT = `ownerdomain=serien.de
managerdomain=advertising-alliance.de

google.com, pub-8583619451045805, DIRECT, f08c47fec0942fa0

# Programmatic Ad Sales by Yieldlab AG
yieldlab.net, 35673, direct
yieldlab.net, 227224, reseller
yieldlab.net, 961276, reseller
yieldlab.net, 6374282, reseller
openx.com, 539246483, reseller, 6a698e2ec38604c6
yieldlab.net, 851872, reseller
yieldlab.net, 5494672, reseller
yieldlab.net, 2329165, reseller
yieldlab.net, 506261, reseller
yieldlab.net, 5798882, reseller
yieldlab.net, 2172218, reseller
yieldlab.net, 781119, reseller
yieldlab.net, 9735969, reseller
yieldlab.net, 9839017, reseller
yieldlab.net, 9879854, reseller
indexexchange.com, 191771, reseller, 50b1c356f2c5c8fc
pubmatic.com, 158858, reseller, 5d62403b186f2ace
themediagrid.com, 6283VY, reseller, 9fac4a4a87c2a44f
# END`;

export async function GET() {
  return new NextResponse(ADS_TXT, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
