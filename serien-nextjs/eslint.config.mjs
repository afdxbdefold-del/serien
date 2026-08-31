import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: currentDirectory });

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/prebid/**',
      'cookies/**',
      'assets/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];
