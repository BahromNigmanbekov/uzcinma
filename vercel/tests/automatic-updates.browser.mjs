import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5176');await page.locator('#movie-grid .movie-card').first().waitFor();
 await page.locator('#movie-grid .poster-button').first().click();await page.locator('#detail-play').click();
 await page.waitForFunction(()=>video.currentTime>.3);
 const current=await page.locator('#video').evaluate(v=>v.currentSrc);
 await page.route('**/api/catalog?**',async route=>{
  const upstream=await route.fetch();const data=await upstream.json();
  const item={...data.movies[0],id:'9876543',title:'Automatic refresh test'};
  data.movies.unshift(item);data.total++;
  await route.fulfill({response:upstream,json:data});
 });
 await page.getByRole('heading',{name:'Automatic refresh test',exact:true}).first().waitFor({timeout:15000});
 assert.equal(await page.locator('#video').evaluate(v=>v.currentSrc),current);
 assert.equal(await page.locator('#video').evaluate(v=>v.paused),false);
 assert.deepEqual(errors,[]);
 console.log('PASS new API records appear automatically while the current video keeps playing.');
}finally{await browser.close();}
