import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml']
]);

createServer(async (request, response) => {
  const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
  const requested = pathname === '/' ? '/index.html' : pathname;
  const file = resolve(root, `.${decodeURIComponent(requested)}`);
  if (!file.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const content = await readFile(file);
    response.writeHead(200, {
      'content-type': types.get(extname(file)) || 'application/octet-stream',
      'cache-control': 'no-store'
    }).end(content);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}).listen(4173, '127.0.0.1', () => {
  console.log('Stay & Play test server listening on http://127.0.0.1:4173');
});
