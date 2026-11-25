// claude.ai 아티팩트로 올릴 쪽을 만든다: CSS·JS를 안에 넣은 페이지와, 따로 불러올 data/nba.json.
// 쓰는 법: node tools/artifact.mjs <나올 폴더>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2];
if (!out) throw new Error('나올 폴더를 주어야 한다');
const src = readFileSync(resolve(root, 'index.html'), 'utf8');
const title = src.match(/<title>[\s\S]*?<\/title>/)[0];
const themeScript = src.match(/<script>try\{[\s\S]*?<\/script>/)[0];
const css = readFileSync(resolve(root, 'css/app.css'), 'utf8');
const scripts = [...src.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]).filter(f => f !== 'data/nba.js');
const js = scripts.map(f => `// ---- ${f}\n` + readFileSync(resolve(root, f), 'utf8')).join('\n').replace(/<\/script/gi, '<\\/script');
const page = [
  title,
  '<meta name="claude:viewport-fit-sides" content="cover">',
  `<style>\n${css}\n</style>`,
  themeScript,
  '<div id="root"></div>\n<div id="modal"></div>\n<div id="busy"></div>\n<div id="toast"></div>',
  `<script>\n${js}\n</script>`,
  '',
].join('\n');
mkdirSync(join(out, 'data'), { recursive: true });
writeFileSync(join(out, 'index.html'), page);
const data = readFileSync(resolve(root, 'data/nba.js'), 'utf8');
const json = data.slice(data.indexOf('globalThis.HM_DATA=') + 'globalThis.HM_DATA='.length).replace(/;\s*$/, '');
JSON.parse(json);
writeFileSync(join(out, 'data/nba.json'), json);
console.log('썼다:', join(out, 'index.html'), (page.length / 1e3).toFixed(0) + 'KB', '+ data/nba.json', (json.length / 1e6).toFixed(2) + 'MB');
