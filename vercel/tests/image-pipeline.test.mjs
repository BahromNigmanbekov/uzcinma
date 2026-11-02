import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
process.env.TURSO_DATABASE_URL='file::memory:';
process.env.TURSO_AUTH_TOKEN='';
process.env.BOT_TOKEN='test-only';
process.env.ADMIN_USER_ID='123';
const {database}=await import('../server/core.js');
const {ensureSchema}=await import('../server/schema.js');
const {default:poster}=await import('../api/poster.js');
const {processMessage}=await import('../server/bot.js');
const {MAX_IMAGE_BYTES}=await import('../server/image-media.js');
const db=database();await ensureSchema(db);
await db.execute("INSERT INTO movies(id,file_unique_id,title,poster_file_id,banner_file_id,created_at,updated_at) VALUES(1,'test-film','Film','poster-id','banner-id',1,1)");
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
test('poster API preserves document bytes and returns the detected PNG/WebP/JPEG type',async()=>{
 const original=global.fetch;let body=png,size=png.length,fileRequests=0;
 global.fetch=async(url,options)=>{
  if(String(url).startsWith('http://127.0.0.1'))return original(url,options);
  if(String(url).endsWith('/getFile'))return Response.json({ok:true,result:{file_path:'documents/original-image',file_size:size}});
  fileRequests++;return new Response(body,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(body.length)}});
 };
 const server=createServer((req,res)=>poster(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port+'/api/poster?id=1';
 try{
  for(const [bytes,mime]of [[png,'image/png'],[Buffer.from('RIFF0000WEBPoriginal-bytes'),'image/webp'],[Buffer.from([255,216,255,224,10,20,255,217]),'image/jpeg']]){
   body=bytes;size=bytes.length;const response=await fetch(base+'&kind=banner');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),mime);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
  }
  body=Buffer.from('<svg onload="bad"/>');size=body.length;assert.equal((await fetch(base)).status,400);
  size=MAX_IMAGE_BYTES+1;const previous=fileRequests;assert.equal((await fetch(base)).status,413);assert.equal(fileRequests,previous);
 }finally{global.fetch=original;server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('banner image documents update artwork without becoming movies; oversized files leave artwork intact',async()=>{
 const msg={chat:{type:'private',id:123},from:{id:123},caption:'/banner 1',document:{file_id:'original-document',file_unique_id:'image-unique',mime_type:'image/png',file_name:'banner.png',file_size:1234}};
 assert.equal(await processMessage(db,msg),'Banner saqlandi.');
 const row=(await db.execute('SELECT banner_file_id,poster_file_id FROM movies WHERE id=1')).rows[0];assert.equal(row.banner_file_id,'original-document');assert.equal(row.poster_file_id,'poster-id');assert.equal(Number((await db.execute('SELECT COUNT(*) AS n FROM movies')).rows[0].n),1);
 assert.match(await processMessage(db,{...msg,document:{...msg.document,file_size:MAX_IMAGE_BYTES+1}}),/2 MB/);
 assert.equal((await db.execute('SELECT banner_file_id FROM movies WHERE id=1')).rows[0].banner_file_id,'original-document');
 assert.equal(await processMessage(db,{...msg,from:{id:456}}),null);
});
