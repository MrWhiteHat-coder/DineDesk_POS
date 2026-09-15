/**
 * CDP QA probe — inspects the packaged desktop app's live page state.
 * Usage: node cdp-probe.js "<js expression returning JSON-serializable value>"
 * Requires the app launched with --remote-debugging-port=9222.
 */
const http = require('http');
const crypto = require('crypto');
const net = require('net');

function cdpEval(wsUrl, expr) {
  return new Promise((resolve, reject) => {
    const key = crypto.randomBytes(16).toString('base64');
    const url = new URL(wsUrl);
    const socket = net.connect(+url.port || 9222, url.hostname || '127.0.0.1', () => {
      socket.write(
        `GET ${url.pathname} HTTP/1.1\r\n` +
        `Host: ${url.hostname}:${url.port}\r\n` +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Key: ${key}\r\n` +
        'Sec-WebSocket-Version: 13\r\n\r\n'
      );
    });
    let buf = Buffer.alloc(0);
    let upgraded = false;
    let nextId = 1;
    const pending = new Map();

    const send = (obj) => {
      const payload = Buffer.from(JSON.stringify(obj));
      const mask = crypto.randomBytes(4);
      const masked = Buffer.from(payload.map((b, i) => b ^ mask[i % 4]));
      let header;
      if (payload.length < 126) header = Buffer.from([0x81, 0x80 | payload.length]);
      else if (payload.length < 65536) header = Buffer.from([0x81, 0x80 | 126, payload.length >> 8, payload.length & 0xff]);
      else {
        const big = Buffer.alloc(8);
        big.writeBigUInt64BE(BigInt(payload.length));
        header = Buffer.concat([Buffer.from([0x81, 0x80 | 127]), big]);
      }
      socket.write(Buffer.concat([header, mask, masked]));
    };

    const handleFrame = () => {
      if (buf.length < 2) return false;
      const len0 = buf[1] & 0x7f;
      let off = 2, len = len0;
      if (len0 === 126) { if (buf.length < 4) return false; len = buf.readUInt16BE(2); off = 4; }
      else if (len0 === 127) { if (buf.length < 10) return false; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (buf.length < off + len) return false;
      const frame = buf.slice(off, off + len);
      const opcode = buf[0] & 0x0f;
      buf = buf.slice(off + len);
      if (opcode === 0x8) { socket.end(); return false; }
      if (opcode === 0x9) { // ping → pong (masked)
        const pm = crypto.randomBytes(4);
        const maskedP = Buffer.from(frame.map((b, i) => b ^ pm[i % 4]));
        socket.write(Buffer.concat([Buffer.from([0x8a, 0x80 | frame.length]), pm, maskedP]));
        return true;
      }
      if (opcode === 0x1) {
        try {
          const msg = JSON.parse(frame.toString('utf8'));
          if (msg.id && pending.has(msg.id)) {
            const { resolve: res, reject: rej } = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) rej(new Error(msg.error.message));
            else res(msg.result);
          }
        } catch { /* ignore */ }
      }
      return true;
    };

    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (!upgraded) {
        const idx = buf.indexOf('\r\n\r\n');
        if (idx === -1) return;
        const head = buf.slice(0, idx).toString();
        if (!/101/.test(head.split('\r\n')[0])) { reject(new Error('handshake: ' + head.split('\r\n')[0])); return; }
        upgraded = true;
        buf = buf.slice(idx + 4);
        send({ id: nextId, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } });
        pending.set(nextId, { resolve: (r) => { resolve(r?.result?.value !== undefined ? r.result.value : r); socket.end(); }, reject });
      } else {
        while (handleFrame()) { /* drain */ }
      }
    });
    socket.on('error', reject);
    setTimeout(() => { socket.destroy(); reject(new Error('CDP timeout (12s)')); }, 12000);
  });
}

const expr = process.argv[2] || 'JSON.stringify({href: location.href})';
http.get('http://127.0.0.1:9222/json', (res) => {
  let d = '';
  res.on('data', (c) => d += c);
  res.on('end', async () => {
    const page = JSON.parse(d).find((p) => p.type === 'page');
    if (!page) { console.error('no page target'); process.exit(1); }
    try {
      const r = await cdpEval(page.webSocketDebuggerUrl, expr);
      console.log(typeof r === 'string' ? r : JSON.stringify(r, null, 1));
    } catch (e) { console.error('CDP error:', e.message); process.exit(1); }
    process.exit(0);
  });
}).on('error', (e) => { console.error('no dev server:', e.message); process.exit(1); });
