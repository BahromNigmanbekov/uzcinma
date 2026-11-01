import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {servePublicMedia} from '../server/serve-media.js';
test('newly uploaded images are served immediately as images without SPA HTML fallback',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'uzcinma-public-media-'));
 const server=createServer((req,res)=>servePublicMedia(req,res,directory));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const image=Buffer.from([255,216,255,217]);
 try{
  assert.equal((await fetch(base+'/media/banner-new.jpg')).status,404);
  writeFileSync(join(directory,'banner-new.jpg'),image);
  const response=await fetch(base+'/media/banner-new.jpg');
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/jpeg');assert.deepEqual(Buffer.from(await response.arrayBuffer()),image);
  const head=await fetch(base+'/media/banner-new.jpg',{method:'HEAD'});assert.equal(head.headers.get('content-length'),'4');assert.equal((await head.arrayBuffer()).byteLength,0);
  const part=await fetch(base+'/media/banner-new.jpg',{headers:{Range:'bytes=1-2'}});assert.equal(part.status,206);assert.equal((await part.arrayBuffer()).byteLength,2);
  assert.equal((await fetch(base+'/media/%2E%2E%2Fprivate.txt')).status,404);
  assert.equal((await fetch(base+'/media/banner-missing.jpg')).status,404);
 }finally{
  await new Promise(resolve=>server.close(resolve));
  if(dirname(directory)===tmpdir()&&basename(directory).startsWith('uzcinma-public-media-'))rmSync(directory,{recursive:true,force:true});
 }
});
