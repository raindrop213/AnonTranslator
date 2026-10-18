import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createTokenizer } from '../src/services/tokenize.js';
import { lookupWord } from '../src/services/dictionary.js';
import { fetchRequest } from '../src/services/request.js';
import { createMockAnki } from './mock-anki.mjs';
import { cachedTranslation } from '../src/services/translate.js';
const anki = createMockAnki();
const tokenize=createTokenizer(file=>readFile(new URL(`../node_modules/kuromoji/dict/${file}`,import.meta.url)));
http.createServer(async(req,res)=>{
  if(req.url==='/native-reader.html'||req.url==='/native-reader.js'){
    const isScript=req.url.endsWith('.js');
    res.writeHead(200,{'Content-Type':isScript?'text/javascript':'text/html;charset=utf-8','Cache-Control':'no-store'});
    res.end(await readFile(new URL(isScript?'native-reader-fixture.js':'native-reader-fixture.html',import.meta.url)));return;
  }
  if(req.url==='/settings-size.html'||req.url==='/settings-size.js'){
    const isScript=req.url.endsWith('.js');
    res.writeHead(200,{'Content-Type':isScript?'text/javascript':'text/html;charset=utf-8','Cache-Control':'no-store'});
    res.end(await readFile(new URL(isScript?'settings-size-fixture.js':'settings-size-fixture.html',import.meta.url)));return;
  }
  if(req.url.startsWith('/settings.html')){
    res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
    res.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>设置面板验证</title><body><script type="module" src="/settings.js"></script></body></html>');return;
  }
  if(req.url==='/settings.js'){
    const bundle=await build({entryPoints:[fileURLToPath(new URL('settings-fixture.js',import.meta.url))],bundle:true,format:'esm',target:'chrome116',write:false,loader:{'.css':'text','.jpg':'dataurl'}});
    res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(bundle.outputFiles[0].contents);return;
  }
  if(req.url==='/interaction.html'){
    res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
    res.end(await readFile(new URL('interaction-fixture.html',import.meta.url)));return;
  }
  if(req.url==='/interaction.js'){
    const bundle=await build({entryPoints:[fileURLToPath(new URL('interaction-fixture.js',import.meta.url))],bundle:true,format:'esm',target:'chrome116',write:false,loader:{'.css':'text','.jpg':'dataurl'}});
    res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(bundle.outputFiles[0].contents);return;
  }
  if(req.url==='/layout.html'){
    res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
    res.end(await readFile(new URL('layout-fixture.html',import.meta.url)));return;
  }
  if(req.url==='/layout.js'){
    const bundle=await build({entryPoints:[fileURLToPath(new URL('layout-fixture.js',import.meta.url))],bundle:true,format:'esm',target:'chrome116',write:false,loader:{'.css':'text','.jpg':'dataurl'}});
    res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(bundle.outputFiles[0].contents);return;
  }
  if(req.url==='/anki-preview.html'){
    res.writeHead(200,{'Content-Type':'text/html','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; frame-src about: 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'"});
    res.end(await readFile(new URL('../src/platform/anki-preview.html',import.meta.url)));return;
  }
  if(req.url==='/anki-state'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(anki.snapshot()));return;}
  if(req.url==='/test-image.png'){res.writeHead(200,{'Content-Type':'image/png'});res.end(await readFile(new URL('../assets/img/icon128.png',import.meta.url)));return;}
  if(req.url==='/'){const html=await readFile(new URL('browser-fixture.html',import.meta.url));res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Content-Security-Policy':"script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; object-src 'none'"});res.end(html);return;}
  if(req.url==='/fixture.js'){
    const bundle=await build({entryPoints:[fileURLToPath(new URL('browser-fixture.js',import.meta.url))],bundle:true,format:'esm',target:'chrome116',write:false,loader:{'.css':'text','.jpg':'dataurl'}});
    res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(bundle.outputFiles[0].contents);return;
  }
  if(req.url==='/api'&&req.method==='POST'){
    try{let body='';for await(const chunk of req)body+=chunk;const message=JSON.parse(body);const value=message.action==='tokenize'?await tokenize(message.text):message.action.startsWith('anki_')?await anki.service.send(message):message.action==='translate'?await cachedTranslation(message,fetchRequest):await lookupWord(message,fetchRequest);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(value));}catch(error){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}return;
  }
  res.writeHead(404);res.end();
}).listen(Number(process.env.AT_TEST_PORT)||8770,'127.0.0.1',function(){console.log(`Local: http://127.0.0.1:${this.address().port}/`);});
