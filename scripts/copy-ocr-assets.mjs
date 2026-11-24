import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const destTess = join(root, 'public', 'tesseract');
const destLang = join(root, 'public', 'tessdata');

mkdirSync(destTess, { recursive: true });
mkdirSync(destLang, { recursive: true });

const workerSrc = join(root, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js');
if (existsSync(workerSrc)) {
  copyFileSync(workerSrc, join(destTess, 'worker.min.js'));
}

const coreDir = join(root, 'node_modules', 'tesseract.js-core');
if (existsSync(coreDir)) {
  for (const file of readdirSync(coreDir)) {
    if (file.startsWith('tesseract-core') && (file.endsWith('.js') || file.endsWith('.wasm'))) {
      copyFileSync(join(coreDir, file), join(destTess, file));
    }
  }
}

const langSrc = join(
  root,
  'node_modules',
  '@tesseract.js-data',
  'por',
  '4.0.0_best_int',
  'por.traineddata.gz'
);
if (existsSync(langSrc)) {
  copyFileSync(langSrc, join(destLang, 'por.traineddata.gz'));
}
