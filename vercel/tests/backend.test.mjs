process.env.CATALOG_MODE='database';
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
process.env.TURSO_DATABASE_URL='file::memory:';process.env.TURSO_AUTH_TOKEN='';
process.env.ADMIN_USER_ID='123';process.env.DEMO_MODE='0';
process.env.TELEGRAM_WEBHOOK_SECRET='test-secret-not-production';
const {database,authorize,publicURL}=await import('../server/core.js');
const {processMessage,processUpdate}=await import('../server/bot.js');
const {default:catalog}=await import('../api/catalog.js');
const {default:playback}=await import('../api/playback.js');
const {default:webhook}=await import('../api/telegram.js');
const {default:admin}=await import('../api/admin.js');
const db=database();await db.batch(readFileSync(new URL('../server/schema.sql',import.meta.url),'utf8').split(';').map(s=>s.trim()).filter(Boolean),'write');
const message=(text,extra={})=>({chat:{id:123,type:'private'},from:{id:123},text,...extra});
async function api(handler,query={},extra={}){
 let body;const headers={};const res={setHeader:(k,v)=>{headers[k]=v;},end:s=>{body=JSON.parse(s);}};
 await handler({method:'GET',query,headers:{},...extra},res);return {status:res.statusCode,body,headers};
}
let id;
test('admin authorization rejects other users and secret mismatches',async()=>{
 assert.equal(await processMessage(db,{...message('/start'),from:{id:456}}),null);
 assert.equal(authorize('',undefined),false);assert.equal(authorize('abc','abcd'),false);assert.equal(authorize('same','same'),true);
 const r=await api(webhook,{}, {method:'POST',body:{update_id:999},headers:{'x-telegram-bot-api-secret-token':'bad'}});
 assert.equal(r.status,401);assert.equal((await db.execute('SELECT COUNT(*) AS n FROM telegram_updates')).rows[0].n,0);
});
test('upload accepts >2GB metadata, preserves edits on duplicate upload',async()=>{
 const upload=message('',{video:{file_unique_id:'unique',file_id:'secret-telegram-file',file_name:'film.mp4',file_size:3*1024**3,duration:600},caption:'Katta film\nTavsif'});
 assert.match(await processMessage(db,upload),/ID:/);
 const row=(await db.execute('SELECT * FROM movies')).rows[0];id=Number(row.id);assert.equal(row.file_size,3*1024**3);
 await processMessage(db,message('/title '+id+' Changed'));
 await processMessage(db,upload);
 assert.equal((await db.execute('SELECT COUNT(*) AS n FROM movies')).rows[0].n,1);
 assert.equal((await db.execute('SELECT title FROM movies')).rows[0].title,'Changed');
 const r=await api(catalog);assert.equal(r.body.movies[0].available,false);
 assert.equal(JSON.stringify(r.body).includes('secret-telegram-file'),false);
 assert.equal(r.headers['Cache-Control'].includes('s-maxage'),true);
});
test('categories, sorting, rating and parameterized search work',async()=>{
 await processMessage(db,message('/genre '+id+' anime,fantasy'));
 await processMessage(db,message('/meta '+id+' 2020 8.5 anime'));
 assert.equal((await api(catalog,{genre:'anime',rating:'8',type:'anime'})).body.total,1);
 assert.equal((await api(catalog,{rating:'9'})).body.total,0);
 assert.equal((await api(catalog,{q:"' OR 1=1 --"})).body.total,0);
 assert.equal((await api(catalog,{ids:String(id)})).body.total,1);
 assert.equal((await api(catalog,{ids:''})).body.total,0);
 const r=await api(catalog,{limit:'100000'});assert.equal(r.status,200);
});
test('quality sources are real HTTPS URLs; removal and playback visibility work',async()=>{
 assert.equal(publicURL('http://example.com/video.mp4'),null);
 assert.equal(publicURL('https://token:secret@example.com/video.mp4'),null);
 assert.equal(publicURL('https://127.0.0.1/video.mp4'),null);
 assert.equal((await api(playback,{id:String(id)})).status,409);
 await processMessage(db,message('/source '+id+' 480 https://cdn.example.com/480.mp4'));
 await processMessage(db,message('/source '+id+' 720 https://cdn.example.com/720.mp4'));
 let r=await api(playback,{id:String(id)});assert.equal(r.body.kind,'files');assert.deepEqual(r.body.variants.map(v=>v.quality),['480','720']);
 assert.equal((await api(catalog)).body.movies[0].available,true);
 await processMessage(db,message('/unsource '+id+' 480'));
 assert.equal((await api(playback,{id:String(id)})).body.variants.length,1);
 await processMessage(db,message('/source '+id+' hls https://cdn.example.com/master.m3u8'));
 assert.equal((await api(playback,{id:String(id)})).body.kind,'hls');
 await processMessage(db,message('/delete '+id));assert.equal((await api(catalog)).body.total,0);assert.equal((await api(playback,{id:String(id)})).status,404);
 await processMessage(db,message('/restore '+id));assert.equal((await api(catalog)).body.total,1);
});
test('webhook is idempotent and concurrent in-progress delivery stays retryable',async()=>{
 const update={update_id:100,message:message('/title '+id+' Webhook title')};
 assert.match(await processUpdate(db,update),/Saqlandi/);assert.equal(await processUpdate(db,update),null);
 await db.execute({sql:"INSERT INTO telegram_updates(id,status,lease_until) VALUES(101,'processing',?)",args:[Math.floor(Date.now()/1000)+60]});
 await assert.rejects(()=>processUpdate(db,{update_id:101,message:message('/start')}),/already processing/);
 const failing={update_id:102,message:message('',{video:{file_unique_id:'bad',file_size:{not:'a number'}}})};
 await assert.rejects(()=>processUpdate(db,failing));
 assert.equal((await db.execute('SELECT status FROM telegram_updates WHERE id=102')).rows[0].status,'pending');
 assert.match(await processUpdate(db,{update_id:102,message:message('/start')}),/Film yuboring/);
});
test('protected admin endpoint never permits an empty bearer secret',async()=>{
 delete process.env.ADMIN_API_SECRET;
 assert.equal((await api(admin,{}, {method:'POST',body:{movie_id:id,quality:'1080',url:'https://cdn.example.com/1080.mp4'},headers:{authorization:'Bearer '}})).status,401);
 process.env.ADMIN_API_SECRET='test-admin';
 assert.equal((await api(admin,{}, {method:'POST',body:{movie_id:id,quality:'1080',url:'https://cdn.example.com/1080.mp4'},headers:{authorization:'Bearer test-admin'}})).status,200);
 assert.equal((await api(playback,{id:'not-an-id'})).status,400);
});
after(()=>db.close());
