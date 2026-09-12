import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('dist');
const manifest = JSON.parse(await readFile(resolve(output, 'manifest.json'), 'utf8'));

if (manifest.manifest_version !== 3) throw new Error('manifest_version must be 3');
if (manifest.minimum_chrome_version !== '138') throw new Error('minimum_chrome_version must be 138');

const requiredFiles = [
  'popup.html',
  manifest.background.service_worker,
  manifest.content_scripts[0].js[0],
  ...Object.values(manifest.icons),
];

await Promise.all(requiredFiles.map((file) => access(resolve(output, file))));

const content = await readFile(resolve(output, manifest.content_scripts[0].js[0]), 'utf8');
if (/^\s*import\s/m.test(content)) {
  throw new Error('Content script contains an ESM import and cannot run as a manifest content script');
}

const popup = await readFile(resolve(output, 'popup.html'), 'utf8');
if (/https?:\/\//.test(popup)) throw new Error('Popup references a remote resource');

console.log(`Smoke check passed: ${requiredFiles.length} required extension files are present.`);
