// Bootstrap script to run TypeScript pipeline
require('esbuild-register/dist/node').register({
  target: 'node18',
});

require('./pipeline-v1.ts');
