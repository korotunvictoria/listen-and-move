(function (scope) {
  'use strict';
  function shuffle(items, random = Math.random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  class Progress {
    constructor(ids, storage, random = Math.random) {
      this.ids = new Set(ids);
      this.storage = storage;
      this.random = random;
      this.key = 'autumn-listening-progress-v1';
      this.persistent = false;
      this.state = { version: 1, mastered: [], retry: [], sessions: 0, cycle: 1, active: null };
      try {
        const saved = JSON.parse(storage?.getItem(this.key) || 'null');
        if (saved?.version === 1 && Array.isArray(saved.mastered) && Array.isArray(saved.retry)) {
          const clean = list => [...new Set(list.filter(id => this.ids.has(id)))];
          this.state.mastered = clean(saved.mastered);
          this.state.retry = clean(saved.retry);
          this.state.mastered = this.state.mastered.filter(id => !this.state.retry.includes(id));
          for (const field of ['sessions', 'cycle']) {
            if (Number.isSafeInteger(saved[field]) && saved[field] >= (field === 'cycle' ? 1 : 0)) this.state[field] = saved[field];
          }
          const a = saved.active;
          if (a && Array.isArray(a.ids) && a.ids.length === Math.min(15, this.ids.size) && clean(a.ids).length === a.ids.length &&
              Number.isInteger(a.index) && a.index >= 0 && a.index < a.ids.length && Array.isArray(a.outcomes) &&
              a.outcomes.length === a.index && a.outcomes.every((o, i) => o.id === a.ids[i] && ['first', 'corrected', 'skipped'].includes(o.kind))) {
            this.state.active = { ids: a.ids, index: a.index, outcomes: a.outcomes, failed: !!a.failed };
          }
        }
      } catch (_) { /* A damaged save starts a new game. */ }
      this.save();
    }
    save() {
      try {
        if (!this.storage) throw new Error('Storage unavailable');
        this.storage.setItem(this.key, JSON.stringify(this.state));
        this.persistent = true;
      } catch (_) { this.persistent = false; }
    }
    begin() {
      if (this.state.active) return this.state.active;
      const all = [...this.ids], retry = new Set(this.state.retry), mastered = new Set(this.state.mastered);
      const count = Math.min(15, all.length);
      const chosen = shuffle(all.filter(id => retry.has(id)), this.random).slice(0, count);
      chosen.push(...shuffle(all.filter(id => !retry.has(id) && !mastered.has(id)), this.random).slice(0, count - chosen.length));
      if (chosen.length < count) {
        chosen.push(...shuffle(all.filter(id => !chosen.includes(id)), this.random).slice(0, count - chosen.length));
        this.state.mastered = [];
        this.state.cycle++;
      }
      this.state.active = { ids: chosen, index: 0, outcomes: [], failed: false };
      this.save();
      return this.state.active;
    }
    markError() {
      const a = this.state.active;
      if (!a) return;
      a.failed = true;
      this.record(a.ids[a.index], true);
      this.save();
    }
    record(id, failed) {
      this.state.mastered = this.state.mastered.filter(value => value !== id);
      this.state.retry = this.state.retry.filter(value => value !== id);
      this.state[failed ? 'retry' : 'mastered'].push(id);
    }
    complete(skipped = false) {
      const a = this.state.active;
      if (!a) throw new Error('No active session');
      const id = a.ids[a.index], kind = skipped ? 'skipped' : a.failed ? 'corrected' : 'first';
      this.record(id, skipped || a.failed);
      a.outcomes.push({ id, kind });
      a.index++;
      a.failed = false;
      const result = { outcomes: [...a.outcomes], finished: a.index === a.ids.length };
      if (result.finished) { this.state.sessions++; this.state.active = null; }
      this.save();
      return result;
    }
  }
  const api = { Progress, shuffle };
  scope.TrainerProgress = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
