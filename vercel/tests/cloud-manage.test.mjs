import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@libsql/client';
import {createServer} from 'node:http';
import {scryptSync} from 'node:crypto';
import {ensureSchema} from '../server/schema.js';
import {createCloudManage} from '../server/cloud-manage.js';
import {liveHome} from '../server/live-catalog.js';
const password='known-test-password-123',salt='a'.repeat(32);
const metadata={title:'Updated film',description:'Description',genres:['anime','fantasy'],type:'anime',year:2026,rating:8.5};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
async function fixture({failTransport=0,failSaving=false,authConfigured=true}={}){
 const db=createClient({url:'file::memory:'});await ensureSchema(db);
 await db.execute({sql:'INSERT INTO movies(id,file_unique_id,file_id,title,description,file_size,source_message_id,created_at,updated_at) VALUES(1,?,?,?,?,?,?,?,?)',args:['unique','private-video-id','Existing film','',100,12,1,1]});
 let clock=Date.now(),origin,calls=0,fail=failSaving;
 const config={ADMIN_PASSWORD_HASH:authConfigured?JSON.stringify({salt,hash:scryptSync(password,salt,64).toString('hex')}):'',BOT_TOKEN:'not-a-real-bot-token',ADMIN_USER_ID:'123'};
 const wrapped={execute:(...args)=>db.execute(...args),batch:(statements,...args)=>{
  if(fail&&statements.some(statement=>typeof statement==='object'&&statement.sql.startsWith('UPDATE movies SET banner_file_id'))){fail=false;return Promise.reject(Error('Injected save failure'));}
  return db.batch(statements,...args);
 }};
 const options={db:wrapped,config,now:()=>clock,telegramCheck:async()=>({ok:true,result:{username:'uzcinma_test_bot'}}),transport:async input=>{
  calls++;assert.ok(Buffer.isBuffer(input.data));assert.ok(input.data.length>0);assert.deepEqual(input.data,png);input.progress(input.data.length,input.data.length);
  if(calls<=failTransport)throw Error('Injected Telegram failure');
  return {document:{file_id:'private-document-'+input.kind+'-'+calls,file_unique_id:'image-'+calls,mime_type:input.mime,file_size:input.data.length}};
 }};
 let service=createCloudManage(options),cookie='',csrf='';
 const server=createServer((req,res)=>{req.query=Object.fromEntries(new URL(req.url,'http://localhost').searchParams);service.handle(req,res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;config.APP_ORIGIN=origin;
 async function request(path,{method='GET',body,raw,authenticated=true,withCsrf=true,requestOrigin=origin,ip='127.0.0.1'}={}){
  const response=await fetch(origin+'/api/manage'+path,{method,headers:{...(authenticated&&cookie?{cookie}:{}),...(!['GET','HEAD'].includes(method)?{origin:requestOrigin,...(withCsrf?{'x-csrf-token':csrf}:{})}:{}),'x-real-ip':ip,...(body?{'content-type':'application/json'}:raw?{'content-type':'application/octet-stream'}:{})},body:raw??(body?JSON.stringify(body):undefined)});
  const data=await response.json(),setCookie=response.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0];if(data.csrf)csrf=data.csrf;
  return {status:response.status,data,headers:response.headers};
 }
 return {db,config,request,login:()=>request('/login',{method:'POST',body:{password}}),restart:()=>service=createCloudManage(options),advance:ms=>clock+=ms,get calls(){return calls;},close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));db.close();}};
}
test('cloud admin fails closed, persists sessions across restarts, protects writes and revokes logout',async()=>{
 const empty=await fixture({authConfigured:false});try{assert.equal((await empty.request('/session')).status,503);assert.equal((await empty.request('/setup',{method:'POST',body:{password}})).status,503);}finally{await empty.close();}
 const f=await fixture();
 try{
  assert.equal((await f.request('/session')).data.setup_required,false);
  assert.equal((await f.request('/movies',{authenticated:false})).status,401);
  assert.equal((await f.request('/login',{method:'POST',body:{password},requestOrigin:'https://attacker.example'})).status,403);
  const login=await f.login();assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.match(login.headers.get('set-cookie'),/SameSite=Strict/);
  f.restart();assert.equal((await f.request('/session')).data.authenticated,true);
  assert.equal((await f.request('/movies/1',{method:'PATCH',body:metadata,withCsrf:false})).status,403);
  assert.equal((await f.request('/movies/1',{method:'PATCH',body:metadata,requestOrigin:'https://attacker.example'})).status,403);
  assert.equal((await f.request('/movies/1',{method:'PATCH',body:metadata})).status,200);
  const result=await f.request('/movies');assert.equal(result.data.movies[0].title,'Updated film');assert.equal(JSON.stringify(result.data).includes('private-video-id'),false);
  assert.equal((await f.request('/logout',{method:'POST'})).status,200);assert.equal((await f.request('/movies')).status,401);
  await f.login();f.advance(9*3600000);assert.equal((await f.request('/movies')).status,401);
 }finally{await f.close();}
});
test('home selection is atomic and changes the public live homepage; hide and restore persist',async()=>{
 const f=await fixture();
 try{
  await f.login();
  assert.equal((await f.request('/home',{method:'POST',body:{hero_ids:['1'],recommendation_ids:['999']}})).status,404);
  assert.deepEqual((await liveHome(f.db)).hero,null);
  assert.equal((await f.request('/home',{method:'POST',body:{hero_ids:['1'],recommendation_ids:[]}})).status,200);
  assert.equal((await liveHome(f.db)).hero[0].id,'1');
  await f.request('/movies/1',{method:'PATCH',body:{deleted:true}});assert.deepEqual((await liveHome(f.db)).hero,[]);
  assert.equal((await f.request('/movies')).data.movies[0].deleted,true);
  await f.request('/movies/1',{method:'PATCH',body:{deleted:false}});assert.equal((await liveHome(f.db)).hero[0].id,'1');
  assert.equal((await f.request('/jobs',{method:'POST',body:{kind:'video',size:100,filename:'film.mp4',movie_id:1}})).status,400);
 }finally{await f.close();}
});
test('image uploads survive a function restart, retry after acceptance without resending and clear static artwork',async()=>{
 const f=await fixture({failTransport:1,failSaving:true});
 try{
  await f.login();
  await f.db.execute("UPDATE movies SET backdrop_url='/media/old.jpg' WHERE id=1");
  const created=await f.request('/jobs',{method:'POST',body:{kind:'banner',size:png.length,filename:'banner.png',mime:'image/png',movie_id:1}});
  assert.equal(created.status,201);const id=created.data.job.id;f.restart();
  let result=await f.request('/jobs/'+id+'/file',{method:'PUT',raw:png});assert.equal(result.data.job.stage,'error');assert.equal(result.data.job.can_retry,true);
  f.restart();result=await f.request('/jobs/'+id+'/retry',{method:'POST'});assert.equal(result.data.job.stage,'error');assert.equal(result.data.job.accepted_by_telegram,true);assert.equal(f.calls,2);
  f.restart();result=await f.request('/jobs/'+id+'/retry',{method:'POST'});assert.equal(result.data.job.stage,'done');assert.equal(f.calls,2);
  const row=(await f.db.execute('SELECT banner_file_id,backdrop_url FROM movies WHERE id=1')).rows[0];assert.ok(row.banner_file_id);assert.equal(row.backdrop_url,null);
  const jobs=(await f.request('/jobs')).data.jobs;assert.equal(jobs[0].stage,'done');assert.equal(JSON.stringify(jobs).includes('private-document'),false);
  const poster=await f.request('/jobs',{method:'POST',body:{kind:'poster',size:png.length,filename:'poster.png',mime:'image/png',movie_id:1}});
  await f.request('/jobs/'+poster.data.job.id+'/file',{method:'PUT',raw:png});
  assert.ok((await f.db.execute('SELECT poster_file_id FROM movies WHERE id=1')).rows[0].poster_file_id);
 }finally{await f.close();}
});
test('invalid images and oversized uploads are rejected; login throttling persists across instances',async()=>{
 const f=await fixture();
 try{
  await f.login();
  assert.equal((await f.request('/jobs',{method:'POST',body:{kind:'poster',size:3*1024*1024,filename:'poster.png',movie_id:1}})).status,413);
  const created=await f.request('/jobs',{method:'POST',body:{kind:'poster',size:4,filename:'poster.png',movie_id:1}});
  assert.equal((await f.request('/jobs/'+created.data.job.id+'/file',{method:'PUT',raw:Buffer.from('html')})).status,400);
  for(let i=0;i<8;i++){f.restart();await f.request('/login',{method:'POST',body:{password:'wrong'}});}
  assert.equal((await f.request('/login',{method:'POST',body:{password:'wrong'}})).status,429);
  f.advance(16*60000);assert.equal((await f.login()).status,200);
 }finally{await f.close();}
});
