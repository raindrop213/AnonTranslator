import http from 'node:http';
import { readFile } from 'node:fs/promises';

const pages = new Map([
  ['/', ['preview.html', 'text/html;charset=utf-8']],
  ['/preview.js', ['preview.js', 'text/javascript;charset=utf-8']],
  ['/content.js', ['../dist/extension/content.js', 'text/javascript;charset=utf-8']],
  ['/anki-preview.html', ['../dist/extension/anki-preview.html', 'text/html;charset=utf-8']],
  ['/userscript.js', ['../dist/tampermonkey/AnonTranslator.user.js', 'text/javascript;charset=utf-8']]
]);
const server = http.createServer(async (request, response) => {
  const page = pages.get(new URL(request.url, 'http://127.0.0.1').pathname);
  if (!page) { response.writeHead(404); response.end(); return; }
  try {
    const content = await readFile(new URL(page[0], import.meta.url));
    response.writeHead(200, { 'Content-Type': page[1], 'Cache-Control': 'no-store' });
    response.end(content);
  } catch {
    response.writeHead(500); response.end('请先运行 npm run build');
  }
});
server.listen(Number(process.env.AT_PREVIEW_PORT) || 8788, '127.0.0.1', () => {
  console.log(`本地预览：http://127.0.0.1:${server.address().port}/`);
});
