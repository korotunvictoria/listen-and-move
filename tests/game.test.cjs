'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Progress } = require('../progress.js');
const G = require('../geometry.js');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../questions.js'), 'utf8'), context);
const bank = context.window.TrainerQuestions, ids = Array.from(bank, q => q.id);
const values = new Map();
const storage = { getItem: key => values.get(key) || null, setItem: (key,value) => values.set(key,value) };
const p = new Progress(ids,storage,()=>.37);
const first = p.begin();
assert.equal(first.ids.length,15);
assert.equal(new Set(first.ids).size,15);
const mistaken = first.ids[0], skipped = first.ids[1], mastered = first.ids[2];
p.markError();
assert(p.state.retry.includes(mistaken));
let reload = new Progress(ids,storage,()=>.37);
assert.equal(reload.begin().ids[0],mistaken);
assert.equal(reload.state.active.failed,true);
reload.complete();
assert(reload.state.retry.includes(mistaken),'A correction must remain due');
reload.complete(true);
reload.complete();
assert(reload.state.mastered.includes(mastered));
const resume = new Progress(ids,storage,()=>.37);
assert.equal(resume.begin().index,3);
assert.equal(resume.state.active.outcomes.length,3);
let result;
while(resume.state.active) result=resume.complete();
assert(result.finished);
assert.equal(result.outcomes.length,15);
assert.equal(result.outcomes.filter(o=>o.kind==='first').length,13);
assert.equal(result.outcomes.filter(o=>o.kind==='corrected').length,1);
assert.equal(result.outcomes.filter(o=>o.kind==='skipped').length,1);
const second=resume.begin();
assert.deepEqual(new Set(second.ids.slice(0,2)),new Set([mistaken,skipped]));
assert(!second.ids.includes(mastered));
resume.complete();resume.complete();
assert(!resume.state.retry.includes(mistaken));
assert(!resume.state.retry.includes(skipped));
while(resume.state.active)resume.complete();
for(let i=0;i<100;i++){
 const a=resume.begin();assert.equal(a.ids.length,15);assert.equal(new Set(a.ids).size,15);
 while(resume.state.active)resume.complete();
}
const overflow=new Progress(ids,null,()=>.37);
overflow.state.retry=ids.slice(0,30);
assert(overflow.begin().ids.every(id=>overflow.state.retry.includes(id)));
const blocked=new Progress(ids,{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});
assert.equal(blocked.persistent,false);
assert.equal(blocked.begin().ids.length,15);
const corrupt=new Progress(ids,{getItem:()=>'{',setItem(){}});
assert.equal(corrupt.begin().ids.length,15);
for(const row of bank){
 const zone=G.zones.find(z=>z.id===row.preposition+'|'+row.landmark);
 assert(zone,row.id+' has a zone');
 assert(G.allows(zone,row.object),row.id+' permits its object');
 const anchor=zone.anchor||zone.anchors[0];
 const hit=G.resolve({x:anchor[0],y:anchor[1]},row.object,0);
 assert.equal(hit?.zone.id,zone.id,row.id+' correct anchor');
 const pose=G.pose(zone,row.object,{x:anchor[0],y:anchor[1]});
 assert(Number.isFinite(pose.x)&&Number.isFinite(pose.y)&&pose.size>0);
 const audio=path.join(__dirname,'..',row.audio);
 assert(fs.existsSync(audio));
 assert.equal(fs.readFileSync(audio).toString('ascii',0,4),'RIFF');
}
for(let x=800;x<875;x+=5)for(let y=200;y<279;y+=5){
 const hit=G.resolve({x,y},'ball',0);
 assert.notEqual(hit?.zone.id,'in front of|slide');
}
assert.equal(G.resolve({x:820,y:315},'ball',0).zone.id,'in front of|slide');
assert.equal(G.resolve({x:-1,y:300},'ball'),null);
assert.equal(G.resolve({x:500,y:800},'ball'),null);
for(const id of ['next to|fountain','next to|slide']){
 const zone=G.zones.find(z=>z.id===id);
 for(let i=0;i<2;i++){
  const a=zone.anchors[i],hit=G.resolve({x:a[0],y:a[1]},'ball',0);
  assert.equal(hit.zone.id,id);
  assert.equal(hit.shapeIndex,i,'The hit remembers which side was selected');
  const feedback=G.feedbackRegion(hit);
  assert.equal(feedback.shapeIndex,i);
  assert.equal(feedback.preposition,'next to');
  assert.equal((feedback.path.match(/M/g)||[]).length,1,'Only one side is highlighted');
  assert(feedback.path.includes('Q'),'Contour uses rounded quadratic curves');
  assert(!feedback.path.includes('L'),'No angular polygon outline');
 }
}
for(const zone of G.zones)for(const shape of zone.shapes){
 if(shape.type==='polygon'){
  assert(shape.curve.includes('Q'));
  assert(shape.points.length>50,'Hit testing follows the rounded curve');
 }
 assert(zone.labels.length>0,'Every zone has a preposition label');
}
for(const object of ['ball','cat','apple','teddy','bottle'])assert.equal(G.resolve({x:845,y:53},object,0),null);
const besideSlide=G.zones.find(z=>z.id==='next to|slide').shapes[0];
const fountainZones=G.zones.filter(z=>z.id.endsWith('|fountain'));
const slideSurface=G.zones.find(z=>z.id==='on|slide');
for(const object of ['ball','apple','bottle','teddy','cat','kite']){
 for(const [x,y] of [[595,255],[605,265],[607,282],[640,294]]){
  assert(G.inside({x,y},besideSlide),'The smaller area includes ground beside the slide foot');
  assert.equal(G.resolve({x,y},object,0)?.zone.id,'next to|slide');
 }
}
for(let x=560;x<=710;x+=2)for(let y=190;y<=310;y+=2){
 const point={x,y};
 if(!G.inside(point,besideSlide))continue;
 assert(!fountainZones.some(z=>z.shapes.some(shape=>G.inside(point,shape))),'The wider area does not overlap a fountain region');
 assert(!slideSurface.shapes.some(shape=>G.inside(point,shape)),'Beside the slide remains separate from on the slide');
}
for(const object of ['ball','apple','bottle','teddy','cat','kite']){
 for(const [x,y] of slideSurface.shapes[0].points){
  const hit=G.resolve({x,y},object,0,{width:40,height:40});
  assert.equal(hit?.zone.id,'on|slide','Every part of the slide perimeter accepts a dragged object');
 }
 const overlap=G.resolve({x:710,y:208},object,0,{width:40,height:40});
 assert.equal(overlap?.zone.id,'on|slide','Image overlap works with the pointer outside the slide');
 assert.equal(overlap.pose.size,G.pose(slideSurface,object,{x:817,y:164}).size,'Overlap applies the slide scale');
 assert.equal(G.resolve({x:607,y:282},object,0,{width:40,height:40})?.zone.id,'next to|slide','A direct placement beside the slide keeps its zone');
}
for(const [x,y] of [[605,220],[638,233],[675,220]])assert(!G.inside({x,y},besideSlide),'Bushes are outside the reduced next to area');
assert.equal(G.pose(G.zones.find(z=>z.id==='next to|slide'),'bottle',{x:607,y:282}).x,607);
assert(G.pose(G.zones.find(z=>z.id==='next to|slide'),'bottle',{x:607,y:282}).y>265,'The bottle snaps to the foot instead of the bushes');
for(const object of ['ball','apple','bottle','teddy','cat','kite','balloon']){
 for(const [x,y] of [[310,326],[477,326],[640,326],[560,310]]){
  const hit=G.resolve({x,y},object,0);
  assert.equal(hit?.zone.id,'in|fountain','Every object can enter the water');
  assert.equal(hit.pose.x,560,'Water placement snaps consistently');
  assert.equal(hit.pose.y,326);
 }
}
for(const [x,y] of [[610,270],[615,280],[640,294],[650,297]]){
 assert.equal(G.resolve({x,y},'cat',0)?.zone.id,'next to|slide','Ground beside the slide belongs to next to');
}
const slideFront=G.zones.find(z=>z.id==='in front of|slide');
for(let x=250;x<=1000;x+=2)for(let y=245;y<=365;y+=2){
 const point={x,y};
 if(!slideFront.shapes.some(shape=>G.inside(point,shape)))continue;
 assert(!G.zones.filter(z=>z.rim||z.water).some(z=>z.shapes.some(shape=>G.inside(point,shape))),'In front of the slide does not reach the fountain');
}
for(const zone of G.zones)for(const object of ['ball','apple','bottle','teddy','cat','kite','balloon']){
 if(!G.allows(zone,object))continue;
 const points=zone.anchors||[zone.anchor];
 for(const [x,y] of points){
  const pose=G.pose(zone,object,{x,y}),region=G.feedbackRegion({zone,pose});
  for(const font of [18,32,46]){
   const width=region.preposition.length*font*.56+28,height=font*1.65;
   // Include drops directly below the old fixed caption.
   for(const p of [pose,{...pose,x:region.label[0],y:region.label[1]}]){
    const [cx,cy]=G.captionPosition(region.label,width,height,p);
    assert(Math.abs(cx-p.x)>=(width+p.size)/2+8||Math.abs(cy-p.y)>=(height+p.size)/2+8,'Caption stays clear of the placed object');
    assert(cx-width/2>=0&&cx+width/2<=1000&&cy-height/2>=0&&cy+height/2<=500,'Caption stays inside the scene');
   }
  }
 }
}
console.log('PASS: progress and input regressions; all 60 questions and audio; corrected zone boundaries; all seven water objects and snapping; captions clear of sprites at desktop and mobile font sizes.');
