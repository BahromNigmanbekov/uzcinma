import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,sep,extname} from 'node:path';
import {scryptSync} from 'node:crypto';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {wikidataFixtureFetch} from './helpers/wikidata-fixture.mjs';
process.env.CATALOG_MODE='database';process.env.TURSO_DATABASE_URL='file::memory:';process.env.TURSO_AUTH_TOKEN='';process.env.DEMO_MODE='0';
const {database}=await import('../server/core.js'),{ensureSchema}=await import('../server/schema.js'),{createCloudManage}=await import('../server/cloud-manage.js'),{servePublicMedia}=await import('../server/serve-media.js');
const db=database();await ensureSchema(db);await db.execute("INSERT INTO movies(id,title,description,created_at,updated_at) VALUES(1,'Owner Film','A readable movie description.',1,1)");
await db.execute({sql:'INSERT INTO sources(movie_id,quality,url) VALUES(1,?,?)',args:['original','/media/video-1898138bc26fb886c916d8d904711660d7546934f4a21fed669b194e7da28505.mp4']});
const password='fixture-browser-password',salt='e'.repeat(32),remote=wikidataFixtureFetch(),config={ADMIN_API_SECRET:'fixture-wrap-secret',ADMIN_PASSWORD_HASH:JSON.stringify({salt,hash:scryptSync(password,salt,64).toString('hex')})};
const cloud=createCloudManage({db,config,wikidataFetch:remote.fetchImpl,telegramCheck:async()=>({ok:false})});
const handlers=Object.fromEntries(await Promise.all(['catalog','title','playback'].map(async name=>[name,(await import('../api/'+name+'.js')).default])));
const dist=resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');req.query=Object.fromEntries(url.searchParams);res.setHeader('Cache-Control','no-store');
 if(url.pathname.startsWith('/api/manage/'))return cloud.handle(req,res);
 if(url.pathname.startsWith('/api/')&&handlers[url.pathname.slice(5)])return handlers[url.pathname.slice(5)](req,res);
 if(url.pathname.startsWith('/media/'))return servePublicMedia(req,res,resolve('public/media'));
 const path=resolve(dist,'.'+(/^\/title\//.test(url.pathname)?'/index.html':url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));if(!path.startsWith(dist+sep))throw Error('Path');res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(readFileSync(path));
}catch(error){res.statusCode=500;res.end('Fixture request failed');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;config.APP_ORIGIN=base;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});mkdirSync('artifacts',{recursive:true});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/admin/');await page.locator('#password').fill(password);await page.locator('#auth-submit').click();await page.locator('#movie-list tr').first().waitFor();await page.getByRole('button',{name:'Tahrirlash',exact:true}).click();await page.locator('.wikidata-search-button').waitFor();assert.equal(await page.locator('.optional-tmdb').getAttribute('open'),null);
 await page.locator('#wikidata-query').fill('Adventure');await page.locator('.wikidata-search-button').click();await page.locator('.wikidata-result').waitFor();assert.match(await page.locator('.wikidata-result strong').textContent(),/2024/);
 await page.locator('.wikidata-import').click();await page.waitForFunction(()=>document.querySelectorAll('.admin-cast-list .admin-person-row').length===18);assert.equal(await page.locator('.admin-directors-list .admin-person-row').count(),1);console.log('PASS authenticated free search/import without an account or API key');
 await page.locator('.admin-cast-list [data-field="name"]').first().fill('Owner corrected actor');await page.locator('.save-credits').click();await page.getByText('Aktyorlar va rejissyorlar saqlandi.',{exact:true}).waitFor();
 await page.locator('.add-actor').click();await page.locator('.admin-cast-list [data-field="name"]').last().fill('Manual Actor');await page.locator('.admin-cast-list [data-field="role"]').last().fill('Local voice');await page.locator('.save-credits').click();await page.waitForFunction(()=>document.querySelectorAll('.admin-cast-list .admin-person-row').length===19);await page.getByText('Aktyorlar va rejissyorlar saqlandi.',{exact:true}).waitFor();console.log('PASS manual actor editing and appending preserve imported image credits');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('.credits-management').screenshot({path:'artifacts/credits-admin-mobile.png'});console.log('PASS mobile admin fields, free provider and bounded actor editor');
 const publicPage=await browser.newPage({viewport:{width:1440,height:1000}});publicPage.on('pageerror',e=>errors.push(e.message));
 await publicPage.route(/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//,route=>route.request().url().includes('Actor-3')?route.fulfill({status:404,body:''}):route.fulfill({contentType:'image/png',body:readFileSync('public/assets/uzcinma-banner.png')}));
 await publicPage.goto(base+'/title/1');await publicPage.locator('.credits-section').waitFor();assert.equal(await publicPage.locator('#cast-panel .person-card').count(),19);assert.match(await publicPage.locator('#cast-panel .person-name').first().textContent(),/Owner corrected/);assert.equal(await publicPage.locator('.wikidata-attribution').isVisible(),true);assert.equal(await publicPage.locator('.tmdb-attribution').isVisible(),false);
 await publicPage.locator('#directors-tab').click();assert.equal(await publicPage.locator('#directors-panel').isVisible(),true);assert.equal(await publicPage.locator('#directors-panel .person-card').count(),1);await publicPage.locator('#directors-tab').press('ArrowLeft');assert.equal(await publicPage.locator('#cast-tab').getAttribute('aria-selected'),'true');
 await publicPage.locator('.credits-next').click();await publicPage.waitForFunction(()=>document.getElementById('cast-panel').scrollLeft>50);assert.ok(await publicPage.locator('.person-photo-credit').count()>0);console.log('PASS public circular cast, role labels, accessible tabs and horizontal navigation');
 for(const width of [320,360,390,540,768,1024,1440,1920]){
  await publicPage.setViewportSize({width,height:1000});await publicPage.locator('.credits-section').scrollIntoViewIfNeeded();assert.equal(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Overflow at '+width);
  assert.ok(await publicPage.locator('.person-name').first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize))>=14);
  if([390,1440].includes(width))await publicPage.locator('.credits-section').screenshot({path:'artifacts/credits-public-'+width+'.png'});
 }console.log('PASS readable cast at eight screen widths and missing-photo fallbacks');
 const calls=remote.calls.length;await publicPage.reload();await publicPage.locator('.credits-section').waitFor();assert.equal(remote.calls.length,calls);await publicPage.locator('.title-play').click();await publicPage.waitForFunction(()=>document.getElementById('video').currentTime>.25);await publicPage.locator('#play').click();console.log('PASS stored credits need no provider request per visitor and existing movie playback works');
 assert.deepEqual(errors,[]);console.log('PASS zero browser runtime errors');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));db.close();}
