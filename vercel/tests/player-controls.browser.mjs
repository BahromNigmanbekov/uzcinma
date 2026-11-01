import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('artifacts',{recursive:true});
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5176';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[],errors=[];
const check=(value,label)=>{assert.ok(value,label);results.push(label);console.log('PASS '+label);};
async function start(page){
 page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.goto(base);
 await page.locator('#movie-grid .poster-button').first().click();await page.locator('#detail-play').click();
 await page.waitForFunction(()=>document.getElementById('video').currentTime>.25,{},{timeout:15000});
}
async function visible(page){
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('player-controls')).opacity==='1',{},{timeout:2000});
 return page.locator('#player-controls').evaluate(e=>getComputedStyle(e).pointerEvents!=='none');
}
async function hidden(page){
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('player-controls')).opacity==='0',{},{timeout:2000});
 return page.locator('#player-controls').evaluate(e=>getComputedStyle(e).pointerEvents==='none');
}
let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:1000}});await start(page);
 await page.locator('#play').focus();
 await page.waitForTimeout(9000);
 check(await visible(page),'controls remain visible before ten seconds');
 await page.waitForTimeout(1400);
 check(await hidden(page),'controls hide after ten real seconds even when a button retains focus');
 check(await page.locator('#video').evaluate(v=>!v.paused&&v.currentTime>9),'hiding controls keeps video playing');
 const bounds=await page.locator('#player').boundingBox();
 await page.mouse.move(bounds.x+bounds.width*.55,bounds.y+bounds.height*.45);
 check(await visible(page),'mouse movement reveals controls');
 await page.clock.fastForward(10_100);
 check(await hidden(page),'controls hide again after renewed inactivity');
 await page.keyboard.press('ArrowRight');
 check(await visible(page),'keyboard action reveals controls');
 await page.locator('#settings-toggle').click();
 check(await page.locator('#settings-panel').isVisible(),'settings open during interaction');
 await page.clock.fastForward(10_100);
 check(await hidden(page)&&await page.locator('#settings-panel').isHidden(),'an idle open settings panel also closes and hides');
 await page.mouse.move(bounds.x+bounds.width*.5,bounds.y+bounds.height*.5);
 const slider=await page.locator('#progress').boundingBox();
 await page.mouse.move(slider.x+slider.width*.25,slider.y+slider.height/2);await page.mouse.down();
 await page.clock.fastForward(11_000);
 check(await visible(page),'controls stay visible while the seek slider is held');
 await page.mouse.up();await page.clock.fastForward(9_000);
 check(await visible(page),'releasing the slider starts a fresh ten-second timeout');
 await page.clock.fastForward(1_200);
 check(await hidden(page),'controls hide after the slider is no longer used');
 await page.mouse.click(2,2);
 check(await hidden(page),'clicking elsewhere on the page does not reveal the player');
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const mobile=await context.newPage();await start(mobile);await mobile.clock.fastForward(10_100);
 check(await hidden(mobile),'phone controls auto-hide');
 const phoneBounds=await mobile.locator('#player').boundingBox();
 await mobile.touchscreen.tap(phoneBounds.x+phoneBounds.width*.5,phoneBounds.y+phoneBounds.height*.45);
 await mobile.clock.fastForward(400);
 check(await visible(mobile)&&await mobile.locator('#video').evaluate(v=>v.paused),'phone tap pauses playback and reveals controls');
 await mobile.clock.fastForward(10_100);
 check(await visible(mobile),'paused phone playback keeps controls visible');
 await mobile.touchscreen.tap(phoneBounds.x+phoneBounds.width*.75,phoneBounds.y+phoneBounds.height*.45);await mobile.clock.fastForward(400);
 await mobile.waitForFunction(()=>!document.getElementById('video').paused);
 check(await visible(mobile),'a second single phone tap resumes playback');
 await mobile.clock.fastForward(10_100);
 check(await hidden(mobile),'phone controls hide again when unused');
 await context.close();
 check(errors.length===0,'no browser runtime errors');
}catch(error){console.error(error);process.exitCode=1;await page?.screenshot({path:'artifacts/player-controls-failure.png',fullPage:true}).catch(()=>{});}
finally{writeFileSync('artifacts/player-controls-checks.json',JSON.stringify({checks:results.length,results,errors},null,2));await browser.close();}
