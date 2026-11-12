// index.html에서 머리와 몸을 벗겨, 아티팩트로 올릴 쪽을 만든다.
// 쓰는 법: node tools/artifact.mjs <나올 파일>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(root, 'index.html'), 'utf8');
const pick = re => { const m = src.match(re); if (!m) throw new Error('index.html에서 찾지 못함: ' + re); return m[0]; };
const title = pick(/<title>[\s\S]*?<\/title>/);
const meta = pick(/<meta name="claude:viewport-fit-sides"[^>]*>/);
const style = pick(/<style>[\s\S]*?<\/style>/);
const body = pick(/<body>[\s\S]*<\/body>/).replace(/^<body>\s*/, '').replace(/\s*<\/body>$/, '');
const out = process.argv[2];
if (!out) throw new Error('나올 파일 경로를 주어야 한다');
writeFileSync(out, [title, meta, style, body, ''].join('\n'));
console.log('썼다:', out);
