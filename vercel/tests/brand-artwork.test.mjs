import test from 'node:test';import assert from 'node:assert/strict';import {createClient} from '@libsql/client';import {ensureSchema} from '../server/schema.js';import {migrateBrandArtwork} from '../server/brand-artwork.js';
test('branding migration replaces previous defaults while preserving movie uploads and unrelated data',async()=>{
 const db=createClient({url:'file::memory:'});try{
  await ensureSchema(db);await db.execute("DELETE FROM site_settings WHERE key='brand_artwork_revision'");
  await db.execute("INSERT INTO movies(id,title,poster_url,backdrop_url,logo_url,created_at,updated_at) VALUES(1,'Original title','/assets/uzcinma-poster.png','https://uzcinma.uz/assets/uzcinma-banner.png?v=1','/assets/uzcinma-logo-v2.png',1,1),(2,'Uploaded film','/api/poster?id=2','/media/owner-banner.jpg','https://images.example/logo.png',1,1)");
  assert.equal(await migrateBrandArtwork(db),3);
  const [old,uploaded]=(await db.execute('SELECT * FROM movies ORDER BY id')).rows;
  assert.equal(old.poster_url,'/assets/uzcinma-poster-v2.png');assert.equal(old.backdrop_url,'/assets/uzcinma-banner-v2.png');assert.equal(old.logo_url,'/assets/uzcinma-logo.png');assert.equal(old.title,'Original title');
  assert.equal(uploaded.poster_url,'/api/poster?id=2');assert.equal(uploaded.backdrop_url,'/media/owner-banner.jpg');assert.equal(uploaded.updated_at,1);assert.equal(await migrateBrandArtwork(db),0);
 }finally{db.close();}
});
