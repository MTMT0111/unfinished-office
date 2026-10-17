import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/86137/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'verification');
fs.mkdirSync(path.join(out, 'browser-temp'), {recursive:true});
process.env.TEMP = path.join(out, 'browser-temp');
process.env.TMP = process.env.TEMP;
const browser = await chromium.launch({executablePath:process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:true});
const context = await browser.newContext({offline:true, reducedMotion:'reduce', acceptDownloads:true, viewport:{width:1366,height:768}});
const page = await context.newPage();
const errors = [], network = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
try {
  await page.goto(pathToFileURL(path.join(root, '打开试玩.html')).href);
  await page.locator('.brand').click();
  assert.equal(await page.locator('#app').getAttribute('data-state'), 'input');
  await page.screenshot({path:path.join(out, 'standalone-home.png'), fullPage:true});
  await page.locator('#sample-weather').click();
  assert.equal(await page.locator('#reduced').isChecked(), true);
  await page.locator('#start').click();
  assert.equal(await page.locator('#app').getAttribute('data-state'), 'playing');
  await page.locator('[data-move=up]:visible').click();
  await page.locator('#skip').click();
  await page.locator('#lamp').click();
  await page.waitForFunction(() => !document.getElementById('download').disabled && !document.getElementById('memorial-preview').hidden);
  assert.equal(await page.locator('#app').getAttribute('data-state'), 'done');
  const download = page.waitForEvent('download');
  await page.locator('#download').click();
  const pngPath = path.join(out, 'standalone-export.png');
  await (await download).saveAs(pngPath);
  assert.equal(fs.readFileSync(pngPath).subarray(0,8).toString('hex'), '89504e470d0a1a0a');
  await page.reload();
  assert.equal(await page.locator('#app').getAttribute('data-state'), 'input');
  assert.deepEqual(errors, []);
  assert.deepEqual(network, []);
  const result = {browser:await browser.version(), target:'file:// 打开试玩.html', checks:['断网首次打开', '顶部标题停留在当前页面', '天气样例→减少动态→关灯→生成并下载 PNG', '本地文件刷新后可重新开始', '零 HTTP(S) 请求、零页面异常'], errors};
  fs.writeFileSync(path.join(out, 'standalone-results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
