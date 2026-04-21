import { Emitter } from "../util/events.js";
import { debounce } from "../util/debounce.js";
import { deriveAll } from "./derive.js";
import { saveCharacter } from "../storage/idbStore.js";
import { updateRosterEntry } from "../storage/localStore.js";
import { SCHEMA_VERSION } from "./characterFactory.js";

export class CharacterStore extends Emitter {
  constructor(character) {
    super();
    this._doc = character;
    this._derived = deriveAll(character);
    this._persist = debounce(() => this._save(), 500);
  }

  get doc() { return this._doc; }
  get derived() { return this._derived; }

  /** Mutate the character with a plain object merge OR a mutator function. */
  update(fnOrPatch) {
    if (typeof fnOrPatch === "function") {
      fnOrPatch(this._doc);
    } else {
      Object.assign(this._doc, fnOrPatch);
    }
    this._doc.updatedAt = new Date().toISOString();
    this._doc.schemaVersion = SCHEMA_VERSION;
    this._derived = deriveAll(this._doc);
    this.emit("change", { doc: this._doc, derived: this._derived });
    this._persist();
  }

  /** Read-only deep key set. Pushes into arrays too. */
  patchPath(path, value) {
    const parts = path.split(".");
    this.update(doc => {
      let obj = doc;
      for (let i = 0; i < parts.length - 1; i++) {
        const k = parts[i];
        if (obj[k] == null) obj[k] = {};
        obj = obj[k];
      }
      obj[parts[parts.length - 1]] = value;
    });
  }

  async _save() {
    try {
      await saveCharacter(this._doc);
      await updateRosterEntry(this._doc, this._derived);
      this.emit("saved", { id: this._doc.id, at: Date.now() });
    } catch (e) {
      console.error("save failed", e);
      this.emit("save-error", e);
    }
  }

  /** Flush pending save synchronously-ish (used on navigation). */
  async flush() {
    await this._save();
  }
}
