import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {adminFixture} from './helpers/admin-fixture.mjs';
const retryMode=process.env.TEST_ADMIN_RETRY==='1';
const f=await adminFixture({uploadDelay:120,failUploads:retryMode?1:0,failRefreshes:retryMode?1:0});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const checks=[],errors=[];let page;
const check=(v,label)=>{assert.ok(v,label);checks.push(label);console.log('PASS '+label);};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
try{
 page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 // All admin writes go to an isolated fixture. No real Telegram messages or user catalog changes.
 await page.route('**/api/manage/**',async route=>{
  const original=new URL(route.request().url());const response=await route.fetch({url:f.origin+original.pathname+original.search,headers:{...route.request().headers(),origin:f.origin}});
  await route.fulfill({response});
 });
 await page.goto('http://127.0.0.1:5176/admin/');
 await page.getByRole('heading',{name:'Admin parolini belgilang'}).waitFor();
 check(await page.locator('#auth-screen').isVisible(),'first run offers password setup');
 await page.locator('#password').fill('browser-test-password');await page.locator('#confirm-password').fill('browser-test-password');await page.locator('#auth-submit').click();
 await page.locator('#movie-list tr').first().waitFor();
 check(await page.locator('#stat-total').textContent()==='1','catalog opens after secure login');
 mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/admin-library-desktop.png',fullPage:true});
 check(await page.locator('#video-file').count()===0,'video upload is absent from the admin');
 await page.waitForFunction(()=>document.getElementById('open-bot').href==='https://t.me/uzcinma_test_bot');
 check(await page.locator('#open-bot').getAttribute('href')==='https://t.me/uzcinma_test_bot','new films are uploaded through the bot link');
 await page.getByRole('button',{name:'Tahrirlash',exact:true}).first().click();await page.locator('#movie-title').fill('Botdan yuklangan multfilm');await page.locator('#movie-description').fill('Barcha fayllar test Telegram adapteriga yuboriladi.');
 await page.locator('#movie-type').selectOption('animation');await page.locator('#movie-year').fill('2026');await page.locator('#movie-rating').fill('8.5');
 await page.locator('#genre-options input[value="fantasy"]').check();
 await page.locator('#banner-file').setInputFiles({name:'banner.png',mimeType:'image/png',buffer:png});
 await page.locator('#poster-file').setInputFiles({name:'poster.png',mimeType:'image/png',buffer:png});
 await page.screenshot({path:'artifacts/admin-editor-desktop.png',fullPage:true});
 await page.locator('#save-movie').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.upload-stage')].some(n=>n.textContent.includes('Telegramga')||n.classList.contains('error')));
 check(await page.locator('.upload-card').count()>=1,'upload progress shows separate receiving and Telegram stages');
 await page.screenshot({path:'artifacts/admin-upload-progress.png',fullPage:true});
 if(retryMode){
  for(let attempt=0;attempt<2;attempt++){
   await page.locator('.upload-stage.error').first().waitFor({timeout:15000});
   await page.waitForFunction(()=>!document.getElementById('save-movie').disabled);
   await page.locator('.retry-job:visible').first().click();
  }
 }
 await page.waitForFunction(()=>document.querySelectorAll('.upload-stage.done').length===2,{},{timeout:20000});
 check(f.calls.map(c=>c.kind).join(',')===(retryMode?'banner,banner,poster':'banner,poster'),'only banner and poster are uploaded; the existing video stays intact');
 const movie=(await f.db.execute("SELECT * FROM movies WHERE title='Botdan yuklangan multfilm'")).rows[0];
 check(Boolean(movie?.banner_file_id&&movie.poster_file_id),'images saved against the new film');
 check(JSON.parse(movie.genres).includes('animation')&&JSON.parse(movie.genres).includes('fantasy'),'selected categories persist');
 await page.locator('[data-page="library"]').click();await page.locator('#library-search').fill('Botdan yuklangan');
 check(await page.locator('#movie-list tr').count()===1,'admin catalog search works');
 await page.locator('#movie-list .small-button.danger').click();
 await page.waitForFunction(()=>document.querySelectorAll('#movie-list tr').length===0);
 await page.locator('#visibility-filter').selectOption('hidden');
 await page.locator('#movie-list tr').first().waitFor();check(await page.locator('#movie-list .badge').textContent()==="O'chirilgan",'film can be removed from the site and restored');
 await page.getByRole('button',{name:'Tiklash',exact:true}).click();
 await page.locator('#visibility-filter').selectOption('active');await page.locator('#movie-list tr').first().waitFor();
 await page.locator('[data-page="home"]').click();await page.locator('#hero-auto').uncheck();
 await page.locator('#hero-candidates').getByRole('checkbox',{name:'Botdan yuklangan multfilm',exact:true}).check();
 await page.locator('#recommend-auto').uncheck();await page.locator('#recommend-candidates').getByRole('checkbox',{name:'Botdan yuklangan multfilm',exact:true}).check();
 await page.locator('#save-home').click();await page.getByText('Bosh sahifa tanlovi saqlandi.',{exact:true}).waitFor();
 const setting=(await f.db.execute("SELECT value FROM site_settings WHERE key='hero_ids'")).rows[0];
 check(JSON.parse(setting.value)[0]===String(movie.id),'homepage selection saves the chosen film');
 await page.screenshot({path:'artifacts/admin-home-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile admin fits the viewport');
 await page.screenshot({path:'artifacts/admin-home-mobile.png',fullPage:true});
 await page.locator('[data-page="library"]').click();await page.getByRole('button',{name:'Tahrirlash',exact:true}).first().click();await page.screenshot({path:'artifacts/admin-editor-mobile.png',fullPage:true});
 check(await page.locator('#logout-mobile').isVisible(),'mobile logout is accessible');
 await page.locator('#logout-mobile').click();await page.getByRole('heading',{name:'Admin panelga kirish'}).waitFor();
 await page.locator('#password').fill('browser-test-password');await page.locator('#auth-submit').click();await page.locator('#movie-list tr').first().waitFor();
 check(await page.locator('#app').isVisible(),'login works with the chosen password');
 check(errors.length===0,'no admin browser runtime errors');
}catch(error){console.error(error);process.exitCode=1;await page?.screenshot({path:'artifacts/admin-failure.png',fullPage:true}).catch(()=>{});}
finally{mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/admin-browser-checks.json',JSON.stringify({checks:checks.length,results:checks,errors},null,2));await browser.close();await f.close();}
