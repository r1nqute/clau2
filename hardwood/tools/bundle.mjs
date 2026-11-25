// index.html과 css/js/data를 한 파일로 묶는다(서버 없이 파일만 열어도 돈다).
// 쓰는 법: node tools/bundle.mjs [나올 파일]   (기본: dist/hardwood-manager.html)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || resolve(root, 'dist/hardwood-manager.html');
let html = readFileSync(resolve(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => `<style>\n${readFileSync(resolve(root, href), 'utf8')}\n</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  const code = readFileSync(resolve(root, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script>\n${code}\n</script>`;
});
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log('썼다:', out, (html.length / 1e6).toFixed(2) + 'MB');
