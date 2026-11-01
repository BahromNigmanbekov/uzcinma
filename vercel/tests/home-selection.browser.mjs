import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),base='http://127.0.0.1:5176';const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const original=await(await page.request.get(base+'/api/catalog?limit=60')).json();
 const chosen=original.movies[1];assert.ok(chosen);let home={hero:[chosen],recommendations:[original.movies[0]]};
 await page.route('**/api/catalog?**',async route=>{const response=await route.fetch();const data=await response.json();await route.fulfill({response,json:{...data,home}});});
 await page.goto(base);await page.locator('#hero-slides .hero-slide h1').first().waitFor();
 assert.equal(await page.locator('#hero-slides .hero-slide h1').first().textContent(),chosen.title);
 assert.equal(await page.locator('#recommend-grid .movie-title').first().textContent(),original.movies[0].title);
 console.log('PASS public hero and recommendations follow admin order.');
 home={hero:[],recommendations:[]};
 await page.locator('#hero').waitFor({state:'hidden',timeout:15000});
 const header=await page.locator('#header').boundingBox(),trends=await page.locator('.trends').boundingBox();
 assert.ok(trends.y>=header.y+header.height-1);
 console.log('PASS empty hero selection hides the banner without overlapping navigation.');
 home={hero:[original.movies[0]],recommendations:[]};await page.locator('#hero').waitFor({state:'visible',timeout:15000});
 assert.equal(await page.locator('#hero-slides .hero-slide h1').first().textContent(),original.movies[0].title);
 assert.deepEqual(errors,[]);console.log('PASS homepage changes refresh without reloading.');
}finally{await browser.close();}
