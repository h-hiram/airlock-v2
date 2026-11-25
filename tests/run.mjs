import { build } from 'vite';
import { spawn } from 'node:child_process';

console.log('Bundling tests with Vite...');
await build({
  build: {
    lib: {
      entry: 'tests/all.test.ts',
      formats: ['es'],
      fileName: () => 'airlock.test.bundle.mjs',
    },
    outDir: 'tests/dist',
    emptyOutDir: true,
    rollupOptions: {
      external: [/^node:/],
    },
  },
  logLevel: 'warn',
});

console.log('Running test suite with Node test runner...\n');
const child = spawn(process.execPath, ['--test', 'tests/dist/airlock.test.bundle.mjs'], {
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
