#!/usr/bin/env node
/**
 * Gera o bundle do motor para o harness de navegador.
 * O artefato não é versionado; é reconstruído a cada execução do teste.
 */
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

await build({
  entryPoints: [join(root, 'harness', 'entry.js')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  outfile: join(root, 'harness', 'engine.bundle.js'),
  logLevel: 'error',
});
