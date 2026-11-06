'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PointerInput}=require('../pointer.js');
function setup(){
 const state={ready:true,selected:null,drops:[],previews:[],cleared:0,captured:new Set()};
 const target={setPointerCapture(id){state.captured.add(id);},hasPointerCapture(id){return state.captured.has(id);},releasePointerCapture(id){state.captured.delete(id);input.lost({pointerId:id});}};
 const input=new PointerInput({canStart:()=>state.ready,selected:()=>state.selected,onSelect:id=>{state.selected=id;},onMove:(x,y)=>state.previews.push([x,y]),onDrop:(id,x,y)=>state.drops.push({id,x,y}),onCancel:()=>{state.selected=null;state.previews=[];state.cleared++;}});
 const event=(x,y,extra={})=>({button:0,pointerId:1,isPrimary:true,pointerType:'mouse',buttons:1,clientX:x,clientY:y,preventDefault(){},...extra});
 return {state,target,input,event};
}
test('drag releases once and never turns into click-to-place',()=>{
 const {state,target,input,event}=setup();
 input.start(event(10,10),target,'kite');input.move(event(400,270));
 assert.equal(state.previews.length,1);
 input.end(event(400,270,{buttons:0}));
 assert.deepEqual(state.drops,[{id:'kite',x:400,y:270}]);
 assert.equal(input.active,null);assert.equal(state.selected,null);assert.equal(state.previews.length,0);assert.equal(state.captured.size,0);
 input.end(event(400,270,{buttons:0}));input.move(event(420,280,{buttons:0}));
 assert.equal(state.drops.length,1,'A later click or move cannot resubmit the released object');
});
test('release still drops when no move event was delivered',()=>{
 const {state,target,input,event}=setup();
 input.start(event(10,10),target,'kite');input.end(event(400,270,{buttons:0}));
 assert.equal(state.drops.length,1);assert.equal(state.selected,null);
});
test('before listening there is no drag, preview, selection or answer',()=>{
 const {state,target,input,event}=setup();state.ready=false;
 assert.equal(input.start(event(10,10),target,'balloon'),false);
 input.move(event(500,200));input.end(event(500,200,{buttons:0}));
 assert.equal(state.selected,null);assert.equal(state.drops.length,0);assert.equal(state.previews.length,0);assert.equal(state.captured.size,0);
});
test('pointer capture failure falls back to the window release',()=>{
 const {state,target,input,event}=setup();target.setPointerCapture=()=>{throw Error('Unavailable');};
 input.start(event(10,10),target,'kite');input.move(event(400,270));input.end(event(400,270,{buttons:0}));
 assert.equal(state.drops.length,1);assert.equal(state.selected,null);assert.equal(input.active,null);
});
test('capture loss, cancelled gestures and blur release everything',()=>{
 for(const reason of ['lost','cancel']){
  const {state,target,input,event}=setup();input.start(event(10,10),target,'kite');input.move(event(400,270));
  if(reason==='lost')input.lost({pointerId:1});else input.cancel();
  input.end(event(400,270,{buttons:0}));
  assert.equal(state.drops.length,0);assert.equal(input.active,null);assert.equal(state.selected,null);assert.equal(state.captured.size,0);
 }
});
test('movement after an undelivered mouse release cancels the ghost',()=>{
 const {state,target,input,event}=setup();input.start(event(10,10),target,'kite');input.move(event(400,270));input.move(event(430,280,{buttons:0}));
 assert.equal(input.active,null);assert.equal(state.selected,null);assert.equal(state.previews.length,0);assert.equal(state.drops.length,0);
});
test('tap selection and keyboard activation remain available',()=>{
 const {state,target,input,event}=setup();input.start(event(10,10),target,'kite');input.end(event(10,10,{buttons:0}));assert.equal(state.selected,'kite');
 input.start(event(10,10),target,'kite');input.end(event(10,10,{buttons:0}));assert.equal(state.selected,null);
 input.activate({detail:0},'kite');assert.equal(state.selected,'kite');input.activate({detail:0},'kite');assert.equal(state.selected,null);
 input.activate({detail:1,pointerType:'mouse'},'kite');assert.equal(state.selected,null);
});
test('a rejected or throwing drop cannot leave a selected ghost',()=>{
 const {state,target,input,event}=setup();input.callbacks.onDrop=()=>{throw Error('Rejected drop');};input.start(event(10,10),target,'balloon');
 assert.throws(()=>input.end(event(500,200,{buttons:0})));assert.equal(state.selected,null);assert.equal(input.active,null);assert.equal(state.captured.size,0);
});
test('touch release works and an unrelated second finger cannot finish the drag',()=>{
 const {state,target,input,event}=setup();
 input.start(event(10,10,{pointerType:'touch'}),target,'kite');
 assert.equal(input.start(event(100,100,{pointerId:2,isPrimary:false,pointerType:'touch'}),target,'balloon'),false);
 input.end(event(200,200,{pointerId:2,pointerType:'touch',buttons:0}));
 assert(input.active);assert.equal(state.drops.length,0);
 input.move(event(400,270,{pointerType:'touch',buttons:0}));
 input.end(event(400,270,{pointerType:'touch',buttons:0}));
 assert.deepEqual(state.drops,[{id:'kite',x:400,y:270}]);assert.equal(state.selected,null);assert.equal(input.active,null);
});
