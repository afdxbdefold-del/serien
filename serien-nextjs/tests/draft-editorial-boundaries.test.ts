import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Parse scripts rather than import them: their entrypoints own a real database
// client and provider discovery. This suite must never run either side effect.
const scripts = ['p3-trends', 'p4-yt'].map(name => {
  const source = readFileSync(new URL(`../scripts/${name}.ts`, import.meta.url), 'utf8');
  const file = ts.createSourceFile(`${name}.ts`, source, ts.ScriptTarget.Latest, true);
  return { name, source, file };
});

function descendants(file: ts.SourceFile): ts.Node[] {
  const result: ts.Node[] = [];
  const visit = (node: ts.Node) => { result.push(node); ts.forEachChild(node, visit); };
  visit(file);
  return result;
}

test('draft scripts parse and preserve source-review hold without legacy model gates', () => {
  const forbidden = new Set([
    'qualityCheck', 'antiAiFilter', 'factSafetyCheck', 'rewriteForHumanTone',
    'importSeriesCharacters', 'importSeriesCast',
  ]);
  for (const { name, source, file } of scripts) {
    const transpiled = ts.transpileModule(source, { fileName: `${name}.ts`, reportDiagnostics: true });
    assert.deepEqual(transpiled.diagnostics, [], `${name} must parse without executing provider/DB imports`);
    for (const node of descendants(file)) {
      if (ts.isIdentifier(node)) assert.equal(forbidden.has(node.text), false, `${name}: obsolete ${node.text}`);
    }
    assert.match(source, /const releaseModeEnabled = false/);
    assert.match(source, /gate: 'source-grounding',\s+status: 'fail'/);
    assert.match(source, /pending-full-original-source-review/);
    assert.match(source, /requiredGates: \['html-safety', 'source-grounding', 'source', 'freshness', 'release-mode'\]/);
    assert.match(source, /validateAndNormalizeArticleHtml\(htmlContent\)/);
    assert.match(source, /status: publicationStatus/);
    assert.match(source, /sourcePublishedAt: (null|video\.publishedAt)/);
    assert.match(source, /linkCharactersInMarkdown\(/, 'existing links remain available without profile generation');
    assert.match(source, /linkCastInMarkdown\(/);
  }
});

test('catalogue records are not smuggled into original news evidence', () => {
  for (const { name, file } of scripts) {
    const evidenceVariables = descendants(file).filter((node): node is ts.VariableDeclaration =>
      ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
      && ['articleSources', 'combinedSourceText', 'sourceText', 'newContent'].includes(node.name.text));
    assert(evidenceVariables.length > 0, `${name} exposes identifiable source text`);
    for (const declaration of evidenceVariables) {
      assert.doesNotMatch(declaration.initializer?.getText(file) || '', /tmdbData|dbSeries|tmdbContext|seriesContext|cast\.map/);
    }
    assert.doesNotMatch(file.text, /additionalSources\s*\+=\s*[^;]*(?:dbSeries|tmdbData)/);
  }
});
