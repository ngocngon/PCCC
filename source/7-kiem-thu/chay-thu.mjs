import { createRequire } from 'module';
const require = createRequire(process.env.NODE_MODULES || process.cwd() + '/');
const { chromium } = require('playwright');
import fs from 'fs';
// Kiểm thử tự động Audit PCCC bằng Playwright và AI giả lập (không tốn lượt Gemini).
// Chuẩn bị: dựng app (python3 build.py), chép 7-kiem-thu/mock-gemini.js thành docs/_mock.js,
//   chạy `python3 -m http.server 8765` trong docs/, cài playwright (npm i playwright).
// Chạy:  node chay-thu.mjs anh1.jpg anh2.jpg anh3.jpg anh4.jpg      (cần đúng 4 ảnh hiện trường)
//   W=390 H=844 TAG=mob node chay-thu.mjs ...   để thử giao diện điện thoại.
// Kết quả (ảnh chụp màn hình, file .xlsx, .pdf) nằm trong thư mục out/. Xóa docs/_mock.js trước khi đưa lên mạng.
const IMGS = process.argv.slice(2); if (IMGS.length !== 4) { console.error('Cần 4 đường dẫn ảnh.'); process.exit(1) }
fs.mkdirSync('out', { recursive: true });
const W = Number(process.env.W || 1440), H = Number(process.env.H || 900), TAG = process.env.TAG || 'desk';
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME, args: ['--no-sandbox'] } : {});
const ctx = await b.newContext({ viewport: { width: W, height: H }, acceptDownloads: true, locale: 'vi-VN', isMobile: W < 600, hasTouch: W < 600 });
const pg = await ctx.newPage();
const errs = [];
pg.on('pageerror', e => errs.push('PAGEERR ' + e.message));
pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 300)) });
await pg.goto('http://localhost:8765/');
await pg.evaluate(() => { localStorage.setItem('soat-pccc-gkey', 'AIza-test-key'); localStorage.setItem('soat-pccc-gmodels', JSON.stringify({ all: ['gemini-2.5-flash'], main: 'gemini-2.5-flash', deep: 'gemini-2.5-flash' })) });
await pg.reload(); await pg.waitForTimeout(1500);
await pg.evaluate(() => import('/_mock.js'));
await pg.screenshot({ path: `out/${TAG}-0-start.png` });
const step = async (name, fn) => { try { await fn(); console.log('ok', name) } catch (e) { console.log('FAIL', name, String(e).slice(0, 400)); await pg.screenshot({ path: `out/${TAG}-FAIL-${name}.png` }) } };
await step('meta', async () => { await pg.evaluate(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })) }; set('mUnit', 'TNHH MOBASE VIET NAM'); set('mWho', 'Trọng Thanh & Ngọc Ngôn'); set('mSub', 'Coating, Injection, Anodizing'); set('mDate', '2026-11-16') }) });
await step('upload', async () => { await pg.setInputFiles('#file', IMGS); });
await step('ai', async () => { await pg.waitForFunction(() => { const s = window.__PC.state(); return document.querySelectorAll('#thumbs img').length >= 4 && (s.items.reduce((a, x) => a + x.pend, 0) >= 8) }, null, { timeout: 90000 }); await pg.waitForTimeout(3000) });
await pg.screenshot({ path: `out/${TAG}-1-review.png` });
console.log('state after AI', JSON.stringify(await pg.evaluate(() => { const s = window.__PC.state(); return { score: s.score, pend: s.items.filter(x => x.pend).map(x => [x.v.no, x.pend]), ehs: s.ehs.length } })));
if (W >= 920) {
  await step('table', async () => { await pg.click('#dnav button[data-dv="table"]'); await pg.waitForTimeout(800); await pg.screenshot({ path: `out/${TAG}-2-table.png` }); });
  await step('confirmAll', async () => { await pg.click('#tConfirmAll'); await pg.waitForTimeout(300); await pg.click('#tConfirmAll'); await pg.waitForTimeout(1200); });
  await step('report', async () => { await pg.click('#dnav button[data-dv="report"]'); await pg.waitForTimeout(800); await pg.screenshot({ path: `out/${TAG}-3-report.png`, fullPage: false }); });
  await step('dash', async () => { await pg.click('#dnav button[data-dv="dash"]'); await pg.waitForTimeout(800); await pg.screenshot({ path: `out/${TAG}-4-dash.png` }); await pg.click('#dnav button[data-dv="report"]'); await pg.waitForTimeout(500) });
} else {
  await step('list', async () => { await pg.click('.tabbar button[data-v="list"]'); await pg.waitForTimeout(800); await pg.screenshot({ path: `out/${TAG}-2-list.png` }); });
  await step('confirm-mobile', async () => { const n = await pg.evaluate(() => { let n = 0; for (let k = 0; k < 40; k++) { const b = [...document.querySelectorAll('button')].find(x => /^(✓ )?Xác nhận(, sang lỗi tiếp)?$/.test(x.textContent.trim()) && x.offsetParent); if (!b) break; b.click(); n++ } return n }); console.log('clicked confirm', n); await pg.waitForTimeout(500) });
  await step('hub', async () => { await pg.click('.tabbar button[data-v="hub"]'); await pg.waitForTimeout(800); await pg.screenshot({ path: `out/${TAG}-3-hub.png` }); });
}
console.log('state after confirm', JSON.stringify(await pg.evaluate(() => { const s = window.__PC.state(); return { score: s.score, grade: s.grade, ng: s.items.filter(x => x.st === 'NG').map(x => [x.v.no, x.faults.length]), open: s.nOpen, ehs: s.ehs.length, pend: s.items.reduce((a, x) => a + x.pend, 0) } })));
await step('note', async () => { await pg.evaluate(() => { const row = [...document.querySelectorAll('#pcList .pci')][7]; row.querySelector('.pcng').click() }); await pg.waitForTimeout(300); await pg.fill('#pcList .pced input', 'Hồ sơ'); await pg.fill('#pcList .pced textarea', 'Giấy phép làm việc có lửa chưa có mục kiểm tra tàn lửa sau khi kết thúc công việc (1 giờ) và kiểm tra lại (sau 3 giờ)'); await pg.click('#pcList .pced .btn.primary'); await pg.waitForTimeout(400) });
await step('gate-blocked', async () => { const dis = await pg.evaluate(() => document.getElementById('btnFind2').disabled); console.log('btnFind2 disabled before scoring all =', dis) });
await step('bulkOK', async () => { await pg.click('#pcSum .btn'); await pg.waitForTimeout(300); await pg.click('#pcSum .btn'); await pg.waitForTimeout(600) });
console.log('final', JSON.stringify(await pg.evaluate(() => { const s = window.__PC.state(); return { score: s.score, grade: s.grade, nNG: s.nNG, nOK: s.nOK, open: s.nOpen, checks: [...document.querySelectorAll('#xCheck li')].map(l => l.className + ':' + l.textContent.slice(0, 60)) } })));
await pg.evaluate(() => document.getElementById('pcBox').scrollIntoView());
await pg.screenshot({ path: `out/${TAG}-5-scored.png` });
await pg.evaluate(() => document.querySelectorAll('#pcList .pci')[10].scrollIntoView({ block: 'center' }));
await pg.screenshot({ path: `out/${TAG}-5b-scored.png` });
for (const [id, name] of [['btnFind2', 'xlsx'], ['btnPdf', 'pdf']]) await step('export-' + name, async () => { await pg.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'center' }), id); const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 120000 }), pg.click('#' + id)]); const fn = dl.suggestedFilename(); await dl.saveAs(`out/${TAG}-${fn}`); console.log('saved', fn, fs.statSync(`out/${TAG}-${fn}`).size); await pg.waitForTimeout(1500) });
await pg.screenshot({ path: `out/${TAG}-6-end.png` });
console.log('ERRORS', errs.length, errs.slice(0, 12).join('\n'));
await b.close();
