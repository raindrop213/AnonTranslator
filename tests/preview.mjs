import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const pages = new Map([
  ['/', ['preview.html', 'text/html;charset=utf-8']],
  ['/preview.js', ['preview.js', 'text/javascript;charset=utf-8']],
  ['/glass-lab.js', ['glass-lab.js', 'text/javascript;charset=utf-8']],
  ['/word-colors.html', ['word-colors.html', 'text/html;charset=utf-8']],
  ['/widget-layers.html', ['widget-layers.html', 'text/html;charset=utf-8']],
  ['/content.js', ['../dist/extension/content.js', 'text/javascript;charset=utf-8']],
  ['/anki-preview.html', ['../dist/extension/anki-preview.html', 'text/html;charset=utf-8']],
  ['/userscript.js', ['../dist/tampermonkey/AnonTranslator.user.js', 'text/javascript;charset=utf-8']]
]);
const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (pathname === '/glass-fixture.js' || pathname === '/word-colors.js' || pathname === '/widget-layers.js') {
    try {
      const entry = pathname.slice(1);
      const result = await build({ entryPoints: [fileURLToPath(new URL(entry, import.meta.url))], bundle: true, write: false, format: 'iife', target: 'chrome116', charset: 'utf8', loader: { '.css': 'text', '.html': 'text', '.png': 'dataurl' } });
      response.writeHead(200, { 'Content-Type': 'text/javascript;charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(result.outputFiles[0].contents);
    } catch (error) { response.writeHead(500); response.end('样例构建失败：' + error.message); }
    return;
  }
  const page = pages.get(pathname);
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
