import { isSafePublicHttpUrl, validateAndNormalizeArticleHtml } from '../lib/article-html-safety';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const valid = validateAndNormalizeArticleHtml(
  '<h2>Einordnung</h2><p>Text mit <a href="/serie/test">internem Link</a>.</p>'
  + '<div class="related-articles"><ul><li>Mehr</li></ul></div>',
);
assert(valid.ok, 'ordinary editorial HTML should pass');
assert(valid.normalizedHtml.includes('<h2>Einordnung</h2>'), 'safe HTML should be normalized');

for (const [name, html] of [
  ['script element', '<p>Text</p><script>alert(1)</script>'],
  ['event handler', '<img src="https://image.tmdb.org/a.jpg" onerror="alert(1)">'],
  ['javascript URL', '<a href="jav&#x61;script:alert(1)">Link</a>'],
  ['data URL', '<img src="data:image/svg+xml,<svg onload=alert(1)>">'],
  ['inline style', '<p style="position:fixed">Overlay</p>'],
  ['arbitrary CSS class', '<div class="fixed inset-0">Overlay</div>'],
  ['SVG namespace', '<svg><a href="javascript:alert(1)">X</a></svg>'],
  ['private media target', '<img src="https://127.0.0.1/image.jpg">'],
  ['backslash host confusion', '<img src="/\\localhost/image.jpg">'],
  ['relative path traversal', '<img src="/img/../api/admin/articles">'],
  ['encoded relative path traversal', '<img src="/img/%2e%2e/api/admin/articles">'],
  ['reverse tabnabbing', '<a href="https://example.com" target="_blank" rel="opener">Link</a>'],
] as const) {
  const result = validateAndNormalizeArticleHtml(html);
  assert(!result.ok, `${name} must fail closed`);
  assert(result.normalizedHtml === '', `${name} must not return publishable HTML`);
}

const safeBlankLink = validateAndNormalizeArticleHtml(
  '<p><a href="https://example.com" target="_blank">Quelle</a></p>',
);
assert(safeBlankLink.ok, 'safe target=_blank link should pass');
assert(safeBlankLink.normalizedHtml.includes('rel="noopener noreferrer"'), 'target=_blank must force noopener');
assert(isSafePublicHttpUrl('https://example.com/news'), 'ordinary public source URL should pass');
assert(!isSafePublicHttpUrl('http://localhost./news'), 'trailing-dot localhost source must fail');
assert(!isSafePublicHttpUrl('http://0/news'), 'zero-network source must fail');
assert(!isSafePublicHttpUrl('https://100.64.0.1/news'), 'shared-address-space source must fail');

console.log('✅ article-html-safety tests passed');
