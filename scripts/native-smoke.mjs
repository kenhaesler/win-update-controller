import { chromium } from '@playwright/test';
import { writeFileSync, readFileSync } from 'node:fs';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
const contexts = browser.contexts();
const page = contexts.flatMap(c => c.pages()).find(p => p.url().includes('tauri.localhost')) ?? contexts[0].pages()[0];
if (!page) throw new Error('No native WebView found');
await page.getByText('Windows manages updates', { exact: true }).waitFor({ timeout: 30000 });
const result = await page.evaluate(async () => {
  const status = await window.__TAURI_INTERNALS__.invoke('windows_request', { request: { command: 'status' } });
  const history = await window.__TAURI_INTERNALS__.invoke('windows_request', { request: { command: 'history' } });
  let rejected = false;
  try { await window.__TAURI_INTERNALS__.invoke('windows_request', { request: { command: 'shell' } }); } catch { rejected = true; }
  return { native: window.isTauri, url: location.href, status, historyCount: history.entries.length, rejectsUnknownCommand: rejected };
});
// A cached result from the real read-only helper scan lets us inspect realistic long titles.
const scan = JSON.parse(readFileSync('docs/local-scan.json', 'utf8').replace(/^\uFEFF/, '')).data;
await page.evaluate(data => localStorage.setItem('update-controller.scan.v1', JSON.stringify(data)), scan);
await page.reload();
await page.getByRole('heading', { name: 'Available updates' }).waitFor();
await page.getByText('Windows manages updates', { exact: true }).waitFor({ timeout: 30000 });
await page.screenshot({ path: '.impeccable/review/native-live.png' });
await page.getByRole('button', { name: 'Settings', exact: true }).click();
await page.getByText('Not configured', { exact: true }).waitFor();
await page.screenshot({ path: '.impeccable/review/native-settings.png' });
await page.getByRole('button', { name: 'Updates', exact: true }).click();
writeFileSync('docs/native-smoke.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
await browser.close();
