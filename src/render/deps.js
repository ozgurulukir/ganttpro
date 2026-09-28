/* Shared dependency object for render modules.
   Populated by main.js (syncRenderDeps) before each render cycle.
   Render modules destructure from here to access app state + functions.
   dragSrcId is owned by task-panel.js (set during drag events). */
export const D = { dragSrcId: null };
