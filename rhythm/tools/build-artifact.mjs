// index.html과 js/*.js를 한 장짜리 쪽으로 묶는다(아티팩트 올리기용, 머리·몸 태그는 올릴 때 덧씌워진다).
// 쓰는 법: node tools/build-artifact.mjs <나올 파일>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(root, 'index.html'), 'utf8');
const pick = re => { const m = src.match(re); if (!m) throw new Error('index.html에서 찾지 못함: ' + re); return m[0]; };
const title = pick(/<title>[\s\S]*?<\/title>/);
const meta = pick(/<meta name="claude:viewport-fit-sides"[^>]*>/);
const links = (src.match(/<link [^>]*>/g) || []).join('\n');
const style = pick(/<style>[\s\S]*?<\/style>/);
let body = pick(/<body>[\s\S]*<\/body>/).replace(/^<body>\s*/, '').replace(/\s*<\/body>$/, '');
body = body.replace(/<script src="([^"]+)"><\/script>/g, (_, p) => {
  const js = readFileSync(resolve(root, p), 'utf8');
  if (/<\/script/i.test(js)) throw new Error(p + ' 안에 </script 가 있다');
  return `<script>\n/* ${p} */\n${js}\n</script>`;
});
const out = process.argv[2];
if (!out) throw new Error('나올 파일 경로를 주어야 한다');
writeFileSync(out, [title, meta, links, style, body, ''].join('\n'));
console.log('썼다:', out, (readFileSync(out).length / 1024).toFixed(0) + 'KB');
