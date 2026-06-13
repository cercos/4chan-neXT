import Notice from "../classes/Notice";

/*
 * A small in-memory stack of reversible user actions (currently thread hides
 * and MD5 quick-filters). Each entry pairs a human label with a closure that
 * reverses the action. The "Undo last hide/filter" keybind (default Ctrl+Z)
 * pops the most recent entry and runs it; repeating walks back up to MAX.
 *
 * It is deliberately session-only (not persisted): the closures capture live
 * objects, and reviving a stale undo across reloads would risk acting on a
 * thread/filter that no longer exists.
 */

interface UndoEntry {
  label: string;     // shown in the confirmation notice, e.g. "Restored hidden thread"
  undo: () => void;  // reverses the action
}

const MAX = 10;

const UndoStack = {
  entries: [] as UndoEntry[],

  record(label: string, undo: () => void) {
    UndoStack.entries.push({label, undo});
    if (UndoStack.entries.length > MAX) { UndoStack.entries.shift(); }
  },

  undo() {
    const entry = UndoStack.entries.pop();
    if (!entry) {
      new Notice('info', 'Nothing to undo.', 2);
      return;
    }
    try {
      entry.undo();
    } catch (err) {
      // Surface a failed reversal instead of silently dropping it.
      new Notice('warning', `Couldn't undo: ${entry.label}`, 3);
      return;
    }
    new Notice('info', entry.label, 2);
  },
};

export default UndoStack;
