import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFileSync,unlinkSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5176';
const media=resolve('public/media');const fixture='banner-regression-'+randomBytes(8).toString('hex')+'.png';const fixturePath=resolve(media,fixture);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[],results=[];let page;
const check=(value,label)=>{assert.ok(value,label);results.push(label);console.log('PASS '+label);};
try{
 page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 // Select this regression's film only in the browser; retain the owner's actual homepage selection.
 await page.route('**/api/catalog?**',async route=>{
  const response=await route.fetch(),catalog=await response.json();
  const film=catalog.movies.find(movie=>movie.id==='4');
  await route.fulfill({response,json:film?{...catalog,home:{...catalog.home,hero:[film]}}:catalog});
 });
 await page.goto(base);await page.locator('#movie-grid .movie-card').first().waitFor();
 const catalog=await(await page.request.get(base+'/api/catalog?limit=60')).json();
 const movie=catalog.movies.find(m=>m.id==='4');assert.ok(movie);
 const response=await page.request.get(base+movie.backdrop);
 check(response.status()===200&&response.headers()['content-type'].startsWith('image/jpeg'),'uploaded banner returns JPEG instead of HTML');
 const hash=createHash('sha256').update(await response.body()).digest('hex');
 check(movie.backdrop.includes(hash),'served banner matches the uploaded image bytes');
 const dimensions=await page.evaluate(async url=>{const img=new Image();img.src=url;await img.decode();return [img.naturalWidth,img.naturalHeight];},movie.backdrop);
 check(dimensions[0]>0&&dimensions[1]>0,'browser decodes the actual uploaded banner');
 check((await page.locator('#hero-slides .hero-slide').first().evaluate(e=>e.style.backgroundImage)).includes(movie.backdrop),'large hero uses the uploaded banner');
 mkdirSync('artifacts',{recursive:true});await page.locator('#hero').screenshot({path:'artifacts/banner-desktop-fixed.png'});
 await page.getByRole('button',{name:movie.title+' haqida',exact:true}).last().click();await page.locator('#detail-play').click();
 await page.waitForFunction(()=>video.currentTime>.3,{},{timeout:15000});
 const source=await page.locator('#video').evaluate(v=>new URL(v.currentSrc).pathname);
 const ranged=await page.request.get(base+source,{headers:{Range:'bytes=0-1023'}});
 check(ranged.status()===206&&(await ranged.body()).length===1024,'video seeking still uses correct byte ranges');
 let navigations=0;page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});
 check((await page.request.get(base+'/media/'+fixture)).status()===404,'missing media returns 404 rather than the page');
 writeFileSync(fixturePath,png);
 const fresh=await page.request.get(base+'/media/'+fixture);
 check(fresh.status()===200&&fresh.headers()['content-type']==='image/png','image added after server startup loads immediately');
 check(Buffer.from(await fresh.body()).equals(png),'new image response contains image bytes');
 await page.waitForTimeout(5500);
 check(navigations===0&&await page.locator('#video').evaluate(v=>!v.paused),'new uploads do not reload the page or interrupt playback');
 await page.locator('#play').click();await page.evaluate(()=>window.scrollTo(0,0));await page.setViewportSize({width:390,height:844});
 await page.locator('#hero').screenshot({path:'artifacts/banner-mobile-fixed.png'});
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile banner fits the viewport');
 check(errors.length===0,'no browser runtime errors');
 console.log('Banner image dimensions: '+dimensions.join('x'));
}catch(error){console.error(error);process.exitCode=1;await page?.screenshot({path:'artifacts/banner-failure.png',fullPage:true}).catch(()=>{});}
finally{
 if(dirname(fixturePath)===media)try{unlinkSync(fixturePath);}catch{}
 mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/banner-checks.json',JSON.stringify({checks:results.length,results,errors},null,2));await browser.close();
}
