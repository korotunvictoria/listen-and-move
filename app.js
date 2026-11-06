(() => {
  'use strict';
  const root = document.getElementById('game');
  const { Progress } = window.TrainerProgress, G = window.TrainerGeometry;
  const questions = window.TrainerQuestions, byId = new Map(questions.map(q => [q.id, q]));
  let storage;
  try { storage = window.localStorage; } catch (_) { /* Continue in memory. */ }
  const progress = new Progress(questions.map(q => q.id), storage);
  const audio = new Audio();
  const objects = { ball: 'ball', apple: 'apple', bottle: 'bottle', teddy: 'teddy bear', cat: 'cat', kite: 'kite', balloon: 'balloon' };
  const cells = Object.keys(objects);
  const $ = selector => root.querySelector(selector);
  const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let session, question, selected = null, listened = false, scriptUsed = false, busy = false;
  let timers = [], lastResult, generation = 0;
  const later = (fn, ms) => { const token = generation; timers.push(setTimeout(() => { if (token === generation) fn(); }, ms)); };
  function sprite(id) {
    return `<img src="assets/${id}.png" alt="" draggable="false">`;
  }
  function message(text = '', kind = '') {
    const target = $('#feedback');
    if (target) { target.textContent = text; target.dataset.kind = kind; }
  }
  function select(id) {
    selected = id;
    root.classList.toggle('has-selection',!!id);
    root.querySelectorAll('[data-object]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.object === id)));
  }
  function cleanup() {
    generation++;
    root.classList.remove('answer-feedback');
    timers.forEach(clearTimeout); timers = [];
    audio.pause(); audio.onplay = audio.onpause = audio.onended = audio.onerror = null;
    input.cancel(); selected = null; busy = false;
  }
  function storageNote() { return progress.persistent ? '' : '<p class="storage-note" role="status">Progress cannot be saved in this browser. You can keep playing, but it will be lost when you close this page.</p>'; }
  function showQuestion() {
    cleanup();
    session = progress.begin();
    question = byId.get(session.ids[session.index]);
    listened = false; scriptUsed = false;
    const correct = session.outcomes.filter(o => o.kind !== 'skipped').length;
    root.innerHTML = `
      <header class="heading"><h1 class="instruction">${escape(question.instruction.replace(/\.$/, ''))}</h1><div class="stats" aria-label="Progress"><span>Question <b>${session.index+1} of ${session.ids.length}</b></span><span>Correct <b>${correct}</b></span></div></header>
      <div class="toolbar"><button class="control play" id="play" type="button"><img src="assets/sound.svg" alt=""><span>Play</span></button><div class="objects" role="group" aria-label="Objects to move">${cells.map(id => `<button class="object" type="button" data-object="${id}" aria-label="${objects[id]}" aria-pressed="false">${sprite(id)}</button>`).join('')}</div><button class="control script-button" id="script-button" type="button" aria-controls="script" aria-expanded="false">Script</button></div>
      <section class="script" id="script" hidden><p>${escape(question.script)}</p><p lang="ru">${escape(question.translation)}</p></section>
      <div class="scene-wrap"><svg class="scene" id="scene" viewBox="0 0 1000 500" role="group" aria-label="Autumn park with a fountain, a slide, and a big tree"><image href="assets/park.png" width="1000" height="500"/><g id="focus" aria-hidden="true"></g><g id="placed" aria-hidden="true"></g><g id="preview" aria-hidden="true"></g><g id="focus-label" aria-hidden="true"></g><g id="zones">${G.zones.map(z => `<path d="${z.shapes.map(G.path).join('')}" fill-rule="evenodd" data-zone="${z.id}" tabindex="0" role="button" aria-label="Place ${escape(z.id.replace('|', ' the '))}"/>`).join('')}</g></svg></div>
      <footer class="feedback-row"><p id="feedback" class="feedback" aria-live="polite" role="status"></p><button class="control skip" id="skip" type="button">Skip the question</button></footer>${storageNote()}<div class="ghost" id="ghost" hidden></div>`;
    const token = generation;
    audio.src = question.audio;
    audio.preload = 'auto';
    const updatePlay = () => { if (token === generation) $('#play span').textContent = audio.paused ? 'Play' : 'Pause'; };
    audio.onplay = audio.onpause = updatePlay;
    audio.onended = () => { if (token !== generation) return; listened = true; updatePlay(); if ($('#feedback').textContent === 'Listen first, or open Script.') message(); };
    audio.onerror = () => { if (token === generation) message('Audio is unavailable. Open Script to continue.'); };
    $('#play').onclick = async () => {
      if (busy) return;
      if (!audio.paused) { audio.pause(); return; }
      if (audio.ended) audio.currentTime = 0;
      try { await audio.play(); } catch (_) { if (token === generation) message('Audio is unavailable. Open Script to continue.'); }
    };
    $('#script-button').onclick = () => {
      const text = $('#script'); text.hidden = !text.hidden;
      $('#script-button').setAttribute('aria-expanded', String(!text.hidden));
      if (!text.hidden) {
        scriptUsed = true;
        if ($('#feedback').textContent === 'Listen first, or open Script.') message();
      }
    };
    $('#skip').onclick = () => {
      if (busy) return;
      busy = true; lastResult = progress.complete(true);
      if (lastResult.finished) showResults(); else showQuestion();
    };
    for (const button of root.querySelectorAll('[data-object]')) {
      button.onpointerdown = event => input.start(event,button,button.dataset.object);
      button.onlostpointercapture = event => input.lost(event);
      button.onclick = event => input.activate(event,button.dataset.object);
    }
    $('#scene').onclick = event => { if (selected && !busy) { try { drop(point(event.clientX,event.clientY)); } finally { clearSelection(); } } };
    $('#scene').onpointermove = event => { if (selected && !input.active && !busy) preview(event.clientX,event.clientY); };
    $('#scene').onpointerleave = () => { if (!input.active) $('#preview').innerHTML = ''; };
    for (const target of root.querySelectorAll('[data-zone]')) target.onkeydown = event => {
      if ((event.key !== 'Enter' && event.key !== ' ') || !selected || busy) return;
      event.preventDefault();
      if (!ready()) { clearSelection(); return; }
      const zone = G.zones.find(z => z.id === target.dataset.zone);
      try { answer(G.allows(zone,selected) ? { zone, pose: G.pose(zone,selected,{x:zone.anchor?.[0] ?? zone.anchors[0][0],y:zone.anchor?.[1] ?? zone.anchors[0][1]}) } : null); } finally { clearSelection(); }
    };
    const frame = $('.scene-wrap'); frame.scrollLeft = Math.max(0, (frame.scrollWidth-frame.clientWidth)/2);
  }
  function point(x,y) {
    const rect = $('#scene').getBoundingClientRect();
    return { x:(x-rect.left)/rect.width*1000, y:(y-rect.top)/rect.height*500 };
  }
  function ready() {
    if (listened || scriptUsed) return true;
    message('Listen first, or open Script.');
    return false;
  }
  function drawing(id,p,zone,previewing=false) {
    const s=p.size;
    let clip='';
    if (zone?.behind) clip='<mask id="occlusion" maskUnits="userSpaceOnUse"><rect width="1000" height="500" fill="white"/><path d="M256 326A221 38 0 0 1 698 326L698 374Q698 415 477 415Q256 415 256 374Z" fill="black"/></mask>';
    if (zone?.under) clip='<mask id="occlusion" maskUnits="userSpaceOnUse"><rect width="1000" height="500" fill="white"/><path d="M773 185h13v89h-13zM812 183h14v96h-14zM868 182h14v98h-14z" fill="black"/></mask>';
    const waterClip=zone?.water ? `<clipPath id="waterline"><rect x="${p.x-s/2}" y="${p.y-s/2}" width="${s}" height="${s*.5}"/></clipPath>` : '';
    return `<defs>${clip}${waterClip}</defs><g opacity="${previewing?.65:1}"${clip?' mask="url(#occlusion)"':''}><g${waterClip?' clip-path="url(#waterline)"':''}><image href="assets/${id}.png" x="${p.x-s/2}" y="${p.y-s/2}" width="${s}" height="${s}"/></g></g>`;
  }
  function preview(x,y) {
    if (!selected || busy) return;
    const p=point(x,y), hit=hitAt(p), ghost=$('#ghost');
    if (hit) { $('#preview').innerHTML=drawing(selected,hit.pose,hit.zone,true); ghost.hidden=true; }
    else { $('#preview').innerHTML=''; ghost.innerHTML=sprite(selected); ghost.style.left=x+'px'; ghost.style.top=y+'px'; ghost.hidden=!input.active; }
  }
  function hitAt(p,dragging=!!input.active) {
    const sceneWidth=$('#scene').getBoundingClientRect().width;
    const tolerance=Math.min(32,12*1000/sceneWidth);
    const ghostSize=parseFloat(getComputedStyle($('#ghost')).width)*1000/sceneWidth;
    return G.resolve(p,selected,tolerance,dragging ? {width:ghostSize,height:ghostSize} : null);
  }
  function clearSelection() {
    select(null);
    if ($('#ghost')) $('#ghost').hidden=true;
    if ($('#preview')) $('#preview').innerHTML='';
  }
  function drop(p,dragging=false) {
    if (!selected || busy) return;
    if (!ready()) { clearSelection(); return; }
    if (p.x<0||p.x>1000||p.y<0||p.y>500) { input.cancel(); return; }
    const hit=hitAt(p,dragging);
    answer(hit,p);
  }
  function answer(hit,p={x:500,y:250}) {
    const id=selected;
    const correct=!!hit && id===question.object && hit.zone.id===question.preposition+'|'+question.landmark;
    busy=true; audio.pause(); $('#preview').innerHTML=''; $('#skip').disabled=true; $('#play').disabled=true;
    root.querySelector(`[data-object="${id}"]`).classList.add('in-flight');
    if (hit) {
      $('#placed').innerHTML=drawing(id,hit.pose,hit.zone);
      const region=G.feedbackRegion(hit), paths=region.path, color=correct?'#507345':'#b14c33';
      const font=Math.max(18,Math.min(46,14*1000/$('#scene').getBoundingClientRect().width));
      const width=region.preposition.length*font*.56+28, height=font*1.65;
      const [labelX,labelY]=G.captionPosition(region.label,width,height,hit.pose);
      root.classList.add('answer-feedback');
      $('#focus').innerHTML=`<defs><mask id="spot" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="500" style="mask-type:luminance"><rect width="1000" height="500" fill="white"/><path d="${paths}" fill-rule="evenodd" fill="black"/></mask></defs><rect width="1000" height="500" fill="#25271c" opacity=".55" mask="url(#spot)"/><path class="region-outline" d="${paths}" fill-rule="evenodd" fill="${color}" fill-opacity=".08" stroke="${color}" stroke-width="2.5"/>`;
      $('#focus-label').innerHTML=`<g class="region-caption"><rect x="${labelX-width/2}" y="${labelY-height/2}" width="${width}" height="${height}" rx="${height/2}" fill="${color}"/><text class="region-label" x="${labelX}" y="${labelY}" dy=".35em" text-anchor="middle" font-size="${font}">${region.preposition}</text></g>`;
    }
    if (correct) {
      message("That's right!",'correct');
      lastResult=progress.complete(false);
      later(()=>{ if(lastResult.finished)showResults();else showQuestion(); },1250);
    } else {
      progress.markError();
      message(id !== question.object ? question.instruction : 'Not quite. Try again.','wrong');
      later(()=>returnToTray(id,hit?.pose||p),850);
    }
  }
  function returnToTray(id,p) {
    $('#placed').innerHTML=''; $('#focus').innerHTML=''; $('#focus-label').innerHTML='';
    root.classList.remove('answer-feedback');
    const rect=$('#scene').getBoundingClientRect(), source=root.querySelector(`[data-object="${id}"]`).getBoundingClientRect(), ghost=$('#ghost');
    ghost.classList.remove('returning'); ghost.innerHTML=sprite(id); ghost.hidden=false;
    ghost.style.left=rect.left+p.x/1000*rect.width+'px'; ghost.style.top=rect.top+p.y/500*rect.height+'px';
    ghost.getBoundingClientRect();
    ghost.classList.add('returning');
    ghost.style.left=source.left+source.width/2+'px'; ghost.style.top=source.top+source.height/2+'px';
    later(()=>{
      ghost.hidden=true; ghost.classList.remove('returning');
      root.querySelectorAll('.in-flight').forEach(button=>button.classList.remove('in-flight'));
      busy=false; select(null); message(); $('#skip').disabled=false; $('#play').disabled=false;
    },300);
  }
  function showResults() {
    const outcomes=lastResult.outcomes;
    cleanup();
    const count=kind=>outcomes.filter(o=>o.kind===kind).length;
    root.innerHTML=`<section class="results"><header class="results-header"><h1>Practice complete!</h1><p class="results-intro">You finished 15 questions.</p></header><div class="results-body"><dl><div><dt>Correct on the first try</dt><dd>${count('first')}</dd></div><div><dt>Correct after trying again</dt><dd>${count('corrected')}</dd></div><div><dt>Skipped</dt><dd>${count('skipped')}</dd></div></dl><div class="results-drawing"><img src="assets/results.png" alt="A kitten and a teddy bear sitting together in autumn leaves beside a ball."></div></div><footer class="results-footer"><p class="results-next">Another 15 questions?</p><p class="results-repeat">Mistakes and skipped questions come first.</p>${storageNote()}<button class="control play" id="again" type="button">Play again</button></footer></section>`;
    $('#again').onclick=showQuestion;
  }
  const input = new window.TrainerPointer.PointerInput({
    canStart: () => !busy && ready(),
    selected: () => selected,
    onSelect: id => { clearSelection(); select(id); },
    onMove: preview,
    onDrop: (_id,x,y) => drop(point(x,y),true),
    onCancel: clearSelection
  });
  window.addEventListener('pointermove',event=>input.move(event),true);
  window.addEventListener('pointerup',event=>input.end(event),true);
  window.addEventListener('pointercancel',event=>input.lost(event),true);
  window.addEventListener('blur',()=>input.cancel());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)input.cancel();});
  root.addEventListener('pointerdown',()=>root.classList.remove('keyboard-mode'),true);
  window.addEventListener('keydown',event=>{if(event.key==='Tab')root.classList.add('keyboard-mode');if(event.key==='Escape'&&!busy)input.cancel();});
  window.addEventListener('resize',()=>{if(input.active&&!busy)input.cancel();});
  window.addEventListener('pagehide',()=>{input.cancel();audio.pause();progress.save();});
  showQuestion();
})();
