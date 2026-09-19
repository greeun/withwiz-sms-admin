import { defineConfig } from 'tsup';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const CLIENT_ENTRIES = ['components/index'];

function addUseClientDirective() {
  for (const entry of CLIENT_ENTRIES) {
    for (const ext of ['.js', '.mjs']) {
      const filePath = resolve('dist', entry + ext);
      try {
        const content = readFileSync(filePath, 'utf-8');
        if (!content.startsWith('"use client"')) {
          writeFileSync(filePath, `"use client";\n${content}`);
        }
      } catch {}
    }
  }
}

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'facade/index': 'src/facade/index.ts',
    'components/index': 'src/components/index.ts',
    'constants/index': 'src/constants/index.ts',
    'types/index': 'src/types/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  external: [/^react/, /^next/, /^@prisma\/client/, /^@withwiz\//, /^sonner/],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
  onSuccess: async () => {
    addUseClientDirective();
  },
});
