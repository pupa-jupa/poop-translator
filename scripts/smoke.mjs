import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('dist');
const manifest = JSON.parse(await readFile(resolve(output, 'manifest.json'), 'utf8'));
const sourceManifest = JSON.parse(await readFile(resolve('public/manifest.json'), 'utf8'));
const packageMetadata = JSON.parse(await readFile(resolve('package.json'), 'utf8'));

if (manifest.version !== sourceManifest.version || manifest.version !== packageMetadata.version) {
  throw new Error(`Extension version mismatch: dist=${manifest.version}, source=${sourceManifest.version}, package=${packageMetadata.version}`);
}

if (manifest.manifest_version !== 3) throw new Error('manifest_version must be 3');
if (manifest.minimum_chrome_version !== '138') throw new Error('minimum_chrome_version must be 138');
if (!manifest.permissions.includes('offscreen')) throw new Error('OCR requires the offscreen permission');
if (!manifest.content_security_policy.extension_pages.includes("'wasm-unsafe-eval'")) {
  throw new Error('OCR requires wasm-unsafe-eval for the bundled Tesseract core');
}
if (manifest.commands?.['translate-region']?.suggested_key?.default !== 'Alt+Shift+P') {
  throw new Error('Region translation keyboard command is missing');
}

const requiredFiles = [
  'popup.html',
  manifest.background.service_worker,
  manifest.content_scripts[0].js[0],
  'ocr.html',
  'ocr/worker.min.js',
  'ocr/LICENSE-APACHE-2.0.txt',
  'ocr/worker.min.js.LICENSE.txt',
  'ocr/core/tesseract-core-lstm.wasm.js',
  'ocr/core/tesseract-core-simd-lstm.wasm.js',
  'ocr/core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'ocr/lang/eng.traineddata.gz',
  'ocr/lang/rus.traineddata.gz',
  ...Object.values(manifest.icons),
  'dictionary/eng-rus/b.json',
  'dictionary/rus-eng/б.json',
];

await Promise.all(requiredFiles.map((file) => access(resolve(output, file))));

const content = await readFile(resolve(output, manifest.content_scripts[0].js[0]), 'utf8');
if (/^\s*import\s/m.test(content)) {
  throw new Error('Content script contains an ESM import and cannot run as a manifest content script');
}

const popup = await readFile(resolve(output, 'popup.html'), 'utf8');
if (/https?:\/\//.test(popup)) throw new Error('Popup references a remote resource');
const ocr = await readFile(resolve(output, 'ocr.html'), 'utf8');
if (/https?:\/\//.test(ocr)) throw new Error('OCR document references a remote resource');
const notices = await readFile(resolve(output, 'THIRD_PARTY_NOTICES.txt'), 'utf8');
if (!notices.includes('Tesseract.js 7.0.0') || !notices.includes('tessdata_best')) {
  throw new Error('Packaged OCR third-party notices are missing');
}

const englishVariants = JSON.parse(await readFile(resolve(output, 'dictionary/eng-rus/b.json'), 'utf8'));
const russianVariants = JSON.parse(await readFile(resolve(output, 'dictionary/rus-eng/б.json'), 'utf8'));
if (!Array.isArray(englishVariants.bank) || englishVariants.bank.length < 3) {
  throw new Error('English to Russian dictionary variants are missing');
}
if (!Array.isArray(russianVariants['банк']) || russianVariants['банк'].length < 1) {
  throw new Error('Russian to English dictionary variants are missing');
}

console.log(`Smoke check passed: ${requiredFiles.length} required extension files are present.`);
