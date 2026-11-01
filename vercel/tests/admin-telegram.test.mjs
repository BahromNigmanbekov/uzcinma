import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {uploadToTelegram} from '../server/admin-telegram.js';
test('multipart Telegram transport streams bytes and reports real API rejections',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'uzcinma-transport-')),path=join(directory,'video.mp4');const bytes=Buffer.alloc(1024*1024,7);await writeFile(path,bytes);
 let rejectNext=false,requests=0,lastSize=0,lastPath='',lastBody;
 const server=createServer(async(req,res)=>{
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;chunks.push(chunk);}lastBody=Buffer.concat(chunks);lastSize=size;lastPath=req.url;requests++;
  assert.equal(size,Number(req.headers['content-length']));res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify(rejectNext?{ok:false,description:'Bad Request: file is too big'}:{ok:true,result:{message_id:1,chat:{id:123},video:{file_id:'f',file_unique_id:'u'}}}));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;const updates=[];
 const options={base,token:'test-only',chatId:123,kind:'video',path,filename:'video.mp4',mime:'video/mp4',caption:'Test',progress:n=>updates.push(n)};
 try{
  const result=await uploadToTelegram(options);assert.equal(result.message_id,1);assert.ok(updates.length>1);assert.equal(updates.at(-1),bytes.length);assert.ok(lastSize>bytes.length);
  await uploadToTelegram({...options,filename:'video.webm'});assert.ok(lastPath.endsWith('/sendDocument'));
  const photo=Buffer.alloc(150000,29),photoProgress=[];await uploadToTelegram({...options,kind:'banner',path:undefined,data:photo,filename:'banner.jpg',mime:'image/jpeg',progress:n=>photoProgress.push(n)});assert.ok(lastPath.endsWith('/sendPhoto'));assert.ok(lastBody.includes(photo));assert.equal(photoProgress.at(-1),photo.length);
  rejectNext=true;await assert.rejects(()=>uploadToTelegram(options),/file is too big/);assert.equal(requests,4);
 }finally{await new Promise(resolve=>server.close(resolve));if(dirname(directory)===tmpdir()&&basename(directory).startsWith('uzcinma-transport-'))await rm(directory,{recursive:true,force:true});}
});
