/**
 * Critical Path Method (CPM) — backward-pass float computation.
 *
 * `computeCriticalPath` runs the backward pass (the forward pass — earliest
 * start/end — is done by `scheduleTasks` in main.js).  Calendar helpers come
 * from calendar.js; `taskById` from tree.js.  The task array is passed
 * explicitly so these are testable.
 *
 * Extracted verbatim from main.js (Phase 1.4); only the state previously read
 * as globals is now passed explicitly.
 */
import {
  isNonWorkday,
  countWorkingDays,
  subtractWorkingDays,
  addWorkingDays,
  shiftWorkingDays
} from './calendar.js';
import { parseDate, formatDate } from './date.js';
import { taskById } from './tree.js';

/** Last working day before exclusive `endStr` (YYYY-MM-DD). */
export function prevWorkingDay(endStr) {
  let dn = parseDate(endStr) - 1;
  while (isNonWorkday(formatDate(dn))) dn--;
  return formatDate(dn);
}

/**
 * Compute the set of critical task ids via CPM backward pass.
 *
 * Forward pass (ES/EF) is assumed already computed by `scheduleTasks`
 * (task.start / task.end reflect earliest dates).  This builds successor
 * lists for all four dependency types (FS/SS/FF/SF), iterates to fixpoint
 * computing latest-finish (LF), then marks float-0 tasks (EF >= LF) as
 * critical.  Milestones participate in the pass but are excluded from the
 * result set.
 *
 * @param {Array} tasks  flat task list (tasks + milestones)
 * @returns {Set<string>} ids of critical tasks
 */
export function computeCriticalPath(tasks) {
  // ── 正確的 CPM 演算法 ──
  // 1. 前向傳遞（scheduleTasks 已算出 ES=start, EF=end）
  // 2. 後向傳遞：計算每個節點的 LF（最晚完成日）
  // 3. Float = LF - EF；Float=0 → 關鍵任務

  const nodes = tasks.filter(
    t => (t.type === 'task' && t.start && t.end) || (t.type === 'milestone' && t.date)
  );
  if (!nodes.length) return new Set();

  const getS = t => (t.type === 'milestone' ? t.date : t.start);
  const getE = t => (t.type === 'milestone' ? t.date : t.end);
  const wdur = t => (t.type === 'task' ? countWorkingDays(t.start, t.end) : 0);
  const nodeIds = new Set(nodes.map(t => t.id));

  // 建立「後繼者」關係（所有依賴類型）
  const succList = {}; // succList[predId] = [{succ, type}]
  nodes.forEach(t => {
    succList[t.id] = [];
  });
  nodes.forEach(t => {
    const reg = (list, type) =>
      (list || []).forEach(predId => {
        if (nodeIds.has(predId)) succList[predId].push({ succ: t, type });
      });
    reg(t.deps, 'FS');
    reg(t.sdeps, 'SS');
    reg(t.ffdeps, 'FF');
    reg(t.sfdeps, 'SF');
  });

  // 專案結束日 = 所有任務中最晚的 EF
  const projEnd = nodes.reduce((mx, t) => {
    const e = t.type === 'task' ? t.end : (t.type === 'milestone' ? t.date : null);
    return e && e > mx ? e : mx;
  }, '');
  if (!projEnd) return new Set();

  // 後向傳遞：迭代計算 LF
  const LF = {};
  nodes.forEach(t => {
    LF[t.id] = null;
  });

  let changed = true,
    iter = 0;
  while (changed && iter++ < 500) {
    changed = false;
    nodes.forEach(t => {
      const succs = succList[t.id];
      let newLF;

      if (!succs.length) {
        // 無後繼 → LF = 專案結束日
        newLF = t.type === 'task' ? projEnd : getS(t);
      } else {
        newLF = null;
        succs.forEach(({ succ, type }) => {
          const succLF = LF[succ.id];
          let c; // constraint on t.LF

          switch (type) {
            case 'FS':
              // t 必須在 succ 開始前完成 → t.LF = succ.LS - 1
              // succ.LS = succ.LF - succ_duration + 1;
              // so t.LF = succ.LF - succ_duration
              if (succLF && succ.type === 'task') {
                const succLS = subtractWorkingDays(succLF, wdur(succ) - 1);
                c = prevWorkingDay(succLS);
              } else {
                c = prevWorkingDay(getS(succ));
              }
              break;

            case 'SS':
              // t 必須在 succ 開始前開始 → t.LS = succ.LS
              // t.LF = t.LS + t_duration - 1 = succ.LS + t_duration - 1
              // succ.LS = succ.LF - succ_duration + 1（已知 succLF 時）
              if (succLF && succ.type === 'task') {
                const succLS = subtractWorkingDays(succLF, wdur(succ) - 1);
                c = t.type === 'task' ? addWorkingDays(succLS, wdur(t) - 1) : succLS;
              } else {
                c = t.type === 'task' ? addWorkingDays(getS(succ), wdur(t) - 1) : getS(succ);
              }
              break;

            case 'FF':
              // t 必須在 succ 完成前完成 → t.LF = succ.LF
              c = succLF || getE(succ);
              break;

            case 'SF':
              // t 必須在 succ 完成前開始 → t.LS = succ.LF
              // t.LF = t.LS + t_duration - 1 = succ.LF + t_duration - 1
              const sfLF = succLF || getE(succ);
              c = t.type === 'task' ? addWorkingDays(sfLF, wdur(t) - 1) : sfLF;
              break;
          }
          // lag 偏移：後繼任務的依賴若帶 lag，前置任務的最晚時間可往前推
          const _lag = (succ.lags || {})[type + t.id] || 0;
          if (c && _lag) c = shiftWorkingDays(c, -_lag);
          if (c && (newLF === null || c < newLF)) newLF = c;
        });
        if (!newLF) newLF = t.type === 'task' ? projEnd : getS(t);
      }

      if (newLF && newLF !== LF[t.id]) {
        LF[t.id] = newLF;
        changed = true;
      }
    });
  }

  // Float = LF - EF；Float = 0（EF >= LF）→ 關鍵任務
  // 里程碑不加入最終結果，但影響其前置任務的 LF
  const critical = new Set();
  nodes.forEach(t => {
    if (t.type === 'task' && LF[t.id] && getE(t) >= LF[t.id]) critical.add(t.id);
  });
  return critical;
}

/**
 * Trace a task's predecessors to find which lie on the critical path.
 * Milestones are transparent (followed through, never returned).
 * @param {Array} tasks
 * @param {Set<string>} criticalTaskIds  result of computeCriticalPath
 * @param {object} task  the task whose predecessors to trace
 * @returns {string[]} critical predecessor task ids
 */
export function getCriticalPredTaskIds(tasks, criticalTaskIds, task) {
  const result = new Set();
  function trace(depId) {
    const dep = taskById(tasks, depId);
    if (!dep) return;
    if (dep.type === 'task') {
      if (criticalTaskIds.has(depId)) result.add(depId);
      return;
    }
    if (dep.type === 'milestone') {
      // 里程碑：追蹤所有依賴類型
      [
        ...(dep.deps || []),
        ...(dep.sdeps || []),
        ...(dep.ffdeps || []),
        ...(dep.sfdeps || [])
      ].forEach(trace);
    }
  }
  // 追蹤所有四種依賴類型的前置任務
  [
    ...(task.deps || []),
    ...(task.sdeps || []),
    ...(task.ffdeps || []),
    ...(task.sfdeps || [])
  ].forEach(trace);
  return [...result];
}
