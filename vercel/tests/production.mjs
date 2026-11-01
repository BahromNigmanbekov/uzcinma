import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1200,height:1000}});
const errors=[],requests=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
async function shot(name){
 await page.evaluate(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=600){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,80));}});
 await page.waitForFunction(()=>[...document.querySelectorAll('#movie-grid img,#recommend-grid img')].every(i=>i.complete&&i.naturalWidth>0));
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'artifacts/'+name+'.png',fullPage:true});
}
try{
 await page.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:5180/');await page.locator('#movie-grid .movie-card').first().waitFor();
 assert.equal(requests.some(u=>u.includes('player-hls')),false);console.log('PASS production initial page defers HLS library and video bytes');
 await shot('desktop-final');assert.deepEqual(failed,[]);console.log('PASS production posters loaded without failed requests');
 await page.setViewportSize({width:390,height:844});await shot('mobile-final');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 console.log('PASS final production mobile fits viewport');
 await page.setViewportSize({width:1440,height:1000});await page.locator('#demo-player').click();
 await page.waitForFunction(()=>video.currentTime>1,{},{timeout:30000});
 assert.equal(requests.some(u=>u.includes('player-hls')),true);
 await page.locator('#settings-toggle').click();await page.locator('#quality').selectOption({label:'480p'});
 await page.waitForFunction(()=>video.videoHeight===480,{},{timeout:20000});console.log('PASS actual decoded resolution becomes 480p');
 await page.locator('#quality').selectOption({label:'1080p'});
 await page.waitForFunction(()=>video.videoHeight===1080,{},{timeout:20000});console.log('PASS actual decoded resolution becomes 1080p');
 await page.locator('#player').screenshot({path:'artifacts/player-quality-final.png'});
 const paused=await page.locator('#video').evaluate(v=>v.paused);await page.locator('#settings-toggle').focus();await page.keyboard.press('Space');
 assert.equal(await page.locator('#video').evaluate(v=>v.paused),paused);assert.equal(await page.locator('#settings-panel').isHidden(),true);
 console.log('PASS keyboard activates focused control');
 assert.deepEqual(errors,[]);console.log('PASS production browser has no runtime errors');
 writeFileSync('artifacts/production-checks.json',JSON.stringify({passed:true,errors,decodedQualities:[480,1080],initialHlsDeferred:true},null,2));
}catch(error){console.error(error);process.exitCode=1;await page.screenshot({path:'artifacts/production-failure.png',fullPage:true});}
finally{await browser.close();}
