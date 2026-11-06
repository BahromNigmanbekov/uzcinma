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
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');res.setHeader('Cache-Control','no-store');req.query=Object.fromEntries(url.searchParams);
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
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('#movie-grid .poster-button').first().waitFor();assert.equal(await page.locator('#movie-grid .poster-button').count(),2);
 await page.locator('#search-toggle').click();await page.locator('#search').fill('Extraordinary');await page.locator('.search-result').waitFor();assert.equal(await page.locator('.search-result-copy img').isVisible(),true);
 await page.locator('#search').press('ArrowDown');await page.locator('#search').press('Enter');await page.locator('.title-name').waitFor();assert.equal(await page.locator('.title-logo').isVisible(),true);assert.ok(page.url().endsWith('/title/'+root.id));assert.equal(await page.locator('.episode-card').count(),2);console.log('PASS search wordmark, keyboard selection and dedicated series page');
 await page.locator('.season-select').selectOption('2');await page.waitForFunction(()=>document.querySelectorAll('.episode-card').length===1);assert.match(await page.locator('.episode-copy h3').textContent(),/Episode 3/);
 await page.locator('.season-select').selectOption('3');await page.locator('.episodes-empty').waitFor();await page.locator('.season-select').selectOption('1');await page.waitForFunction(()=>document.querySelectorAll('.episode-card').length===2);
 await page.locator('.episode-card').first().click();await page.waitForFunction(()=>document.getElementById('video').currentTime>.25);await page.waitForFunction(()=>!document.querySelector('.next-episode').disabled);assert.equal(await page.locator('.previous-episode').isDisabled(),true);
 await page.locator('#play').focus();await page.waitForTimeout(10500);await page.waitForFunction(()=>document.getElementById('player').classList.contains('controls-hidden'));console.log('PASS episode playback and ten-second control auto-hide');
 await page.locator('#video').evaluate(v=>{v.currentTime=v.duration-.1;v.play();});await page.locator('.next-episode-overlay').waitFor();assert.match(await page.locator('.next-preview strong').textContent(),/Episode 2/);await page.locator('.next-preview').click();
 await page.waitForFunction(()=>document.getElementById('watch-title').textContent.includes('Episode 2'));await page.waitForFunction(()=>!document.querySelector('.next-episode').disabled);assert.match(await page.locator('.next-caption').textContent(),/2-fasl/);
 await page.locator('.next-episode').click();await page.waitForFunction(()=>document.getElementById('watch-title').textContent.includes('Episode 3'));await page.waitForFunction(()=>document.querySelector('.next-episode').disabled);assert.equal(await page.locator('.season-select').inputValue(),'2');console.log('PASS ending preview, next/previous navigation across seasons and last-episode boundary');
 await page.locator('#watch-save').click();await page.locator('[data-nav="saved"]').first().click();await page.waitForFunction(()=>document.querySelectorAll('#movie-grid .movie-card').length===1);assert.match(await page.locator('#movie-grid .movie-title').textContent(),/Extraordinary/);assert.equal(await page.locator('#video').evaluate(v=>v.paused),true);console.log('PASS saving an episode saves its series; leaving page pauses playback');
 await page.goto(base+'/title/4');await page.locator('.title-name').waitFor();assert.equal(await page.locator('.seasons-panel').isVisible(),false);await page.locator('.title-play').click();await page.waitForFunction(()=>document.getElementById('video').currentTime>.2);await page.locator('.title-back').click();assert.equal(await page.locator('#video').evaluate(v=>v.paused),true);
 for(const width of [320,360,390,540,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});await page.goto(base+'/title/'+root.id);await page.locator('.title-name').waitFor();await noOverflow(page,'Title overflow at '+width);assert.ok(await page.locator('.title-description').evaluate(n=>parseFloat(getComputedStyle(n).fontSize))>=15);
  if([390,1440].includes(width))await page.screenshot({path:'artifacts/series-'+width+'.png',fullPage:true});
 }console.log('PASS responsive title/episode layout at eight widths from 320 to 1920 pixels');
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});mobile.on('pageerror',e=>errors.push(e.message));
 await mobile.goto(base+'/title/'+root.id+'?season=1&episode=1');await mobile.waitForFunction(()=>document.getElementById('video').currentTime>.2);await mobile.locator('#player').scrollIntoViewIfNeeded();await mobile.locator('#video').evaluate(v=>v.currentTime=30);await mobile.waitForFunction(()=>!document.getElementById('video').seeking);
 let box=await mobile.locator('#player').boundingBox();await mobile.touchscreen.tap(box.x+box.width*.55,box.y+box.height*.35);await mobile.waitForTimeout(500);assert.equal(await mobile.locator('#video').evaluate(v=>v.paused),true);
 await mobile.touchscreen.tap(box.x+box.width*.55,box.y+box.height*.35);await mobile.waitForTimeout(500);assert.equal(await mobile.locator('#video').evaluate(v=>v.paused),false);
 box=await mobile.locator('#player').boundingBox();let before=await mobile.locator('#video').evaluate(v=>v.currentTime);await mobile.touchscreen.tap(box.x+box.width*.82,box.y+box.height*.3);await mobile.touchscreen.tap(box.x+box.width*.82,box.y+box.height*.3);await mobile.waitForTimeout(450);let after=await mobile.locator('#video').evaluate(v=>({time:v.currentTime,paused:v.paused}));await mobile.screenshot({path:'artifacts/series-mobile-seek.png'});assert.ok(after.time>=before+9&&after.time<before+12);assert.equal(after.paused,false);console.log('PASS phone single tap pause/resume and double tap seeking');
 await mobile.goto(base);await mobile.locator('#search-toggle').click();await mobile.locator('#search').fill('Extraordinary');await mobile.locator('.search-result').waitFor();await noOverflow(mobile,'Search overflow');await mobile.screenshot({path:'artifacts/series-search-mobile.png'});await mobile.locator('.search-result').click();await mobile.locator('.title-name').waitFor();await mobile.goBack();await mobile.locator('#hero').waitFor();console.log('PASS mobile logo search and browser Back');
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/admin/');await page.locator('#password').fill(password);await page.locator('#auth-submit').click();await page.locator('#movie-list tr').first().waitFor();
 await page.getByRole('button',{name:'+ Serial /',exact:false}).click();await page.locator('#collection-name').fill('New Cartoon');await page.locator('#collection-type').selectOption('animation');await page.locator('.series-create [type=submit]').click();await page.locator('#editor-title').waitFor();await page.waitForFunction(()=>!document.querySelector('.series-management').hidden);
 await page.locator('#season-number').fill('2');await page.locator('#season-name').fill('New season');await page.locator('.season-form [type=submit]').click();await page.waitForFunction(()=>document.querySelector('#admin-season').value==='2');
 await page.locator('#episode-video').fill('4');await page.locator('#episode-season').fill('2');await page.locator('#episode-number').fill('1');await page.locator('.episode-form [type=submit]').click();await page.locator('.admin-episode-row').waitFor();assert.match(await page.locator('.admin-episode-row strong').textContent(),/Standalone/);console.log('PASS admin creates collection, season and links an uploaded video through authenticated API');
 await page.locator('.admin-episode-row').getByRole('button',{name:'Tahrirlash',exact:true}).click();await page.waitForFunction(()=>document.getElementById('movie-title').value==='Standalone film');await page.locator('#movie-title').fill('Cartoon Episode');await page.locator('#save-movie').click();await page.getByText('Film va tanlangan rasmlar saqlandi.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Serial fasllariga qaytish',exact:false}).click();await page.locator('.admin-episode-row').waitFor();assert.match(await page.locator('.admin-episode-row strong').textContent(),/Cartoon Episode/);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 await page.locator('#logo-file').setInputFiles({name:'wordmark.png',mimeType:'image/png',buffer:png});await page.locator('#save-movie').click();await page.locator('.upload-stage.done').waitFor();assert.deepEqual(calls,['logo']);console.log('PASS child metadata editing and separate logo upload with Telegram confirmation');
 await page.locator('[data-page="home"]').click();await page.locator('#selection-sound-enabled').uncheck();await page.locator('#save-home').click();await page.getByText('Bosh sahifa tanlovi saqlandi.',{exact:true}).waitFor();assert.equal((await(await page.request.get(base+'/api/catalog')).json()).home.selection_sound_enabled,false);
 await page.setViewportSize({width:390,height:844});await noOverflow(page,'Admin overflow');await page.screenshot({path:'artifacts/series-admin-mobile.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS persistent sound setting, mobile admin layout and zero browser runtime errors');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));db.close();}
