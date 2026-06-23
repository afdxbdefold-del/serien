/* eslint-disable */
/** Inline-Unit-Test für die WEAK_HOSTS-Block-Logik aus pipeline-v2.ts */
const WEAK_HOSTS = ['screenrant.com', 'collider.com', 'whats-on-netflix.com', 'tvinsider.com'];

interface Case { url: string; expectBlocked: boolean }
const cases: Case[] = [
  { url: 'https://screenrant.com/tv/the-boys-finale/',            expectBlocked: true  },
  { url: 'https://www.screenrant.com/tv/the-boys-finale/',        expectBlocked: true  },
  { url: 'https://collider.com/foundation-season-3/',             expectBlocked: true  },
  { url: 'https://www.collider.com/foundation-season-3/',         expectBlocked: true  },
  { url: 'https://www.whats-on-netflix.com/news/x',               expectBlocked: true  },
  { url: 'https://www.tvinsider.com/1234567/severance-recap/',    expectBlocked: true  },
  { url: 'https://tvinsider.com/foo',                             expectBlocked: true  },
  { url: 'https://variety.com/2026/tv/news/foundation',           expectBlocked: false },
  { url: 'https://deadline.com/2026/05/the-boys',                 expectBlocked: false },
  { url: 'https://www.hollywoodreporter.com/tv/tv-news/',         expectBlocked: false },
  { url: 'https://thecinemaholic.com/the-boys-ending-explained/', expectBlocked: false },
];

let pass = 0, fail = 0;
for (const c of cases) {
  let host = '';
  try { host = new URL(c.url).host.replace(/^www\./, '').toLowerCase(); } catch {}
  const blocked = WEAK_HOSTS.includes(host);
  const ok = blocked === c.expectBlocked;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  blocked=${blocked}  host=${host.padEnd(28)}  ${c.url}`);
}
console.log(`\nTotal: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
