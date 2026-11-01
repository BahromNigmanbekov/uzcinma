import test from 'node:test';
import assert from 'node:assert/strict';
import {adminFixture} from './helpers/admin-fixture.mjs';
const metadata={title:'Test film',description:'A test description',genres:['anime','fantasy'],type:'anime',year:2026,rating:8.1};
test('admin setup, login, session and CSRF protect catalog modifications',async()=>{
 const f=await adminFixture();
 try{
  assert.equal((await f.request('/movies',{authenticated:false})).status,401);
  assert.equal((await f.request('/session')).data.setup_required,true);
  assert.equal((await f.request('/setup',{method:'POST',body:{password:'test-password-123'},requestOrigin:'https://attacker.example'})).status,403);
  assert.equal((await f.login()).status,200);
  assert.equal((await f.request('/setup',{method:'POST',body:{password:'another-password'}})).status,409);
  assert.equal((await f.request('/movies/1',{method:'PATCH',body:metadata,withCsrf:false})).status,403);
  assert.equal((await f.request('/movies/1',{method:'PATCH',body:{...metadata,genres:['not-real']}})).status,400);
  assert.equal((await f.request('/jobs',{method:'POST',body:{kind:'video',filename:'film.mp4',size:10,mime:'video/mp4',metadata}})).status,400);
  assert.equal((await f.request('/movies/1',{method:'PATCH',body:metadata})).status,200);
  const movie=(await f.request('/movies')).data.movies[0];assert.equal(movie.title,'Test film');assert.deepEqual(movie.genres,['anime','fantasy']);
  assert.equal(JSON.stringify(movie).includes('private-existing'),false);
  assert.equal((await f.request('/logout',{method:'POST'})).status,200);
  assert.equal((await f.request('/movies')).status,401);
  assert.equal((await f.request('/login',{method:'POST',body:{password:'bad-password'}})).status,401);
  assert.equal((await f.request('/login',{method:'POST',body:{password:'test-password-123'}})).status,200);
 }finally{await f.close();}
});
test('upload retries keep the file and do not resend a Telegram message after acceptance',async()=>{
 const f=await adminFixture({failUploads:1,failRefreshes:1});
 try{
  await f.login();const payload=Buffer.alloc(4096,1);
  const init=await f.request('/jobs',{method:'POST',body:{kind:'banner',filename:'banner.png',size:payload.length,mime:'image/png',movie_id:1}});
  assert.equal(init.status,201);const id=init.data.job.id;
  assert.equal((await f.request('/jobs/'+id+'/file',{method:'PUT',raw:payload})).status,202);
  const failed=await f.waitJob(id);assert.equal(failed.stage,'error');assert.equal(failed.can_retry,true);assert.equal(failed.received,payload.length);
  await f.request('/jobs/'+id+'/retry',{method:'POST'});const accepted=await f.waitJob(id);
  assert.equal(accepted.stage,'error');assert.equal(accepted.accepted_by_telegram,true);assert.equal(f.calls.length,2);
  await f.request('/jobs/'+id+'/retry',{method:'POST'});const done=await f.waitJob(id);
  assert.equal(done.stage,'done');assert.equal(f.calls.length,2);assert.ok(done.movie_id);
  const movie=(await f.request('/movies')).data.movies.find(m=>m.id===String(done.movie_id));assert.equal(movie.title,'Mavjud film');assert.equal((await f.db.execute('SELECT file_id FROM movies WHERE id=1')).rows[0].file_id,'private-existing');
  assert.equal(JSON.stringify(done).includes('private-video'),false);
 }finally{await f.close();}
});
test('banner and poster uploads are sent to the bot and saved independently',async()=>{
 const f=await adminFixture();
 try{
  await f.login();const png=Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
  for(const kind of ['banner','poster']){
   const {data}=await f.request('/jobs',{method:'POST',body:{kind,filename:kind+'.png',size:png.length,mime:'image/png',movie_id:1}});
   await f.request('/jobs/'+data.job.id+'/file',{method:'PUT',raw:png});assert.equal((await f.waitJob(data.job.id)).stage,'done');
  }
  const row=(await f.db.execute('SELECT * FROM movies WHERE id=1')).rows[0];assert.ok(row.banner_file_id);assert.ok(row.poster_file_id);assert.notEqual(row.banner_file_id,row.poster_file_id);
  assert.deepEqual(f.calls.map(c=>c.kind),['banner','poster']);
 }finally{await f.close();}
});
test('homepage selection validates atomically and hide/restore is reversible',async()=>{
 const f=await adminFixture();
 try{
  await f.login();
  assert.equal((await f.request('/home',{method:'POST',body:{hero_ids:['1'],recommendation_ids:['999']}})).status,404);
  assert.equal((await f.db.execute('SELECT COUNT(*) AS n FROM site_settings')).rows[0].n,0);
  assert.equal((await f.request('/home',{method:'POST',body:{hero_ids:['1'],recommendation_ids:[]}})).status,200);
  assert.deepEqual((await f.request('/movies')).data.home.hero_ids,['1']);
  assert.equal((await f.request('/movies/1',{method:'PATCH',body:{deleted:true}})).status,200);
  assert.equal((await f.request('/movies')).data.movies[0].deleted,true);
  assert.equal((await f.request('/movies/1',{method:'PATCH',body:{deleted:false}})).status,200);
  assert.equal((await f.request('/movies')).data.movies[0].deleted,false);
 }finally{await f.close();}
});
