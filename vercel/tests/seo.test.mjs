import test from 'node:test';import assert from 'node:assert/strict';import {createClient} from '@libsql/client';
import {ensureSchema} from '../server/schema.js';import {createSEORepository} from '../server/seo-content.js';import {createSEOHandler} from '../api/seo.js';
import {movieSEO,dateISO} from '../shared/seo.js';import {getSEOSettings,saveSEOSettings,validateSEOSettings} from '../server/seo-settings.js';
import {sitemapIndex,pagesSitemap,jsonScript} from '../server/seo-render.js';
process.env.DEMO_MODE='0';
const template='<!doctype html><html lang="uz"><head><title>Old</title><meta name="description" content="Old"><script type="module" src="/assets/main.js"></script></head><body><header></header><main></main></body></html>';
async function fixture(){
 const db=createClient({url:'file::memory:'});await ensureSchema(db);
 for(const [id,title,deleted,collection,isCollection]of [[1,'Spider-Man: Homecoming',0,null,0],[2,'Hidden film',1,null,0],[3,'A Series',0,null,1],[4,'Episode one',0,3,0]]){
  await db.execute({sql:'INSERT INTO movies(id,title,description,genres,type,year,duration,file_id,deleted,collection_id,is_collection,season_number,episode_number,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',args:[id,title,'A detailed story in Uzbek. </script><script>alert(1)</script>',JSON.stringify(['fantasy']),isCollection?'series':'movie',2017,660,'PRIVATE_FILE_DO_NOT_PUBLISH',deleted,collection,isCollection,collection?1:null,collection?1:null,1600000000,1700000000000]});
 }
 await db.execute("INSERT INTO seasons(series_id,number,title) VALUES(3,1,'First season')");
 const repo=createSEORepository({db,bundled:null}),handler=createSEOHandler({repo,getTemplate:()=>template});
 return {db,repo,request:async query=>{const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(value){this.body=value;}};await handler({method:query.method||'GET',query,url:'/',headers:{}},res);return res;}};
}
test('initial HTML has unique Uzbek metadata, canonical, safe schema and crawlable film information without scripts',async()=>{
 const f=await fixture();try{
  await saveSEOSettings(f.db,{google_verification:'public-google-token-123',bing_verification:'',audio_language:'uz'});
  const r=await f.request({view:'title',id:'1'});
  assert.equal(r.statusCode,200);assert.match(r.body,/<title>Spider-Man: Homecoming \(2017\) o‘zbek tilida \| UZCINMA<\/title>/);
  assert.match(r.body,/rel="canonical" href="https:\/\/uzcinma.uz\/title\/1"/);assert.match(r.body,/name="google-site-verification" content="public-google-token-123"/);
  assert.match(r.body,/<h1[^>]*>Spider-Man: Homecoming<\/h1>/);assert.ok(!r.body.includes('PRIVATE_FILE_DO_NOT_PUBLISH'));assert.ok(!r.body.includes('<script>alert(1)</script>'));
  const schema=JSON.parse(/id="seo-schema">([\s\S]*?)<\/script>/.exec(r.body)[1]);assert.ok(schema['@graph'].some(n=>n['@type']==='Movie'&&n.inLanguage==='uz'));assert.ok(!JSON.stringify(schema).includes('aggregateRating'));
  const initial=JSON.parse(/id="initial-data">([\s\S]*?)<\/script>/.exec(r.body)[1]);assert.equal(initial.title.movie.id,'1');
  const head=await f.request({view:'title',id:'1',method:'HEAD'});assert.equal(head.statusCode,200);assert.equal(head.body,undefined);
 }finally{f.db.close();}
});
test('sitemaps update from the live database, omit hidden films/episode duplicates, and escape image URLs',async()=>{
 const f=await fixture();try{
  const index=await f.request({view:'sitemap'});assert.match(index.body,/sitemapindex/);assert.match(index.body,/sitemaps\/titles-1.xml/);
  let titles=await f.request({view:'titles',page:'1'});assert.match(titles.body,/\/title\/1</);assert.match(titles.body,/\/title\/3</);assert.ok(!titles.body.includes('/title/2<')&&!titles.body.includes('/title/4<'));assert.match(titles.body,/<lastmod>2023-/);
  await f.db.execute("INSERT INTO movies(id,title,poster_url,created_at,updated_at) VALUES(5,'New film','/api/poster?id=5&v=42',1,1)");
  titles=await f.request({view:'titles',page:'1'});assert.match(titles.body,/\/title\/5</);assert.match(titles.body,/id=5&amp;v=42/);
  assert.equal((await f.request({view:'titles',page:'2'})).statusCode,404);
  const page=await f.request({view:'home'});assert.match(page.body,/href="\/title\/1"/);assert.ok(!page.body.includes('Hidden film'));
  assert.equal((sitemapIndex(6000).match(/<sitemap>/g)||[]).length,7);assert.equal((pagesSitemap(6000).match(/<url>/g)||[]).length,500);
 }finally{f.db.close();}
});
test('missing/hidden titles have real 404s, temporary errors are retryable, and old episode URLs redirect to their series',async()=>{
 const f=await fixture();try{
  for(const id of ['2','9999','bad']){const r=await f.request({view:'title',id});assert.equal(r.statusCode,404);assert.equal(r.headers['X-Robots-Tag'],'noindex');assert.ok(!r.body.includes('type="module"'));}
  const alias=await f.request({view:'title',id:'4'});assert.equal(alias.statusCode,308);assert.equal(alias.headers.Location,'https://uzcinma.uz/title/3?season=1&episode=4');
  const badSeason=await f.request({view:'title',id:'3',season:'99'});assert.equal(badSeason.statusCode,404);
  const handler=createSEOHandler({repo:{settings:async()=>{throw Error('database temporarily down');}},getTemplate:()=>template}),res={headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}};
  await handler({method:'GET',query:{},url:'/'},res);assert.equal(res.statusCode,503);assert.equal(res.headers['Retry-After'],'60');
 }finally{f.db.close();}
});
test('metadata uses real dates and language, rejects unsafe verification values, and does not leak credentials',async()=>{
 assert.equal(dateISO(1700000000),dateISO(1700000000000));assert.equal(dateISO('2023-11-14T22:13:20.000Z'),'2023-11-14T22:13:20.000Z');assert.equal(dateISO('bad'),null);
 const mixed=movieSEO({id:1,title:'Title',description:'Story',genres:[]},{settings:{audio_language:''}});assert.ok(!mixed.title.includes('o‘zbek tilida'));
 assert.deepEqual(validateSEOSettings({google_verification:'<meta name="google-site-verification" content="valid-google-token">',audio_language:''}),{google_verification:'valid-google-token',bing_verification:'',audio_language:''});
 assert.throws(()=>validateSEOSettings({google_verification:'bad"><script>x</script>',audio_language:'uz'}),e=>e.status===400);
 assert.ok(!jsonScript({title:'</script><img src=x onerror=alert(1)>'}).includes('<'));
 const db=createClient({url:'file::memory:'});try{await ensureSchema(db);assert.equal((await getSEOSettings(db)).audio_language,'uz');}finally{db.close();}
});
