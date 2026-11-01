import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
delete process.env.TURSO_DATABASE_URL;delete process.env.CATALOG_MODE;delete process.env.VERCEL;
const {default:media}=await import('../api/local-media.js');
const entry=JSON.parse(readFileSync(new URL('../server/bot-catalog.json',import.meta.url),'utf8')).movies.find(m=>m.available&&m.cache_key);
test('local media supports ranged and suffix reads, HEAD and invalid ranges without loading the whole video',async()=>{
 assert.ok(entry,'exported media fixture exists');
 const server=createServer((req,res)=>media(req,res));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port+'/api/local-media?id='+entry.id;
 try{
  const ranged=await fetch(base,{headers:{Range:'bytes=0-1023'}});assert.equal(ranged.status,206);assert.equal((await ranged.arrayBuffer()).byteLength,1024);assert.match(ranged.headers.get('content-range'),/^bytes 0-1023\//);
  const head=await fetch(base,{method:'HEAD'});assert.equal(head.status,200);assert.ok(Number(head.headers.get('content-length'))>1024);assert.equal((await head.arrayBuffer()).byteLength,0);
  const suffix=await fetch(base,{headers:{Range:'bytes=-16'}});assert.equal(suffix.status,206);assert.equal((await suffix.arrayBuffer()).byteLength,16);
  const invalid=await fetch(base,{headers:{Range:'bytes=999999999999-'}});assert.equal(invalid.status,416);
  const missing=await fetch(base.replace('id='+entry.id,'id=9999999'));assert.equal(missing.status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
