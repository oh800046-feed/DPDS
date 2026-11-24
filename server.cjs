const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const page = fs.readFileSync(path.join(__dirname, 'index.html'));
const routes = new Map(['/api/bdi', '/api/cbot/grains', '/api/cot/grains', '/api/ecos/fx', '/api/kamis/domestic']
  .map(route => [route, require('.' + route)]));
const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const pathname = req.url.split('?')[0];
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(page);
    return;
  }
  const handler = routes.get(pathname);
  if (!handler) return res.writeHead(404).end();
  res.status = code => { res.statusCode = code; return res; };
  res.json = data => res.end(JSON.stringify(data));
  try { await handler(req, res); }
  catch { if (!res.headersSent) res.writeHead(500); res.end(); }
});
server.on('error', error => { console.error(error.message); process.exit(1); });
server.listen(8080, '0.0.0.0', () => {
  console.log('DPDS v48   http://localhost:8080');
  for (const nic of Object.values(os.networkInterfaces()).flat()) {
    if (nic.family === 'IPv4' && !nic.internal) console.log('LAN: http://' + nic.address + ':8080');
  }
  console.log('Keep this window open. Press Ctrl+C to stop.');
});
