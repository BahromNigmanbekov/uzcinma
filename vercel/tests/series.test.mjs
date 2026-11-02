import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync} from 'node:crypto';
process.env.CATALOG_MODE='database';process.env.DEMO_MODE='0';process.env.TURSO_DATABASE_URL='file::memory:';process.env.ADMIN_USER_ID='123';
const {database}=await import('../server/core.js'),{ensureSchema}=await import('../server/schema.js');
const {createCollection,saveSeason,attachEpisode,detachEpisode,titleDetails,restoreTitle,removeSeason}=await import('../server/series.js');
const {processMessage,processUpdate}=await import('../server/bot.js');
const {createCloudManage}=await import('../server/cloud-manage.js');
const {default:catalog}=await import('../api/catalog.js'),{default:playback}=await import('../api/playback.js'),{default:title}=await import('../api/title.js');
const db=database();await ensureSchema(db);
const message=(text,extra={})=>({chat:{id:123,type:'private'},from:{id:123},text,...extra});
async function video(name='Episode'){
 const unique=crypto.randomUUID();await processMessage(db,message('',{message_id:123,video:{file_unique_id:unique,file_id:'private-video-file',file_name:name+'.mp4',file_size:200,duration:100},caption:name}));
 const row=(await db.execute({sql:'SELECT id FROM movies WHERE file_unique_id=?',args:[unique]})).rows[0];
 await db.execute({sql:'INSERT INTO sources(movie_id,quality,url) VALUES(?,?,?)',args:[row.id,'original','https://cdn.example.com/video.mp4']});return String(row.id);
}
async function request(handler,query={},extra={}){
 let data;const headers={};const res={setHeader:(k,v)=>headers[k]=v,end:value=>data=JSON.parse(value)};
 await handler({method:'GET',headers:{},query,...extra},res);return {status:res.statusCode,data,headers};
}
test('series catalog contains one title, ordered seasons, accurate cross-season navigation and private video metadata stays hidden',async()=>{
 const root=await createCollection(db,{title:'Example Story',type:'anime',genres:['anime']}),a=await video('First'),b=await video('Second'),c=await video('Season two');
 await saveSeason(db,root.id,{number:2,title:'Return'});await saveSeason(db,root.id,{number:1,title:'Beginning'});
 await attachEpisode(db,root.id,{movie_id:c,season:2,episode:1});await attachEpisode(db,root.id,{movie_id:b,season:1,episode:2});await attachEpisode(db,root.id,{movie_id:a,season:1,episode:1});
 const result=await request(catalog,{q:'Example Story'});assert.equal(result.data.total,1);assert.equal(result.data.movies[0].available,true);
 assert.equal((await request(catalog,{ids:[a,b,c].join(',')})).data.total,0);
 const detail=(await request(title,{id:root.id,season:'1',episode:b})).data;
 assert.deepEqual(detail.seasons.map(s=>[s.number,s.episode_count]),[[1,2],[2,1]]);assert.deepEqual(detail.episodes.map(e=>e.id),[a,b]);assert.equal(detail.navigation.previous.id,a);assert.equal(detail.navigation.next.id,c);
 assert.equal(detail.direct_available,false);assert.equal(detail.entry_episode.id,a);assert.equal(JSON.stringify(detail).includes('private-video-file'),false);
 await db.execute({sql:'UPDATE movies SET logo_file_id=?,banner_file_id=? WHERE id=?',args:['private-logo','private-banner',Number(root.id)]});
 const inherited=await titleDetails(db,a);assert.match(inherited.movie.logo,/kind=logo/);assert.equal(inherited.current_episode.logo,inherited.movie.logo);assert.equal(inherited.current_episode.backdrop,inherited.movie.backdrop);
 await restoreTitle(db,root.id,true);assert.equal((await request(title,{id:a})).status,404);assert.equal((await request(playback,{id:a})).status,404);
 await restoreTitle(db,root.id,false);assert.equal((await request(playback,{id:a})).status,200);
});
test('episode collisions are reversible, rejected atomically, and pagination does not omit seasons',async()=>{
 const root=await createCollection(db,{title:'Slots'}),a=await video(),b=await video();
 await attachEpisode(db,root.id,{movie_id:a,season:1,episode:1});
 await assert.rejects(()=>attachEpisode(db,root.id,{movie_id:b,season:1,episode:1}),error=>error.status===409);
 assert.equal((await db.execute({sql:'SELECT collection_id FROM movies WHERE id=?',args:[Number(b)]})).rows[0].collection_id,null);
 await assert.rejects(()=>attachEpisode(db,root.id,{movie_id:root.id,season:1,episode:2}));
 await assert.rejects(()=>attachEpisode(db,root.id,{movie_id:b,season:0,episode:1}));
 await restoreTitle(db,a,true);await attachEpisode(db,root.id,{movie_id:b,season:1,episode:1});
 await assert.rejects(()=>restoreTitle(db,a,false),error=>error.status===409);
 await assert.rejects(()=>removeSeason(db,root.id,1),error=>error.status===409);
 await detachEpisode(db,b);await restoreTitle(db,a,false);
 assert.equal((await titleDetails(db,root.id,{limit:1})).episodes[0].id,a);
 await detachEpisode(db,a);await removeSeason(db,root.id,1);assert.equal((await titleDetails(db,root.id)).seasons.length,0);
});
test('bot supports series creation, direct episode captions, logos and sound; invalid assignments do not cause webhook retry loops',async()=>{
 const created=await processMessage(db,message('/series animation Sample Cartoon'));assert.match(created,/ID:/);
 const root=(await db.execute("SELECT id FROM movies WHERE title='Sample Cartoon'")).rows[0].id;
 await processMessage(db,message('/season '+root+' 3 Third'));
 const direct=message('',{message_id:321,caption:'/episode '+root+' 3 7 Arrival',video:{file_unique_id:'direct-episode',file_id:'video-secret',file_name:'arrival.mp4',file_size:300,duration:30}});
 assert.match(await processMessage(db,direct),/biriktirildi/);let detail=await titleDetails(db,root);assert.equal(detail.episodes[0].title,'Arrival');assert.equal(detail.episodes[0].episode_number,7);
 assert.match(await processMessage(db,message('/logo '+root,{document:{file_id:'secret-wordmark',mime_type:'image/png',file_size:100}})),/Logo saqlandi/);
 assert.match((await titleDetails(db,root)).movie.logo,/kind=logo/);
 await processMessage(db,message('/sound off'));assert.equal((await request(catalog)).data.home.selection_sound_enabled,false);
 const invalid=await processUpdate(db,{update_id:999,message:message('/episode '+root+' 3 7 99999')});assert.match(invalid,/topilmadi/);
 assert.equal((await db.execute('SELECT status FROM telegram_updates WHERE id=999')).rows[0].status,'done');
 await processMessage(db,message('/logooff '+root));assert.equal((await titleDetails(db,root)).movie.logo,null);
});
test('cloud management requires normal login and CSRF for creating collections, seasons, linking videos and editing logos',async()=>{
 const salt='e'.repeat(32),password='fixture-password-123',config={APP_ORIGIN:'https://admin.test',ADMIN_PASSWORD_HASH:JSON.stringify({salt,hash:scryptSync(password,salt,64).toString('hex')}),BOT_TOKEN:'test-only',ADMIN_USER_ID:'123'};
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');let kind;
 const service=createCloudManage({db,config,transport:async input=>{kind=input.kind;return {document:{file_id:'secret-admin-logo',mime_type:'image/png',file_size:png.length}};}});
 let cookie='',csrf='';
 async function manage(path,method='GET',body,extraHeaders={}){
  const result=await request(service.handle,{}, {method,url:'/api/manage'+path,body,headers:{cookie,origin:config.APP_ORIGIN,'x-csrf-token':csrf,...extraHeaders}});
  if(result.headers['Set-Cookie'])cookie=result.headers['Set-Cookie'].split(';')[0];if(result.data.csrf)csrf=result.data.csrf;return result;
 }
 assert.equal((await manage('/collections','POST',{title:'Denied'})).status,401);
 await manage('/login','POST',{password});let created=await manage('/collections','POST',{title:'Managed Series'});
 assert.equal(created.status,201);const id=created.data.movie.id,a=await video();
 assert.equal((await manage('/collections/'+id+'/seasons','POST',{number:2,title:'Second'})).status,200);
 assert.equal((await manage('/collections/'+id+'/episodes','POST',{movie_id:a,season:2,episode:1},{'x-csrf-token':'wrong'})).status,403);
 assert.equal((await manage('/collections/'+id+'/episodes','POST',{movie_id:a,season:2,episode:1})).status,200);
 assert.equal((await manage('/collections/'+id+'?season=2')).data.episodes[0].id,a);
 const job=(await manage('/jobs','POST',{kind:'logo',movie_id:id,filename:'logo.png',mime:'image/png',size:png.length})).data.job;
 assert.equal((await manage('/jobs/'+job.id+'/file','PUT',png)).data.job.stage,'done');assert.equal(kind,'logo');
 assert.match((await manage('/movies/'+id)).data.movie.logo,/kind=logo/);
 await manage('/movies/'+id,'PATCH',{clear_logo:true});assert.equal((await manage('/movies/'+id)).data.movie.logo,null);
 assert.equal((await manage('/movies')).data.movies.some(m=>m.id===a),false);
 assert.equal((await manage('/episodes/'+a+'/detach','POST')).status,200);
 assert.equal((await manage('/movies')).data.movies.some(m=>m.id===a),true);
});
test('large seasons paginate without duplicates and navigation works outside the current page',async()=>{
 const root=await createCollection(db,{title:'Long animation'});await saveSeason(db,root.id,{number:1});
 await db.batch(Array.from({length:205},(_,index)=>({sql:'INSERT INTO movies(title,collection_id,season_number,episode_number,created_at,updated_at) VALUES(?,?,1,?,1,1)',args:['Part '+(index+1),Number(root.id),index+1]})),'write');
 const a=await titleDetails(db,root.id),b=await titleDetails(db,root.id,{offset:100}),c=await titleDetails(db,root.id,{offset:200});
 assert.equal(a.total,205);assert.equal(a.episodes.length,100);assert.equal(a.has_more,true);assert.equal(b.episodes[0].episode_number,101);assert.equal(c.episodes.length,5);assert.equal(c.has_more,false);
 assert.equal(new Set([...a.episodes,...b.episodes,...c.episodes].map(m=>m.id)).size,205);
 const current=await titleDetails(db,root.id,{episode:b.episodes[0].id});assert.equal(current.navigation.previous.episode_number,100);assert.equal(current.navigation.next.episode_number,102);
});
after(()=>db.close());
