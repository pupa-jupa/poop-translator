import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destinationRoot = join(projectRoot, 'dist', 'ocr');

async function copy(source, destination) {
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

await copy(
  join(projectRoot, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js'),
  join(destinationRoot, 'worker.min.js'),
);
await copy(
  join(projectRoot, 'node_modules', 'tesseract.js', 'LICENSE.md'),
  join(destinationRoot, 'LICENSE-APACHE-2.0.txt'),
);
await copy(
  join(projectRoot, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js.LICENSE.txt'),
  join(destinationRoot, 'worker.min.js.LICENSE.txt'),
);

const coreRoot = join(projectRoot, 'node_modules', 'tesseract.js-core');
const coreFiles = (await readdir(coreRoot)).filter((name) => name.endsWith('-lstm.wasm.js'));
await Promise.all(coreFiles.map((name) => copy(join(coreRoot, name), join(destinationRoot, 'core', name))));

for (const language of ['eng', 'rus']) {
  await copy(
    join(projectRoot, 'node_modules', '@tesseract.js-data', language, '4.0.0_best_int', `${language}.traineddata.gz`),
    join(destinationRoot, 'lang', `${language}.traineddata.gz`),
  );
}
