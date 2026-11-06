import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@libsql/client';
import {scryptSync} from 'node:crypto';
import {ensureSchema} from '../server/schema.js';
import {createTMDBService,getCredits,saveManualCredits,removeTMDBCredits,tmdbImage} from '../server/credits.js';
import {createCloudManage} from '../server/cloud-manage.js';
import {createCollection,attachEpisode,titleDetails} from '../server/series.js';
import {processMessage} from '../server/bot.js';
const token='fixture-tmdb-token-that-is-not-a-real-credential',password='fixture-admin-password',salt='d'.repeat(32);
async function fixture(){
 const db=createClient({url:'file::memory:'});await ensureSchema(db);await db.execute("INSERT INTO movies(id,title,created_at,updated_at) VALUES(1,'Owner title',1,1),(2,'Second',1,1)");
 const calls=[],config={ADMIN_API_SECRET:'fixture-encryption-secret',APP_ORIGIN:'https://admin.fixture',ADMIN_PASSWORD_HASH:JSON.stringify({salt,hash:scryptSync(password,salt,64).toString('hex')})};
 let fail=null;
 const fetchImpl=async(url,options)=>{
  assert.equal(url.origin,'https://api.themoviedb.org');calls.push({path:url.pathname,params:Object.fromEntries(url.searchParams),headers:options.headers});
  if(fail)return new Response(JSON.stringify({status_message:'provider response with '+token}),{status:fail});
  if(options.headers.Authorization!=='Bearer '+token&&url.searchParams.get('api_key')!=='a'.repeat(32))return new Response('{}',{status:401});
  if(url.pathname==='/3/configuration')return Response.json({images:{secure_base_url:'https://image.tmdb.org/t/p/'}});
  if(url.pathname.startsWith('/3/search/'))return Response.json({page:1,total_pages:2,results:[
   {id:77,media_type:'movie',title:'Right Film',release_date:'2024-01-01',poster_path:'/abc.jpg',overview:'Story'},
   {id:88,media_type:'tv',name:'Right Series',first_air_date:'2020-01-01',poster_path:'/def.jpg'},
   {id:99,media_type:'person',name:'Not a title'},
   {id:100,media_type:'movie',adult:true,title:'Excluded'}
  ]});
  if(url.pathname==='/3/movie/77')return Response.json({id:77,title:'Right Film',release_date:'2024-01-01',adult:false});
  if(url.pathname==='/3/movie/77/credits')return Response.json({cast:[
   {id:9,name:'Actor Two',character:'Second role',profile_path:'/actor-two.jpg',order:1},
   {id:8,name:'Actor One',character:'First role',profile_path:'/actor-one.jpg',order:0},
   {id:8,name:'Actor One',character:'Duplicate',profile_path:'/actor-one.jpg',order:0}
  ],crew:[{id:30,name:'The Director',job:'Director',profile_path:'/director.jpg'},{id:31,name:'The Producer',job:'Producer'}]});
  if(url.pathname==='/3/tv/88')return Response.json({id:88,name:'Right Series',first_air_date:'2020-01-01'});
  if(url.pathname==='/3/tv/88/aggregate_credits')return Response.json({cast:[{id:8,name:'Series Actor',roles:[{character:'Main character',episode_count:8},{character:'Voice role',episode_count:2}],order:0}],crew:[{id:40,name:'Series Director',jobs:[{job:'Director',episode_count:3},{job:'Writer',episode_count:2}]},{id:41,name:'Writer Only',jobs:[{job:'Writer'}]}]});
  return new Response('{}',{status:404});
 };
 const service=createTMDBService({db,config,fetchImpl});return {db,config,calls,fetchImpl,service,setFailure:value=>fail=value,close:()=>db.close()};
}
test('TMDB credentials are validated, encrypted, survive restarts and are never returned to clients',async()=>{
 const f=await fixture();try{
  assert.equal((await f.service.status()).configured,false);await assert.rejects(()=>f.service.search('Film'),e=>e.status===503);
  await assert.rejects(()=>f.service.connect('invalid-but-long-enough-credential'),e=>e.status===422);
  assert.equal((await f.db.execute("SELECT COUNT(*) AS n FROM site_settings WHERE key='tmdb_credentials_v1'")).rows[0].n,0);
  const connected=await f.service.connect(token);assert.deepEqual(connected,{configured:true,source:'panel',can_save:true});assert.ok(!JSON.stringify(connected).includes(token));
  const saved=(await f.db.execute("SELECT value FROM site_settings WHERE key='tmdb_credentials_v1'")).rows[0].value;assert.ok(!saved.includes(token));assert.ok(JSON.parse(saved).tag);
  const restarted=createTMDBService({db:f.db,config:f.config,fetchImpl:f.fetchImpl});assert.equal((await restarted.status()).configured,true);await restarted.search('Right');
  await f.service.disconnect();assert.equal((await restarted.status()).configured,false);
 }finally{f.close();}
});
test('search filters person/adult results, uses cache and supports API key authentication without public requests',async()=>{
 const f=await fixture();try{
  f.config.TMDB_API_KEY='a'.repeat(32);const result=await f.service.search('Right');
  assert.deepEqual(result.results.map(m=>m.type),['movie','tv']);assert.match(result.results[0].poster,/^https:\/\/image.tmdb.org\/t\/p\/w185\//);assert.equal(f.calls[0].params.include_adult,'false');
  assert.equal(f.calls[0].params.api_key,'a'.repeat(32));const count=f.calls.length;await f.service.search('Right');assert.equal(f.calls.length,count);
  assert.equal(tmdbImage('/../../evil.svg'),null);assert.equal(tmdbImage('https://evil.example/image.jpg'),null);assert.equal(tmdbImage(null),null);
 }finally{f.close();}
});
test('movie import preserves film edits, merges manual entries, retains field corrections on refresh and marks attribution',async()=>{
 const f=await fixture();try{
  await f.service.connect(token);
  let data=await saveManualCredits(f.db,1,{cast:[{name:'Local voice actor',role:'Uzbek dub',photo:'https://example.com/photo.jpg'}],directors:[],revision:0});
  data=await f.service.importTitle(1,{tmdb_id:77,type:'movie',revision:data.revision});assert.deepEqual(data.cast.map(p=>p.name),['Actor One','Actor Two','Local voice actor']);assert.equal(data.directors[0].name,'The Director');assert.equal(data.attribution,true);
  const old=(await f.db.execute('SELECT title,poster_url,file_id FROM movies WHERE id=1')).rows[0];assert.equal(old.title,'Owner title');assert.equal(old.poster_url,null);
  data.cast[0].name='Corrected Name';data.cast[0].role='Custom role';data.cast[0].photo=null;
  data=await saveManualCredits(f.db,1,data);data=await f.service.importTitle(1,{tmdb_id:77,type:'movie',revision:data.revision});
  assert.equal(data.cast[0].name,'Corrected Name');assert.equal(data.cast[0].role,'Custom role');assert.equal(data.cast[0].photo,null);
  const calls=f.calls.length;for(let i=0;i<5;i++)assert.equal((await titleDetails(f.db,1)).credits.cast.length,3);assert.equal(f.calls.length,calls);
  assert.ok(!JSON.stringify(await titleDetails(f.db,1)).includes(token));
  data=await removeTMDBCredits(f.db,1,data.revision);assert.equal(data.cast.length,1);assert.equal(data.attribution,false);assert.equal(data.tmdb,null);
 }finally{f.close();}
});
test('TV aggregate credits combine roles and select actual directors; root credits are inherited by episodes',async()=>{
 const f=await fixture();try{
  await f.service.connect(token);const series=await createCollection(f.db,{title:'Series'});await attachEpisode(f.db,series.id,{movie_id:2,season:1,episode:1});
  const data=await f.service.importTitle(series.id,{tmdb_id:88,type:'tv',revision:0});assert.equal(data.cast[0].role,'Main character / Voice role');assert.deepEqual(data.directors.map(p=>p.name),['Series Director']);
  const episode=await titleDetails(f.db,2);assert.equal(episode.credits.tmdb.id,88);assert.equal(episode.credits.cast[0].name,'Series Actor');
  await assert.rejects(()=>saveManualCredits(f.db,2,{cast:[],directors:[],revision:0}),/asosiy serial/);
 }finally{f.close();}
});
test('invalid edits and stale revisions are rejected atomically; remote failures leave existing credits intact',async()=>{
 const f=await fixture();try{
  let data=await saveManualCredits(f.db,1,{cast:[{name:'Safe',role:'Role'}],directors:[],revision:0});
  await assert.rejects(()=>saveManualCredits(f.db,1,{cast:[{name:'Unsafe',photo:'javascript:alert(1)'}],directors:[],revision:data.revision}));
  await assert.rejects(()=>saveManualCredits(f.db,1,{cast:[],directors:[],revision:0}),e=>e.status===409);
  assert.equal((await getCredits(f.db,1)).cast[0].name,'Safe');
  await f.service.connect(token);f.setFailure(429);await assert.rejects(()=>f.service.importTitle(1,{tmdb_id:77,type:'movie',revision:data.revision}),e=>e.status===429&&!e.message.includes(token));
  assert.equal((await getCredits(f.db,1)).revision,data.revision);
 }finally{f.close();}
});
test('cloud routes protect TMDB setup/import/manual edits with login, origin and CSRF',async()=>{
 const f=await fixture();try{
  const cloud=createCloudManage({db:f.db,config:f.config,tmdbFetch:f.fetchImpl});let cookie='',csrf='';
  async function call(path,method='GET',body,headers={}){
   let result;const values={};const res={setHeader:(key,value)=>values[key]=value,end:value=>result=JSON.parse(value)};
   await cloud.handle({method,url:'/api/manage'+path,headers:{origin:f.config.APP_ORIGIN,cookie,'x-csrf-token':csrf,...headers},body},res);
   if(values['Set-Cookie'])cookie=values['Set-Cookie'].split(';')[0];if(result.csrf)csrf=result.csrf;return {status:res.statusCode,data:result};
  }
  assert.equal((await call('/tmdb/connection')).status,401);await call('/login','POST',{password});
  assert.equal((await call('/tmdb/connection','POST',{credential:token},{'x-csrf-token':'bad'})).status,403);
  assert.equal((await call('/tmdb/connection','POST',{credential:token})).status,200);
  assert.equal((await call('/movies/1/credits/tmdb','POST',{tmdb_id:77,type:'movie',revision:0})).status,200);
  const saved=(await call('/movies/1/credits')).data;assert.equal(saved.credits.cast.length,2);assert.ok(!JSON.stringify(saved).includes(token));assert.equal(saved.tmdb.configured,true);
  const edit=await call('/movies/1/credits','PATCH',{...saved.credits,cast:[...saved.credits.cast,{name:'Manual Actor',role:'Role'}]});assert.equal(edit.status,200);assert.equal(edit.data.credits.cast.length,3);
  assert.equal((await call('/movies/1/credits/tmdb','DELETE',{revision:edit.data.credits.revision})).data.credits.cast[0].name,'Manual Actor');
  assert.equal((await call('/tmdb/connection','DELETE')).data.configured,false);
 }finally{f.close();}
});
test('owner bot can add and remove credits while other users cannot change them',async()=>{
 const f=await fixture(),previous=process.env.ADMIN_USER_ID;process.env.ADMIN_USER_ID='123';
 const message=text=>({chat:{id:123,type:'private'},from:{id:123},text});
 try{
  assert.equal(await processMessage(f.db,{...message('/credit 1 actor Wrong'),from:{id:999}}),null);
  assert.equal(await processMessage(f.db,message('/credit 1 actor Actor Name | Hero | https://example.com/actor.jpg')),'Saqlandi.');
  let data=await getCredits(f.db,1);assert.equal(data.cast[0].name,'Actor Name');assert.equal(data.cast[0].role,'Hero');assert.match(await processMessage(f.db,message('/credits 1')),/Actor Name/);
  assert.equal(await processMessage(f.db,message('/uncredit 1 '+data.cast[0].id)),'Yozuv olib tashlandi.');assert.equal((await getCredits(f.db,1)).cast.length,0);
 }finally{if(previous===undefined)delete process.env.ADMIN_USER_ID;else process.env.ADMIN_USER_ID=previous;f.close();}
});
