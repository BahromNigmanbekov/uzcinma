import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@libsql/client';
import {readFileSync} from 'node:fs';
import {ensureSchema} from '../server/schema.js';
import {processMessage} from '../server/bot.js';
import {movieDTO} from '../server/core.js';
test('banner photo upload preserves the card poster and exposes only a safe image URL',async()=>{
 const db=createClient({url:'file::memory:'});await ensureSchema(db);process.env.ADMIN_USER_ID='123';
 try{
  await db.execute("INSERT INTO movies(id,title,poster_url,backdrop_url,created_at,updated_at) VALUES(4,'Hero','https://images.example/poster.jpg','https://images.example/old.jpg',1,1)");
  const msg={chat:{type:'private',id:123},from:{id:123},caption:'/banner 4',photo:[{file_id:'private-banner-file',file_size:1000}]};
  assert.equal(await processMessage(db,msg),'Banner saqlandi.');
  const row=(await db.execute('SELECT * FROM movies WHERE id=4')).rows[0];
  assert.equal(row.poster_url,'https://images.example/poster.jpg');assert.equal(row.banner_file_id,'private-banner-file');assert.equal(row.backdrop_url,null);
  const publicMovie=movieDTO(row);assert.match(publicMovie.backdrop,/kind=banner/);assert.equal(publicMovie.poster,row.poster_url);assert.equal(JSON.stringify(publicMovie).includes('private-banner-file'),false);
  assert.equal(await processMessage(db,{...msg,from:{id:456}}),null);
 }finally{db.close();}
});
test('existing catalog schema gains the banner column without losing movies',async()=>{
 const db=createClient({url:'file::memory:'});
 try{
  const old=readFileSync(new URL('../server/schema.sql',import.meta.url),'utf8').replace(' banner_file_id TEXT,','');
  await db.batch(old.split(';').map(s=>s.trim()).filter(Boolean),'write');
  await db.execute("INSERT INTO movies(id,title,created_at,updated_at) VALUES(4,'Keep me',1,1)");
  await ensureSchema(db);await ensureSchema(db);
  assert.equal((await db.execute('SELECT title FROM movies WHERE id=4')).rows[0].title,'Keep me');
  assert.ok((await db.execute('PRAGMA table_info(movies)')).rows.some(r=>r.name==='banner_file_id'));
 }finally{db.close();}
});
