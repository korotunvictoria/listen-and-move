'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1080}}),requests=[],errors=[];
  page.on('request',request=>requests.push(request.url()));page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.locator('#scene').waitFor();
  assert.equal(await page.locator('.loading-screen').count(),0);
  assert(await page.locator('.objects img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0)));
  await page.waitForLoadState('networkidle');
  assert.equal(requests.filter(url=>url.endsWith('.png')).length,0,'The game does not request original PNGs');
  assert(requests.some(url=>url.endsWith('/park.webp')));
  assert(requests.some(url=>url.endsWith('/results.webp')),'The final picture loads before finishing the game');
  await page.screenshot({path:path.resolve('autumn-optimized-start-v7.png')});
  for(let i=0;i<15;i++)await page.locator('#skip').click();
  await page.locator('.results img').waitFor();
  assert(await page.locator('.results img').evaluate(image=>image.complete&&image.naturalWidth===1536));
  await page.screenshot({path:path.resolve('autumn-optimized-results-v7.png')});
  await page.locator('#again').click();await page.locator('#scene').waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: startup images ready together; only WebP requested; results preloaded and decoded before display; next session starts; no browser errors.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
