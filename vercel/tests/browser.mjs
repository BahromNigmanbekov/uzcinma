import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5176';
const artifacts='artifacts';mkdirSync(artifacts,{recursive:true});
const errors=[],checks=[];const check=(value,label)=>{assert.ok(value,label);checks.push(label);console.log('PASS '+label);};
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let page;
async function screenshot(name){
 await page.evaluate(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=700){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}window.scrollTo(0,0);});
 await page.screenshot({path:artifacts+'/'+name+'.png',fullPage:true});
}
try{
 page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('#movie-grid .movie-card').first().waitFor();
 check(await page.locator('#movie-grid .movie-card').count()===12,'initial twelve-card movie grid');
 check(await page.locator('#movie-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length)===6,'six columns on desktop');
 await screenshot('desktop');
 await page.locator('#trend-next').click();
 check(await page.locator('#trend-swiper').evaluate(e=>e.swiper.activeIndex)>0,'swiper navigation advances real slides');
 await page.locator('.hero-pagination .swiper-pagination-bullet').nth(1).click();
 check(await page.locator('#hero').evaluate(e=>e.swiper.activeIndex)===1,'hero slider navigation');
 await page.locator('#search-toggle').click();await page.locator('#search').fill('The Meg');
 await page.waitForFunction(()=>document.querySelectorAll('#movie-grid .movie-card').length===1);
 check(await page.locator('#movie-grid .movie-title').textContent()==='The Meg','search filters catalog');
 await page.locator('#search').fill('');await page.waitForFunction(()=>document.querySelectorAll('#movie-grid .movie-card').length===12);await page.locator('#search-close').click();
 await page.locator('#movie-genres button').filter({hasText:/^Multfilm$/}).click();
 await page.waitForFunction(()=>document.querySelectorAll('#movie-grid .movie-card').length<12);
 check((await page.locator('#movie-grid .movie-title').allTextContents()).includes('Incredibles 2'),'animation category works');
 await page.locator('#movie-genres button').filter({hasText:/^Barchasi$/}).click();await page.waitForFunction(()=>document.querySelectorAll('#movie-grid .movie-card').length===12);
 await page.locator('#movie-grid .save-button').first().click();await page.locator('[data-nav="saved"]').first().click();
 await page.waitForFunction(()=>document.querySelectorAll('#movie-grid .movie-card').length===1);
 check(await page.locator('#movie-grid .movie-title').textContent()==='Deadpool 2','saved list displays selected movie');
 await page.locator('[data-nav="home"]').first().click();await page.waitForFunction(()=>document.querySelectorAll('#movie-grid .movie-card').length===12);
 await page.locator('#movie-grid .poster-button').first().click();
 check(await page.locator('#title-page').isVisible(),'movie details opens');
 check(await page.locator('.title-play').isDisabled(),'unconfigured movie has no playback button');
 check(await page.locator('#video').evaluate(v=>!v.currentSrc),'unconfigured movie never pretends to play another film');
 await page.locator('.title-back').click();await page.locator('#demo-player').click();
 await page.waitForFunction(()=>document.getElementById('video').currentTime>1,{},{timeout:30000});
 check(await page.locator('#video').evaluate(v=>v.duration>600&&!v.paused),'actual HLS sample plays');
 await page.locator('#settings-toggle').click();
 const options=await page.locator('#quality option').allTextContents();
 check(['480p','720p','1080p'].every(q=>options.includes(q)),'480p 720p 1080p read from actual HLS manifest');
 for(const label of ['480p','720p','1080p']){
  await page.locator('#quality').selectOption({label});
  const start=await page.locator('#video').evaluate(v=>v.currentTime);
  await page.waitForFunction(t=>document.getElementById('video').currentTime>t+0.3,start,{timeout:15000});
  check(await page.locator('#quality option:checked').textContent()===label,label+' selection preserves playback');
 }
 await page.locator('#speed').selectOption('1.5');check(await page.locator('#video').evaluate(v=>v.playbackRate)===1.5,'playback rate control');
 await page.locator('#settings-toggle').click();await page.locator('#play').click();
 check(await page.locator('#video').evaluate(v=>v.paused),'custom pause');
 await page.locator('#video').evaluate(v=>{v.currentTime=30;});
 await page.locator('#rewind').click();check(Math.abs(await page.locator('#video').evaluate(v=>v.currentTime)-20)<1,'rewind ten seconds');
 await page.locator('#forward').click();check(Math.abs(await page.locator('#video').evaluate(v=>v.currentTime)-30)<1,'forward ten seconds');
 await page.locator('#progress').evaluate(e=>{e.value='500';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
 check(await page.locator('#video').evaluate(v=>Math.abs(v.currentTime-v.duration/2)<1),'red progress slider seeks');
 await page.locator('#mute').click();check(await page.locator('#video').evaluate(v=>v.muted),'mute control');
 await page.locator('#settings-toggle').click();await page.locator('#player').screenshot({path:artifacts+'/player-desktop.png'});await page.locator('#settings-toggle').click();
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:844});await page.waitForTimeout(120);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow at '+width+'px');
  if(width===390)await screenshot('mobile');
  if(width===768)await screenshot('tablet');
 }
 const phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const mobile=await phone.newPage();mobile.on('pageerror',e=>errors.push(e.message));
 await mobile.goto(base);await mobile.locator('#demo-player').click();
 await mobile.waitForFunction(()=>document.getElementById('video').currentTime>1,{},{timeout:30000});
 await mobile.locator('#play').click();await mobile.locator('#video').evaluate(v=>{v.currentTime=30;});
 const box=await mobile.locator('#player').boundingBox();
 await mobile.touchscreen.tap(box.x+box.width*.8,box.y+box.height*.48);await mobile.touchscreen.tap(box.x+box.width*.8,box.y+box.height*.48);
 check(Math.abs(await mobile.locator('#video').evaluate(v=>v.currentTime)-40)<1,'phone double tap right seeks forward');
 await mobile.touchscreen.tap(box.x+box.width*.2,box.y+box.height*.48);await mobile.touchscreen.tap(box.x+box.width*.2,box.y+box.height*.48);
 check(Math.abs(await mobile.locator('#video').evaluate(v=>v.currentTime)-30)<1,'phone double tap left seeks backward');
 await mobile.locator('#menu-toggle').click();check(await mobile.locator('#mobile-nav').isVisible(),'phone menu opens');
 await mobile.locator('#player').screenshot({path:artifacts+'/player-mobile.png'});
 await phone.close();check(errors.length===0,'no browser runtime errors');
}catch(error){console.error(error);process.exitCode=1;await page?.screenshot({path:artifacts+'/failure.png',fullPage:true}).catch(()=>{});}
finally{writeFileSync(artifacts+'/browser-checks.json',JSON.stringify({checks:checks.length,results:checks,errors},null,2));await browser.close();}
