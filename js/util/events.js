export class Emitter {
  constructor() { this._listeners = new Map(); }
  on(evt, fn) {
    if (!this._listeners.has(evt)) this._listeners.set(evt, new Set());
    this._listeners.get(evt).add(fn);
    return () => this.off(evt, fn);
  }
  off(evt, fn) {
    this._listeners.get(evt)?.delete(fn);
  }
  emit(evt, payload) {
    this._listeners.get(evt)?.forEach(fn => {
      try { fn(payload); } catch (e) { console.error(`[emitter:${evt}]`, e); }
    });
  }
}
