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
 await db.execute({sql:'INSERT INTO movies(id,title,description,genres,type,year,rating,duration,poster_url,backdrop_url,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',args:[id,id===4?'Standalone film':'Episode '+id,'A full description of this story. This paragraph should remain legible on small screens.',JSON.stringify(['fantasy']),'movie',2026,8.5,660,'/assets/uzcinma-poster.png','/assets/uzcinma-banner.png',1,1]});
 await db.execute({sql:'INSERT INTO sources(movie_id,quality,url) VALUES(?,?,?)',args:[id,'original',video]});
}
const root=await createCollection(db,{title:'The Extraordinary Story of a Very Long Adventure Across Worlds',description:'Serial haqida to\u2018liq ma\u2019lumot. Bu tavsif kichik va katta ekranlarda qulay o\u2018qilishi kerak.\nHar bir faslda o\u2018zining qismlari bo\u2018ladi.',type:'series',genres:['fantasy','drama'],year:2026,rating:8.9});
await db.execute({sql:'UPDATE movies SET logo_url=?,poster_url=?,backdrop_url=? WHERE id=?',args:['/fixture-logo.svg','/assets/uzcinma-poster.png','/assets/uzcinma-banner.png',Number(root.id)]});
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

const longDescription=('A detailed description with all the information about this film. ').repeat(120);
await db.execute({sql:'UPDATE movies SET description=? WHERE id=?',args:[longDescription,Number(root.id)]});
async function viewportCheck(page,width,height,tv=false){
 await page.setViewportSize({width,height});await page.goto(base+'/title/'+root.id);await page.locator('.title-logo').waitFor();
 const layout=await page.evaluate(()=>{const r=n=>{const b=n.getBoundingClientRect();return {top:b.top,bottom:b.bottom,height:b.height};};return {intro:r(document.querySelector('.title-intro')),play:r(document.querySelector('.title-play')),save:r(document.querySelector('.title-save')),overflow:document.documentElement.scrollWidth>innerWidth};});
 assert.equal(layout.overflow,false,'horizontal overflow '+width+'x'+height);assert.ok(layout.play.bottom<=height+1&&layout.save.bottom<=height+1,'CTA outside first screen '+JSON.stringify({width,height,layout}));
 if(width>=768)assert.ok(Math.abs(layout.intro.height-height)<2,'detail not 100vh');
 await page.locator('.title-read-more').click();assert.equal(await page.locator('.full-description').textContent(),longDescription);await page.keyboard.press('Escape');
 await page.goto(base);await page.locator('.hero-content').first().waitFor();assert.ok(Math.abs((await page.locator('#hero').boundingBox()).height-height)<2,'hero not 100vh');
 const cta=await page.locator('.swiper-slide-active .hero-buttons').boundingBox();assert.ok(cta&&cta.y+cta.height<=height,'hero CTA outside '+width+'x'+height);
 await noOverflow(page,'home '+width);if(width===1440||width===390||tv)await page.screenshot({path:'artifacts/display-'+(tv?'tv-':'')+width+'x'+height+'.png'});
}
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));
 for(const [w,h]of [[1920,1080],[1440,900],[1366,768],[1280,720],[1024,600],[1920,500],[320,568],[390,844],[768,1024]])await viewportCheck(page,w,h);
 console.log('PASS long description and logo: first-screen CTAs, full-text dialog, 100vh hero/detail and no overflow at nine viewports');
 await page.setViewportSize({width:1440,height:900});await page.goto(base+'/title/'+root.id);await page.locator('.episode-card').first().waitFor();
 const season=page.locator('.seasons-heading .ui-select-trigger');await season.click();await page.getByRole('option',{name:'2-fasl',exact:false}).click();await page.waitForFunction(()=>document.querySelectorAll('.episode-card').length===1);assert.equal(await page.locator('.season-select').inputValue(),'2');
 await season.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Home');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.episode-card').length===2);
 await page.locator('.title-play').click();await page.waitForFunction(()=>document.getElementById('video').currentTime>.2);
 await page.locator('#settings-toggle').click();await page.locator('[data-select-for=speed] .ui-select-trigger').click();await page.getByRole('option',{name:'1.5x',exact:true}).click();assert.equal(await page.locator('#video').evaluate(v=>v.playbackRate),1.5);
 await page.locator('#speed').selectOption('1');assert.equal(await page.locator('[data-select-for=speed] .ui-select-value').textContent(),'1x');
 await page.locator('[data-select-for=speed] .ui-select-trigger').click();const menu=page.locator('.ui-select-menu:not([hidden])');assert.ok(await menu.evaluate(n=>{const r=n.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));await page.keyboard.press('Escape');
 console.log('PASS styled season and speed choices, keyboard, dynamic native form synchronization and viewport-fit popup');
 await page.locator('#fullscreen').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));await page.locator('#settings-toggle').click();await page.locator('[data-select-for=speed] .ui-select-trigger').click();assert.equal(await page.locator('.ui-select-menu').evaluate(n=>document.fullscreenElement.contains(n)),true);await page.keyboard.press('Escape');await page.evaluate(()=>document.exitFullscreen());
 await page.goto(base+'/title/4');await page.locator('.title-play').click();await page.waitForFunction(()=>document.getElementById('video').currentTime>.2);await page.evaluate(()=>document.getElementById('player').requestFullscreen=undefined);await page.locator('#fullscreen').click();await page.locator('.player.is-fullscreen').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('.player.is-fullscreen').count(),0);assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('site-fullscreen')),false);
 console.log('PASS native fullscreen menus and fallback fullscreen escape cleanup');
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(base+'/title/4');await mobile.locator('.title-play').click();await mobile.waitForFunction(()=>document.getElementById('video').currentTime>.2);await mobile.locator('#player').scrollIntoViewIfNeeded();await mobile.waitForTimeout(400);
 const session=await mobile.context().newCDPSession(mobile);
 let box=await mobile.locator('#player').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height*.3;
 const touch=(id,x,y)=>({id,x,y,radiusX:2,radiusY:2});
 const source=await mobile.locator('#video').evaluate(v=>v.currentSrc);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(1,cx-25,cy),touch(2,cx+25,cy)]});
 for(const d of [40,60,80])await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(1,cx-d,cy),touch(2,cx+d,cy)]});
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mobile.waitForTimeout(500);
 let zoom=await mobile.evaluate(()=>({scale:Number(document.getElementById('player').dataset.videoScale),pageScale:visualViewport.scale,paused:document.getElementById('video').paused,src:document.getElementById('video').currentSrc}));
 assert.ok(zoom.scale>2,'two finger pinch should zoom actual video '+JSON.stringify(zoom));assert.equal(zoom.pageScale,1);assert.equal(zoom.paused,false);assert.equal(zoom.src,source);
 const transformBefore=await mobile.locator('#video').evaluate(v=>v.style.transform);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(1,cx,cy)]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(1,cx+55,cy+20)]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mobile.waitForTimeout(500);
 assert.notEqual(await mobile.locator('#video').evaluate(v=>v.style.transform),transformBefore);assert.equal(await mobile.locator('#video').evaluate(v=>v.paused),false);
 await mobile.screenshot({path:'artifacts/display-video-pinched.png'});await mobile.locator('.video-zoom-reset').click();assert.equal(await mobile.locator('#player').getAttribute('data-video-scale'),'1.000');await mobile.waitForTimeout(500);
 box=await mobile.locator('#player').boundingBox();await mobile.touchscreen.tap(box.x+box.width*.6,box.y+box.height*.3);await mobile.waitForTimeout(500);assert.equal(await mobile.locator('#video').evaluate(v=>v.paused),true);
 await mobile.touchscreen.tap(box.x+box.width*.6,box.y+box.height*.3);await mobile.waitForTimeout(500);assert.equal(await mobile.locator('#video').evaluate(v=>v.paused),false);
 let time=await mobile.locator('#video').evaluate(v=>v.currentTime);await mobile.touchscreen.tap(box.x+box.width*.85,box.y+box.height*.3);await mobile.touchscreen.tap(box.x+box.width*.85,box.y+box.height*.3);await mobile.waitForTimeout(500);assert.ok(await mobile.locator('#video').evaluate(v=>v.currentTime)>=time+9);
 console.log('PASS real two-finger touch zoom, bounded pan, unchanged video source/page scale/playback, reset and existing single/double taps');
 const tv=await browser.newPage({viewport:{width:1920,height:1080},userAgent:'Mozilla/5.0 (SMART-TV; Linux; Tizen 7.0) AppleWebKit/537.36 Chrome/94.0 TV Safari/537.36'});tv.on('pageerror',e=>errors.push(e.message));
 await viewportCheck(tv,1920,1080,true);assert.equal(await tv.locator('body').evaluate(n=>n.classList.contains('tv-mode')),true);
 await tv.locator('[data-nav=home]').first().focus();await tv.keyboard.press('ArrowRight');assert.equal(await tv.evaluate(()=>document.activeElement.dataset.nav),'movies');
 await tv.goto(base+'/title/'+root.id);await tv.locator('.title-play').waitFor();await tv.waitForTimeout(100);assert.equal(await tv.locator('.title-play').evaluate(n=>n===document.activeElement),true);
 await tv.locator('.seasons-heading .ui-select-trigger').focus();await tv.keyboard.press('Enter');await tv.keyboard.press('End');await tv.keyboard.press('Enter');await tv.locator('.episodes-empty').waitFor();await tv.keyboard.press('Escape');await tv.locator('#hero').waitFor();
 await viewportCheck(tv,3840,2160,true);
 await tv.locator('#info-toggle').click();await tv.locator('#info-dialog .tv-setting').click();await tv.keyboard.press('Escape');await tv.reload();assert.equal(await tv.locator('body').evaluate(n=>n.classList.contains('tv-mode')),false);
 console.log('PASS TV auto-detection, D-pad focus, OK/Back menus, 1080p/4K layouts and persisted manual mode');
 await page.goto(base+'/admin/');await page.locator('#password').fill(password);await page.locator('#auth-submit').click();await page.locator('#movie-list tr').first().waitFor();assert.equal(await page.locator('select:not(.ui-select-source)').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS admin selects enhanced and zero browser runtime errors');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));db.close();}
