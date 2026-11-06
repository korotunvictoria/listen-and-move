'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1080}});
  await page.addInitScript(()=>{
   const seed=sessionStorage.getItem('qa-seed');
   if(seed)localStorage.setItem('autumn-listening-progress-v1',seed);
  });
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(require('node:url').pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  async function load(object,preposition,landmark){
   await page.evaluate(({object,preposition,landmark})=>{
    const bank=window.TrainerQuestions,q=bank.find(q=>q.object===object&&q.preposition===preposition&&q.landmark===landmark);
    const ids=[q.id,...bank.filter(v=>v!==q).slice(0,14).map(v=>v.id)];
    sessionStorage.setItem('qa-seed',JSON.stringify({version:1,mastered:[],retry:[],sessions:0,cycle:1,active:{ids,index:0,outcomes:[],failed:false}}));
   },{object,preposition,landmark});
   await page.reload();await page.locator('#script-button').click();
  }
  async function drop(object,x,y,expectedSize=null){
   const item=await page.locator(`[data-object="${object}"]`).boundingBox(),scene=await page.locator('#scene').boundingBox();
   await page.mouse.move(item.x+item.width/2,item.y+item.height/2);await page.mouse.down();
   await page.mouse.move(scene.x+x*scene.width/1000,scene.y+y*scene.height/500,{steps:8});
   assert.equal(await page.locator('#preview image').count(),1,'Drag preview snaps');
   if(expectedSize!==null)assert(Math.abs(+(await page.locator('#preview image').getAttribute('width'))-expectedSize)<.001,'Preview immediately uses the slide size');
   await page.mouse.up();
   assert.equal(await page.locator('#placed image').count(),1,'Release places an object');
   if(expectedSize!==null)assert(Math.abs(+(await page.locator('#placed image').getAttribute('width'))-expectedSize)<.001,'Release preserves the preview size');
   assert.equal(await page.locator('[aria-pressed="true"]').count(),0,'Release clears selection');
   const overlap=await page.evaluate(()=>{
    const a=document.querySelector('#placed image').getBBox(),b=document.querySelector('#focus-label rect').getBBox();
    return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
   });
   assert.equal(overlap,false,'Caption does not cover the object');
  }
  for(const object of ['ball','apple','bottle','teddy','cat','kite','balloon']){
   await load('ball','in','fountain');await drop(object,420,326);
   const placement=await page.evaluate(()=>{
    const image=document.querySelector('#placed image'),clip=document.querySelector('#waterline rect');
    return {x:+image.getAttribute('x')+(+image.getAttribute('width'))/2,y:+image.getAttribute('y')+(+image.getAttribute('height'))/2,ratio:+clip.getAttribute('height')/(+image.getAttribute('height'))};
   });
   assert.deepEqual(placement,{x:560,y:326,ratio:.5});
   if(object==='cat')await page.screenshot({path:path.resolve('autumn-water-corrected.png')});
  }
  await load('cat','on','slide');await drop('cat',743,210);
  assert.equal(await page.locator('#feedback').textContent(),"That's right!");
  await page.screenshot({path:path.resolve('autumn-slide-caption-corrected.png')});
  for(const [x,y] of [[704,214],[710,208],[640,260],[680,248],[730,190],[770,157],[815,160],[870,170],[745,242]]){
   await load('apple','on','slide');await drop('apple',x,y,19.6);
   assert.equal(await page.locator('#feedback').textContent(),"That's right!",`Apple snaps at ${x},${y}`);
   if(x===704)await page.screenshot({path:path.resolve('autumn-slide-overlap-v6.png')});
  }
  await load('bottle','next to','slide');await drop('bottle',607,275,33.6);
  assert.equal(await page.locator('#feedback').textContent(),"That's right!");
  const bottleY=+(await page.locator('#placed image').getAttribute('y'));
  assert(bottleY>250,'The bottle stays beside the base');
  await page.screenshot({path:path.resolve('autumn-next-to-v6.png')});
  for(const [preposition,landmark,x,y] of [['behind','fountain',560,273],['next to','slide',640,294],['in front of','slide',705,309]]){
   await load('cat',preposition,landmark);await drop('cat',x,y);
   assert.equal(await page.locator('#feedback').textContent(),"That's right!");
  }
  await page.setViewportSize({width:390,height:844});
  await load('apple','on','slide');await drop('apple',704,214,19.6);
  assert.equal(await page.locator('#feedback').textContent(),"That's right!");
  await load('cat','on','slide');await drop('cat',743,210);
  await page.screenshot({path:path.resolve('autumn-caption-mobile-corrected.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS: browser drag previews and release for all seven water objects; half immersion; corrected boundaries; cat caption on desktop and mobile; no browser errors.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
