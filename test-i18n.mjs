import { build } from 'esbuild';
const output = await build({ entryPoints: ['src/i18n.ts'], bundle: true, format: 'esm', write: false, platform: 'neutral' });
const mod = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'));
const en = Object.keys(mod.translations.en).sort();
const de = Object.keys(mod.translations.de).sort();
if (JSON.stringify(en) !== JSON.stringify(de)) throw new Error('English/German keys differ');
for (const key of en) {
  const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map(x => x[1]).sort().join(',');
  if (placeholders(mod.translations.en[key]) !== placeholders(mod.translations.de[key]))
    throw new Error(`Placeholder mismatch for ${key}`);
}
if (mod.tr('de', 'sent', {target:'Handy'}) !== 'MP4 an Handy gesendet') throw new Error('German translation failed');
if (mod.tr('en', 'sent', {target:'phone'}) !== 'MP4 sent to phone') throw new Error('English translation failed');
console.log('i18n en/de parity and interpolation: OK (' + en.length + ' keys)');
