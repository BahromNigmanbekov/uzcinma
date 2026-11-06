import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {scryptSync} from 'node:crypto';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
process.env.CATALOG_MODE='database';process.env.TURSO_DATABASE_URL='file::memory:';process.env.TURSO_AUTH_TOKEN='';process.env.DEMO_MODE='0';
const {database}=await import('../server/core.js'),{ensureSchema}=await import('../server/schema.js'),{createCollection,attachEpisode,saveSeason}=await import('../server/series.js');
const {createCloudManage}=await import('../server/cloud-manage.js'),{servePublicMedia}=await import('../server/serve-media.js');
const db=database();await ensureSchema(db);
const video='/media/video-1898138bc26fb886c916d8d904711660d7546934f4a21fed669b194e7da28505.mp4';
for(const id of [1,2,3,4]){
 await db.execute({sql:'INSERT INTO movies(id,title,description,genres,type,year,rating,duration,poster_url,backdrop_url,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',args:[id,id===4?'Standalone film':'Episode '+id,'A full description of this story. This paragraph should remain legible on small screens.',JSON.stringify(['fantasy']),'movie',2026,8.5,660,'/assets/uzcinma-poster-v2.png','/assets/uzcinma-banner-v2.png',1,1]});
 await db.execute({sql:'INSERT INTO sources(movie_id,quality,url) VALUES(?,?,?)',args:[id,'original',video]});
}
const root=await createCollection(db,{title:'The Extraordinary Story of a Very Long Adventure Across Worlds',description:'Serial haqida to\u2018liq ma\u2019lumot. Bu tavsif kichik va katta ekranlarda qulay o\u2018qilishi kerak.\nHar bir faslda o\u2018zining qismlari bo\u2018ladi.',type:'series',genres:['fantasy','drama'],year:2026,rating:8.9});
await db.execute({sql:'UPDATE movies SET logo_url=?,poster_url=?,backdrop_url=? WHERE id=?',args:['/fixture-logo.svg','/assets/uzcinma-poster-v2.png','/assets/uzcinma-banner-v2.png',Number(root.id)]});
await attachEpisode(db,root.id,{movie_id:1,season:1,episode:1});await attachEpisode(db,root.id,{movie_id:2,season:1,episode:2});await attachEpisode(db,root.id,{movie_id:3,season:2,episode:1});await saveSeason(db,root.id,{number:3,title:'Upcoming'});
const password='browser-fixture-password',salt='b'.repeat(32),config={ADMIN_PASSWORD_HASH:JSON.stringify({salt,hash:scryptSync(password,salt,64).toString('hex')}),BOT_TOKEN:'fixture-token',ADMIN_USER_ID:'123'};
const photos=new Map(),calls=[];
const service=createCloudManage({db,config,telegramCheck:async()=>({ok:true,result:{username:'fixture_bot'}}),transport:async input=>{calls.push(input.kind);photos.set(input.kind,{body:input.data,mime:input.mime});input.progress(input.data.length);return {document:{file_id:'fixture-'+input.kind,mime_type:input.mime,file_size:input.data.length}};}});
const handlers=Object.fromEntries(await Promise.all(['catalog','playback','title'].map(async name=>[name,(await import('../api/'+name+'.js')).default])));
const dist=resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
const {createSEOHandler}=await import('../api/seo.js'),{createSEORepository}=await import('../server/seo-content.js');
const seo=createSEOHandler({repo:createSEORepository({db,bundled:null}),getTemplate:()=>readFileSync(resolve(dist,'index.html'),'utf8')});
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');res.setHeader('Cache-Control','no-store');req.query=Object.fromEntries(url.searchParams);
 const titleRoute=/^\/title\/([^/]+)$/.exec(url.pathname),mapRoute=/^\/sitemaps\/titles-(\d+)\.xml$/.exec(url.pathname);
 if(url.pathname==='/'||titleRoute||url.pathname==='/sitemap.xml'||url.pathname==='/sitemaps/pages.xml'||mapRoute){req.query={...req.query,view:titleRoute?'title':mapRoute?'titles':url.pathname==='/sitemap.xml'?'sitemap':url.pathname==='/sitemaps/pages.xml'?'pages':'home',...(titleRoute?{id:titleRoute[1]}:{}),...(mapRoute?{page:mapRoute[1]}:{})};return seo(req,res);}
 if(url.pathname.startsWith('/api/manage/'))return service.handle(req,res);
 if(handlers[url.pathname.slice(5)]&&url.pathname.startsWith('/api/'))return handlers[url.pathname.slice(5)](req,res);
 if(url.pathname==='/fixture-logo.svg'){res.setHeader('Content-Type','image/svg+xml');return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="120"><text x="8" y="85" font-size="78" font-family="Arial" font-weight="bold" fill="white">STORY LOGO</text></svg>');}
 if(url.pathname==='/api/poster'){const photo=photos.get(url.searchParams.get('kind')||'poster');if(photo){res.setHeader('Content-Type',photo.mime);return res.end(photo.body);}res.statusCode=404;return res.end();}
 if(url.pathname.startsWith('/media/'))return servePublicMedia(req,res,resolve('public/media'));
 const file=resolve(dist,'.'+(/^\/title\//.test(url.pathname)?'/index.html':url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));if(!file.startsWith(dist+sep))throw Error('Invalid path');
 res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(readFileSync(file));
}catch{res.statusCode=500;res.end('Fixture failed');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;config.APP_ORIGIN=base;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});mkdirSync('artifacts',{recursive:true});
const errors=[];
async function noOverflow(page,label){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,label);}

for(let id=20;id<35;id++)await db.execute({sql:'INSERT INTO movies(id,title,description,created_at,updated_at) VALUES(?,?,?,?,?)',args:[id,'Catalog Movie '+id,'A searchable movie description.',2,2]});
await db.execute("UPDATE movies SET title='Spider-Man: Homecoming',year=2017 WHERE id=4");
await db.execute("INSERT INTO movies(id,title,deleted,created_at,updated_at) VALUES(40,'PRIVATE HIDDEN TITLE',1,1,1)");
try{
 const noJS=await browser.newPage({javaScriptEnabled:false,viewport:{width:1440,height:900}});
 let response=await noJS.goto(base+'/title/4');assert.equal(response.status(),200);assert.match(await noJS.title(),/Spider-Man.*o‘zbek tilida/);await noJS.locator('#server-content h1').waitFor();assert.match(await noJS.locator('#server-content').textContent(),/A full description/);assert.equal(await noJS.locator('link[rel=canonical]').getAttribute('href'),'https://uzcinma.uz/title/4');
 response=await noJS.goto(base);assert.equal(response.status(),200);assert.equal(await noJS.locator('.seo-movie-card').count(),12);assert.ok(await noJS.locator('.catalog-pagination a[rel=next]').count());await noJS.screenshot({path:'artifacts/seo-without-js.png'});
 response=await noJS.goto(base+'/title/999999');assert.equal(response.status(),404);assert.match(await noJS.locator('#server-content h1').textContent(),/topilmadi/);
 console.log('PASS real film information and crawlable catalog without JavaScript, plus actual 404 status');
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.waitForFunction(()=>!document.body.classList.contains('server-rendered'));assert.equal(await page.locator('#movie-grid .poster-button').count(),12);assert.equal(await page.locator('#movie-grid .poster-button').first().evaluate(n=>n.tagName),'A');
 await page.locator('#catalog-pages a[rel=next]').click();await page.waitForURL('**/?page=2');await page.waitForFunction(()=>!document.body.classList.contains('server-rendered'));assert.equal(await page.locator('#movie-grid .poster-button').count(),5);assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://uzcinma.uz/?page=2');assert.match(await page.title(),/2-sahifa/);
 await page.locator('#movie-grid [data-movie-id="4"]').click();await page.locator('.title-name').waitFor();assert.match(await page.title(),/Spider-Man.*o‘zbek tilida/);assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://uzcinma.uz/title/4');
 await page.goBack();await page.locator('#hero').waitFor();assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://uzcinma.uz/?page=2');
 console.log('PASS native crawlable links, real catalog pagination, SPA metadata updates and browser Back');
 let titleRequests=0;page.on('request',r=>{if(new URL(r.url()).pathname==='/api/title')titleRequests++;});await page.goto(base+'/title/4');await page.locator('.title-name').waitFor();await page.waitForFunction(()=>!document.body.classList.contains('server-rendered'));assert.equal(titleRequests,0,'initial server title should hydrate without another title API request');assert.match(await page.title(),/o‘zbek tilida/);
 await page.locator('.title-play').click();await page.waitForFunction(()=>document.getElementById('video').currentTime>.2);assert.match(await page.locator('#watch-title').textContent(),/Spider-Man/);
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await page.screenshot({path:'artifacts/seo-player-after-hydration.png'});await page.locator('#video').evaluate(v=>v.pause());
 console.log('PASS server-data hydration, preserved movie identity/playback and responsive interface');
 const sitemap=await page.request.get(base+'/sitemap.xml');assert.match(sitemap.headers()['content-type'],/application\/xml/);assert.match(await sitemap.text(),/sitemapindex/);
 const titles=await(await page.request.get(base+'/sitemaps/titles-1.xml')).text();assert.ok(!titles.includes('/title/40<')&&!titles.includes('/title/1<'));assert.ok(titles.includes('/title/'+root.id+'<'));assert.match(await(await page.request.get(base+'/robots.txt')).text(),/Sitemap: https:\/\/uzcinma.uz\/sitemap.xml/);
 await page.goto(base+'/admin/');await page.locator('#password').fill(password);await page.locator('#auth-submit').click();await page.locator('#movie-list tr').first().waitFor();await page.locator('[data-page=seo]').click();await page.waitForFunction(()=>!document.getElementById('seo-form').querySelector('select').disabled);
 await page.locator('#seo-google').fill('<meta name="google-site-verification" content="public-verification-token">');await page.locator('#seo-form [type=submit]').click();await page.getByText('SEO sozlamalari saqlandi.',{exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'artifacts/seo-admin-mobile.png'});
 const html=await(await page.request.get(base)).text();assert.match(html,/name="google-site-verification" content="public-verification-token"/);
 const visitor=await browser.newContext();assert.equal((await visitor.request.get(base+'/api/manage/seo')).status(),401);await visitor.close();assert.deepEqual(errors,[]);
 console.log('PASS sitemap privacy, robots, owner verification settings, mobile admin and unchanged authorization');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));db.close();}
