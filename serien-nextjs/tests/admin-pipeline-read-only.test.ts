import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Inspect the actual handler without importing its database/provider clients.
const source = readFileSync(new URL('../app/api/admin/pipeline/route.ts', import.meta.url), 'utf8');
const mutationMethods = new Set([
  'create', 'createMany', 'createManyAndReturn', 'update', 'updateMany',
  'updateManyAndReturn', 'upsert', 'delete', 'deleteMany',
  '$executeRaw', '$executeRawUnsafe', '$queryRaw', '$queryRawUnsafe', '$transaction',
]);

function getMutations(text: string): string[] {
  const file = ts.createSourceFile('route.ts', text, ts.ScriptTarget.Latest, true);
  const handler = file.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === 'GET');
  assert(handler?.body, 'the actual GET handler must remain identifiable');
  const mutations: string[] = [];
  const visit = (node: ts.Node): void => {
    const expression = ts.isCallExpression(node) ? node.expression
      : ts.isTaggedTemplateExpression(node) ? node.tag : undefined;
    if (expression) {
      const method = ts.isPropertyAccessExpression(expression) ? expression.name.text
        : ts.isElementAccessExpression(expression) && ts.isStringLiteral(expression.argumentExpression)
          ? expression.argumentExpression.text : undefined;
      if (method && mutationMethods.has(method)) mutations.push(expression.getText(file));
    }
    ts.forEachChild(node, visit);
  };
  visit(handler.body);
  return mutations;
}

test('reading the pipeline dashboard never changes database state or expires running jobs', () => {
  assert.deepEqual(getMutations(source), []);
  const compiled = ts.transpileModule(source, { fileName: 'route.ts', reportDiagnostics: true });
  assert.deepEqual(compiled.diagnostics, []);
});

test('the read-only guard detects former cleanup, nested writes, bracket calls and raw SQL', () => {
  const fixture = [
    'export async function GET() {',
    '  await prisma.pipeline_runs.updateMany({ where: { status: "running" }, data: { status: "failed" } });',
    '  await Promise.all([Promise.resolve().then(() => prisma.articles.update({}))]);',
    '  await prisma.pipeline_runs["deleteMany"]({});',
    '  await prisma.$executeRaw`UPDATE pipeline_runs SET status = ${"failed"}`;',
    '}',
    'export async function POST() { await prisma.articles.delete({}); }',
  ].join('\n');
  assert.deepEqual(getMutations(fixture), [
    'prisma.pipeline_runs.updateMany', 'prisma.articles.update',
    'prisma.pipeline_runs["deleteMany"]', 'prisma.$executeRaw',
  ]);
});
