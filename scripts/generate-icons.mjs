import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const iconDirectory = resolve('public/icons');
const source = await readFile(resolve(iconDirectory, 'poop.svg'));
await mkdir(iconDirectory, { recursive: true });

await Promise.all([16, 32, 48, 128].map((size) => (
  sharp(source)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(resolve(iconDirectory, `icon-${size}.png`))
)));
