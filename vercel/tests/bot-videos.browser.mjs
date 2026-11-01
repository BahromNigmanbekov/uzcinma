import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('artifacts',{recursive:true});
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5176';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let page;const errors=[],checks=[];const check=(value,label)=>{assert.ok(value,label);checks.push(label);console.log('PASS '+label);};
try{
 page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('#movie-grid .movie-card').first().waitFor();
 const catalog=await(await page.request.get(base+'/api/catalog')).json();
 check(catalog.provider==='bot-export'&&catalog.movies.every(m=>!m.is_demo),'uploaded catalog replaces demo movies');
 check(await page.locator('#movie-grid .movie-card').count()===Math.min(12,catalog.total),'uploaded movies appear in the grid');
 check(await page.locator('#demo-player').isHidden(),'demo playback button is hidden');
 for(let i=0;i<Math.min(catalog.total,3);i++){
  await page.locator('#movie-grid .poster-button').nth(i).click();await page.locator('#detail-play').click();
  await page.waitForFunction(()=>document.getElementById('video').currentTime>.5,{},{timeout:15000});
  const video=await page.locator('#video').evaluate(v=>({src:new URL(v.currentSrc).pathname,duration:v.duration,time:v.currentTime,paused:v.paused}));
  check(video.src.startsWith('/media/video-')&&video.duration>0&&!video.paused,'uploaded video '+catalog.movies[i].id+' really plays');
  await page.locator('#play').click();
 }
 const source=await page.locator('#video').evaluate(v=>new URL(v.currentSrc).pathname);
 const range=await page.request.get(base+source,{headers:{Range:'bytes=0-1023'}});
 check(range.status()===206&&(await range.body()).length===1024,'video supports HTTP Range for seeking');
 await page.locator('#settings-toggle').click();
 check((await page.locator('#quality option').allTextContents()).join()==='Asl sifat','only the actual original quality is offered');
 await page.locator('#settings-toggle').click();await page.locator('#video').evaluate(v=>{v.currentTime=5;});
 await page.locator('#forward').click();check(Math.abs(await page.locator('#video').evaluate(v=>v.currentTime)-15)<1,'seek forward works on the uploaded video');
 await page.locator('#rewind').click();check(Math.abs(await page.locator('#video').evaluate(v=>v.currentTime)-5)<1,'seek backward works on the uploaded video');
 await page.locator('#search-toggle').click();await page.locator('#search').fill(catalog.movies[0].title);
 await page.waitForFunction(title=>[...document.querySelectorAll('#movie-grid .movie-title')].every(n=>n.textContent.includes(title)),catalog.movies[0].title);
 check(await page.locator('#movie-grid .movie-title').first().textContent()===catalog.movies[0].title,'uploaded title search works');
 await page.locator('#search').fill('');await page.waitForFunction(n=>document.querySelectorAll('#movie-grid .movie-card').length===n,Math.min(12,catalog.total));await page.locator('#search-close').click();
 await page.locator('#movie-grid .save-button').first().click();await page.locator('[data-nav="saved"]').first().click();
 await page.waitForFunction(()=>document.querySelectorAll('#movie-grid .movie-card').length===1);
 check(await page.locator('#movie-grid .movie-card').count()===1,'uploaded movie can be saved');
 await page.locator('[data-nav="home"]').first().click();await page.waitForFunction(n=>document.querySelectorAll('#movie-grid .movie-card').length===n,Math.min(12,catalog.total));
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'artifacts/bot-videos-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile has no horizontal overflow');
 await page.screenshot({path:'artifacts/bot-videos-mobile.png',fullPage:true});
 check(errors.length===0,'no browser runtime errors');
}catch(error){console.error(error);process.exitCode=1;await page?.screenshot({path:'artifacts/bot-videos-failure.png',fullPage:true}).catch(()=>{});}
finally{writeFileSync('artifacts/bot-videos-checks.json',JSON.stringify({checks:checks.length,results:checks,errors},null,2));await browser.close();}
