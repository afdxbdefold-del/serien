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
# END

# Ezoic
ezoic.ai, 68c71dfc03c4dd279740a4db2b668e11, DIRECT
ezoic.co.uk, 68c71dfc03c4dd279740a4db2b668e11, DIRECT
rubiconproject.com, 21152, DIRECT, 0bfd66d529a55807
media.net, 8CUL1AWYD, DIRECT
google.com, pub-6644558441501035, DIRECT, f08c47fec0942fa0
google.com, pub-1175987143200523, RESELLER, f08c47fec0942fa0
lijit.com, 62299-eb, DIRECT, fafdf38b16bf6b2b
indexexchange.com, 187973, DIRECT, 50b1c356f2c5c8fc
sharethrough.com, 226d318d, DIRECT, d53b998a7bd4ecd2
google.com, pub-6396844742497208, RESELLER, f08c47fec0942fa0
adingo.jp, 24483, RESELLER
improvedigital.com, 2254, RESELLER
video.unrulymedia.com, 1346664749, DIRECT
sonobi.com, 52355162e8, RESELLER, d1a215d9eb5aee9e
# END Ezoic`;

export async function GET() {
  return new NextResponse(ADS_TXT, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
