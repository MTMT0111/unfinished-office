import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="(\.\/assets\/[^"/]+\.js)"[^>]*><\/script>/g)];
const styles = [...html.matchAll(/<link\b[^>]*\bhref="(\.\/assets\/[^"/]+\.css)"[^>]*>/g)];
assert.equal(scripts.length, 1, '单文件版需要一个脚本入口');
assert.equal(styles.length, 1, '单文件版需要一个样式入口');
// shortcut: 仅支持当前自包含的 JS/CSS；引入分包或外部素材时须升级打包方式。
assert.deepEqual(fs.readdirSync(path.join(dist, 'assets')).sort(), [path.basename(scripts[0][1]), path.basename(styles[0][1])].sort());
const js = fs.readFileSync(path.join(dist, scripts[0][1]), 'utf8');
const css = fs.readFileSync(path.join(dist, styles[0][1]), 'utf8');
assert(!/<\/script/i.test(js), '脚本不能包含 HTML 结束标签');
assert(!/<\/style/i.test(css), '样式不能包含 HTML 结束标签');
html = html.replace(scripts[0][0], () => `<script type="module">${js}</script>`)
  .replace(styles[0][0], () => `<style>${css}</style>`)
  .replace('class="brand" href="./"', 'class="brand" href="#app"');
assert(!/<script\b[^>]*\bsrc=|<link\b[^>]*rel="stylesheet"/.test(html), '仍有外部入口');
const output = path.join(root, '打开试玩.html');
fs.writeFileSync(output, html);
console.log(`已生成可双击打开的版本：${output}`);
