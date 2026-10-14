/**
 * Offline E2E in the packaged desktop app (via CDP):
 *   online → menu loads → emulate OFFLINE → punch takeaway order (offline
 *   queue) → verify IndexedDB → back ONLINE → sync engine replays → queue empty.
 * Requires the app running with --remote-debugging-port=9222.
 */
const http = require('http');
const crypto = require('crypto');
const net = require('net');

async function main() {
  const list = await new Promise((res, rej) => {
    http.get('http://127.0.0.1:9222/json', (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej);
  });
  const page = list.find(p => p.type === 'page');
  if (!page) throw new Error('no page target');

  const wsUrl = new URL(page.webSocketDebuggerUrl);
  const key = crypto.randomBytes(16).toString('base64');
  const socket = net.connect(+wsUrl.port || 9222, '127.0.0.1', () => {
    socket.write(`GET ${wsUrl.pathname} HTTP/1.1\r\nHost: 127.0.0.1:9222\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
  });
  let buf = Buffer.alloc(0); let up = false; let nid = 1;
  const pend = new Map();
  const send = (obj) => {
    const payload = Buffer.from(JSON.stringify(obj));
    const mask = crypto.randomBytes(4);
    const masked = Buffer.from(payload.map((b, i) => b ^ mask[i % 4]));
    let header;
    if (payload.length < 126) header = Buffer.from([0x81, 0x80 | payload.length]);
    else header = Buffer.from([0x81, 0x80 | 126, payload.length >> 8, payload.length & 0xff]);
    socket.write(Buffer.concat([header, mask, masked]));
  };
  const eval2 = (expression, ms = 30000) => new Promise((resolve, reject) => {
    const id = nid++;
    pend.set(id, resolve);
    send({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } });
    setTimeout(() => { if (pend.has(id)) { pend.delete(id); reject(new Error('eval timeout: ' + expression.slice(0, 50))); } }, ms);
  });
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    if (!up) {
      const idx = buf.indexOf('\r\n\r\n');
      if (idx === -1) return;
      up = true; buf = buf.slice(idx + 4); return;
    }
    for (;;) {
      if (buf.length < 2) break;
      const len0 = buf[1] & 0x7f; let off = 2, len = len0;
      if (len0 === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); off = 4; }
      else if (len0 === 127) { if (buf.length < 10) break; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (buf.length < off + len) break;
      const frame = buf.slice(off, off + len); const opcode = buf[0] & 0x0f; buf = buf.slice(off + len);
      if (opcode === 0x8) { socket.end(); return; }
      if (opcode === 0x9) { const pm = crypto.randomBytes(4); socket.write(Buffer.concat([Buffer.from([0x8a, 0x80 | frame.length]), pm, Buffer.from(frame.map((b, i) => b ^ pm[i % 4]))])); continue; }
      if (opcode === 0x1) {
        try {
          const msg = JSON.parse(frame.toString());
          if (msg.id && pend.has(msg.id)) { const r = pend.get(msg.id); pend.delete(msg.id); r(msg.result?.result?.value); }
        } catch { /* ignore */ }
      }
    }
  });
  await new Promise(r => socket.on('connect', r));
  await new Promise(r => setTimeout(r, 600));

  send({ id: nid++, method: 'Runtime.enable' });
  send({ id: nid++, method: 'Page.enable' });
  send({ id: nid++, method: 'Network.enable' });

  // STEP 1: ONLINE — reload so the menu fully loads from Render
  console.log('STEP1: ensure ONLINE, reloading app');
  send({ id: nid++, method: 'Network.emulateNetworkConditions', params: { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 } });
  send({ id: nid++, method: 'Page.reload' });
  await new Promise(r => setTimeout(r, 12000));
  const onlineState = await eval2(`JSON.stringify({ href: location.href, addBtns: [...document.querySelectorAll('button')].filter(b => b.textContent.includes('Add to Cart')).length })`);
  console.log('STEP1b online page:', String(onlineState).slice(0, 160));

  // STEP 2: go to orders route
  await eval2(`(function(){ history.pushState({}, '', '/pos/orders'); window.dispatchEvent(new PopStateEvent('popstate')); return 'nav'; })()`);
  await new Promise(r => setTimeout(r, 3000));

  // STEP 3: punch a takeaway order ONLINE (menu must be loaded — this warms
  // the SPA state; the order itself goes through the server)
  const punchOnline = await eval2(`(async () => {
    const btns = [...document.querySelectorAll('button')].filter(b => b.textContent.includes('Add to Cart'));
    if (!btns.length) return 'no add buttons — ' + document.body.innerText.slice(0, 140);
    btns[0].click();
    await new Promise(r => setTimeout(r, 900));
    const viewCart = [...document.querySelectorAll('button')].find(b => b.textContent.includes('View Cart'));
    if (viewCart) { viewCart.click(); await new Promise(r => setTimeout(r, 1100)); }
    const takeaway = [...document.querySelectorAll('button')].find(b => /takeaway/i.test(b.textContent));
    if (takeaway) { takeaway.click(); await new Promise(r => setTimeout(r, 600)); }
    return 'cart ready';
  })()`);
  console.log('STEP3 online cart:', String(punchOnline).slice(0, 200));

  // STEP 4: emulate OFFLINE now (cart already built)
  send({ id: nid++, method: 'Network.emulateNetworkConditions', params: { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 } });
  console.log('STEP4: emulated OFFLINE');
  await new Promise(r => setTimeout(r, 800));

  const punchOffline = await eval2(`(async () => {
    const place = [...document.querySelectorAll('button')].find(b => /Place Order|Pay Now/i.test(b.textContent));
    if (!place) return 'no place button — ' + document.body.innerText.slice(0, 180);
    place.click();
    await new Promise(r => setTimeout(r, 4000));
    return 'punched offline. banner: ' + (document.querySelector('[data-testid=offline-banner]')?.innerText || 'NONE').replace(/\\n/g, ' | ').slice(0, 160);
  })()`);
  console.log('STEP4b offline punch:', String(punchOffline).slice(0, 340));

  // STEP 5: inspect the IndexedDB queue (real store: dinedesk-offline / 'queue')
  const queue = await eval2(`(async () => new Promise((resolve) => {
    const req = indexedDB.open('dinedesk-offline');
    req.onsuccess = () => {
      const db = req.result;
      try {
        const tx = db.transaction('queue', 'readonly');
        const all = tx.objectStore('queue').getAll();
        all.onsuccess = () => resolve(JSON.stringify({ queued: all.result.length, statuses: all.result.map(o => o.status), numbers: all.result.map(o => o.display && o.display.order_number) }));
        all.onerror = () => resolve('getAll err');
      } catch (e) { resolve('store err: ' + e.message + ' | stores: ' + Array.from(db.objectStoreNames).join(',')); }
    };
    req.onerror = () => resolve('db open err');
  }))()`);
  console.log('STEP5 queue:', String(queue).slice(0, 260));

  // STEP 6: back ONLINE → sync engine replays
  send({ id: nid++, method: 'Network.emulateNetworkConditions', params: { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 } });
  await eval2(`(function(){ window.dispatchEvent(new Event('online')); return 'online'; })()`);
  console.log('STEP6: back ONLINE — sync pass triggered');
  await new Promise(r => setTimeout(r, 14000));
  const after = await eval2(`(async () => new Promise((resolve) => {
    const req = indexedDB.open('dinedesk-offline');
    req.onsuccess = () => {
      const db = req.result;
      try {
        const tx = db.transaction('queue', 'readonly');
        const all = tx.objectStore('queue').getAll();
        all.onsuccess = () => resolve(JSON.stringify({ remaining: all.result.length, statuses: all.result.map(o => o.status), errors: all.result.map(o => o.last_error).filter(Boolean) }));
        all.onerror = () => resolve('err');
      } catch (e) { resolve('err: ' + e.message); }
    };
    req.onerror = () => resolve('db err');
  }))()`);
  console.log('STEP7 queue-after-sync:', String(after).slice(0, 320));

  socket.end();
  process.exit(0);
}

main().catch(e => { console.error('E2E error:', e.message); process.exit(1); });
