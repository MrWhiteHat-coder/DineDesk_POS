/**
 * CDP console capture — listens to Console + Network events from the
 * packaged app for N seconds and prints everything.
 * Usage: node cdp-console.js [seconds]
 */
const http = require('http');
const crypto = require('crypto');
const net = require('net');

const SECONDS = +(process.argv[2] || 15);

function cdpSession(wsUrl) {
  return new Promise((resolve, reject) => {
    const key = crypto.randomBytes(16).toString('base64');
    const url = new URL(wsUrl);
    const socket = net.connect(+url.port || 9222, url.hostname || '127.0.0.1', () => {
      socket.write(
        `GET ${url.pathname} HTTP/1.1\r\nHost: ${url.hostname}:${url.port}\r\n` +
        'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
        `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
      );
    });
    let buf = Buffer.alloc(0);
    let upgraded = false;
    let nextId = 1;
    const listeners = [];

    const send = (obj) => {
      const payload = Buffer.from(JSON.stringify(obj));
      const mask = crypto.randomBytes(4);
      const masked = Buffer.from(payload.map((b, i) => b ^ mask[i % 4]));
      let header;
      if (payload.length < 126) header = Buffer.from([0x81, 0x80 | payload.length]);
      else header = Buffer.from([0x81, 0x80 | 126, payload.length >> 8, payload.length & 0xff]);
      socket.write(Buffer.concat([header, mask, masked]));
    };

    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (!upgraded) {
        const idx = buf.indexOf('\r\n\r\n');
        if (idx === -1) return;
        const head = buf.slice(0, idx).toString();
        if (!/101/.test(head.split('\r\n')[0])) { reject(new Error('handshake failed')); return; }
        upgraded = true;
        buf = buf.slice(idx + 4);
        resolve({
          send,
          on: (fn) => listeners.push(fn),
          close: () => socket.end(),
        });
      } else {
        // drain frames
        for (;;) {
          if (buf.length < 2) break;
          const len0 = buf[1] & 0x7f;
          let off = 2, len = len0;
          if (len0 === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); off = 4; }
          else if (len0 === 127) { if (buf.length < 10) break; len = Number(buf.readBigUInt64BE(2)); off = 10; }
          if (buf.length < off + len) break;
          const frame = buf.slice(off, off + len);
          const opcode = buf[0] & 0x0f;
          buf = buf.slice(off + len);
          if (opcode === 0x8) { socket.end(); break; }
          if (opcode === 0x9) {
            const pm = crypto.randomBytes(4);
            socket.write(Buffer.concat([Buffer.from([0x8a, 0x80 | frame.length]), pm, Buffer.from(frame.map((b, i) => b ^ pm[i % 4]))]));
            continue;
          }
          if (opcode === 0x1) {
            try {
              const msg = JSON.parse(frame.toString('utf8'));
              listeners.forEach((fn) => { try { fn(msg); } catch { /* noop */ } });
            } catch { /* noop */ }
          }
        }
      }
    });
    socket.on('error', reject);
    setTimeout(() => { socket.destroy(); reject(new Error('timeout')); }, 12000);
  });
}

http.get('http://127.0.0.1:9222/json', (res) => {
  let d = '';
  res.on('data', (c) => d += c);
  res.on('end', async () => {
    const page = JSON.parse(d).find((p) => p.type === 'page');
    if (!page) { console.error('no page'); process.exit(1); }
    let nextId = 100;
    const cdp = await cdpSession(page.webSocketDebuggerUrl);
    cdp.on((msg) => {
      if (msg.method === 'Runtime.consoleAPICalled') {
        const args = (msg.params.args || []).map((a) => a.value !== undefined ? JSON.stringify(a.value) : a.description || a.type).join(' ');
        console.log(`[console.${msg.params.type}] ${args.slice(0, 400)}`);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const e = msg.params.exceptionDetails;
        console.log(`[EXCEPTION] ${(e.exception?.description || e.text || '').slice(0, 500)}`);
      } else if (msg.method === 'Log.entryAdded') {
        const e = msg.params.entry;
        console.log(`[${e.level}] ${e.source}: ${(e.text || '').slice(0, 300)} ${e.url || ''}`);
      } else if (msg.method === 'Network.loadingFailed') {
        console.log(`[NET-FAIL] ${msg.params.errorText} (${msg.params.type}) blocked=${msg.params.canceled}`);
      }
    });
    cdp.send({ id: nextId++, method: 'Runtime.enable' });
    cdp.send({ id: nextId++, method: 'Log.enable' });
    cdp.send({ id: nextId++, method: 'Network.enable' });
    cdp.send({ id: nextId++, method: 'Page.enable' });
    cdp.send({ id: nextId++, method: 'Page.reload' });
    setTimeout(() => { cdp.close(); process.exit(0); }, SECONDS * 1000);
  });
});
