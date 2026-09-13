import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const sourcePath = resolve(process.argv[2] ?? '.tmp-dictionary/eng-rus.tei');
const direction = process.argv[3] ?? 'eng-rus';
if (direction !== 'eng-rus' && direction !== 'rus-eng') {
  throw new Error('Direction must be eng-rus or rus-eng.');
}
const outputDirectory = resolve('public/dictionary', direction);
const alphabet = direction === 'rus-eng'
  ? 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'
  : 'abcdefghijklmnopqrstuvwxyz';
const targetLanguage = direction === 'rus-eng' ? 'en' : 'ru';

function decodeXml(value) {
  const entities = { amp: '&', apos: "'", gt: '>', lt: '<', quot: '"' };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&(amp|apos|gt|lt|quot);/g, (_match, name) => entities[name])
    .replace(/<[^>]+>/g, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/\u0301/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstTag(body, name) {
  const match = body.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

const source = await readFile(sourcePath, 'utf8');
const shards = Object.fromEntries(Array.from(alphabet).map((letter) => [letter, Object.create(null)]));
let entryCount = 0;
let variantCount = 0;

for (const entryMatch of source.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)) {
  const body = entryMatch[1];
  const word = firstTag(body, 'orth')
    .normalize('NFKC')
    .toLocaleLowerCase(direction === 'rus-eng' ? 'ru-RU' : 'en-US')
    .replace(/\s+/g, ' ')
    .trim();
  const letter = word[0];
  if (!letter || !shards[letter] || word.length > 80) continue;
  const partOfSpeech = firstTag(body, 'pos');
  const list = shards[letter][word] ??= [];
  const existing = new Set(list.map(([translation]) => translation.toLocaleLowerCase('ru-RU')));
  const translatedCitations = body.matchAll(new RegExp(
    `<cit\\b(?=[^>]*\\btype="trans")(?=[^>]*\\bxml:lang="${targetLanguage}")[^>]*>([\\s\\S]*?)<\\/cit>`,
    'gi',
  ));
  for (const citation of translatedCitations) {
    for (const quoteMatch of citation[1].matchAll(/<quote(?:\s[^>]*)?>([\s\S]*?)<\/quote>/gi)) {
      const translation = decodeXml(quoteMatch[1]);
      const key = translation.toLocaleLowerCase('ru-RU');
      if (!translation || existing.has(key) || list.length >= 16) continue;
      list.push(partOfSpeech ? [translation, partOfSpeech] : [translation]);
      existing.add(key);
      variantCount += 1;
    }
  }
  if (list.length) entryCount += 1;
}

await mkdir(outputDirectory, { recursive: true });
for (const [letter, entries] of Object.entries(shards)) {
  const sorted = Object.fromEntries(Object.entries(entries).sort(([left], [right]) => left.localeCompare(right, 'en')));
  await writeFile(resolve(outputDirectory, `${letter}.json`), JSON.stringify(sorted));
}

console.log(`Generated ${entryCount} entries and ${variantCount} variants for ${direction} from ${basename(sourcePath)}.`);
