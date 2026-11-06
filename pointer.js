(function (scope) {
  'use strict';
  class PointerInput {
    constructor(callbacks) { this.callbacks = callbacks; this.active = null; }
    release(gesture) {
      try {
        if (gesture.target.hasPointerCapture(gesture.pointer)) gesture.target.releasePointerCapture(gesture.pointer);
      } catch (_) { /* The target can disappear when the next question opens. */ }
    }
    start(event, target, object) {
      if (event.button !== 0 || event.isPrimary === false) return false;
      if (this.active) this.cancel();
      if (!this.callbacks.canStart()) { this.callbacks.onCancel(); return false; }
      event.preventDefault();
      const wasSelected = this.callbacks.selected() === object;
      this.active = { target, object, pointer: event.pointerId, x: event.clientX, y: event.clientY, moved: false, wasSelected };
      this.callbacks.onSelect(object);
      try { target.setPointerCapture(event.pointerId); }
      catch (_) { /* Window-level listeners still receive a release over the page. */ }
      return true;
    }
    move(event) {
      const gesture = this.active;
      if (!gesture || gesture.pointer !== event.pointerId) return;
      if (event.pointerType === 'mouse' && event.buttons === 0) { this.cancel(); return; }
      if (Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y) > 4) gesture.moved = true;
      if (gesture.moved) this.callbacks.onMove(event.clientX,event.clientY);
    }
    end(event) {
      const gesture = this.active;
      if (!gesture || gesture.pointer !== event.pointerId) return;
      this.active = null;
      this.release(gesture);
      // Some browsers coalesce movement events; release coordinates are decisive.
      const moved = gesture.moved || Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y) > 4;
      if (!moved) { this.callbacks.onSelect(gesture.wasSelected ? null : gesture.object); return; }
      try { this.callbacks.onDrop(gesture.object,event.clientX,event.clientY); }
      finally { this.callbacks.onCancel(); }
    }
    lost(event) {
      if (this.active?.pointer === event.pointerId) this.cancel();
    }
    activate(event, object) {
      if (event.detail !== 0 || event.pointerType) return;
      if (!this.callbacks.canStart()) { this.callbacks.onCancel(); return; }
      this.callbacks.onSelect(this.callbacks.selected() === object ? null : object);
    }
    cancel() {
      const gesture = this.active;
      this.active = null;
      if (gesture) this.release(gesture);
      this.callbacks.onCancel();
    }
  }
  scope.TrainerPointer = { PointerInput };
  if (typeof module !== 'undefined') module.exports = scope.TrainerPointer;
})(typeof window === 'undefined' ? globalThis : window);
