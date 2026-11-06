// A deterministic question order for manually repeating input regressions.
// Use a separate local preview port so this check has its own browser save.
(() => {
  const all=window.TrainerQuestions;
  const kite=all.find(q=>q.object==='kite'&&q.preposition==='behind'&&q.landmark==='fountain');
  const apple=all.find(q=>q.object==='apple'&&q.preposition==='on'&&q.landmark==='fountain');
  window.TrainerQuestions=[kite,apple,...all.filter(q=>q!==kite&&q!==apple).slice(0,13)].map((q,i)=>({...q,id:'input-check-'+(i+1)}));
  Math.random=()=>.999999;
})();
