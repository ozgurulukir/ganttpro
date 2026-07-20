import { countWorkingDays } from '../core/calendar.js';
import { D } from '../render/deps.js';
import { t } from '../i18n/index.js';

// 匯出 CSV（UTF-8 BOM，Excel 可直接開啟）
export function exportCSV() {
  const { curProj, tasks, groupBounds, buildDepsText, TODAY_STR } = D;
  const proj = curProj();
  if (!proj) return;
  const lines = [
    [
      '#',
      t('export.taskName'),
      t('export.type') || 'Type',
      t('export.assignee') || 'Assignee',
      t('export.startDate'),
      t('export.endDate'),
      t('export.workdays'),
      t('export.progress'),
      t('export.dependencies'),
      t('export.done')
    ]
  ];
  let num = 0;
  const walk = (parentId, depth) => {
    tasks
      .filter(tk => tk.parent === parentId)
      .forEach(tk => {
        num++;
        const isGrp = tk.type === 'group';
        const gb = isGrp ? groupBounds(tk.id) : null;
        lines.push([
          num,
          '  '.repeat(depth) + tk.name,
          isGrp
            ? t('export.typeGroup')
            : tk.type === 'milestone'
              ? t('export.typeMilestone')
              : t('export.typeTask'),
          tk.assignee || '',
          isGrp ? gb.s || '' : tk.start || tk.date || '',
          isGrp ? gb.e || '' : tk.end || tk.date || '',
          tk.type === 'task' && tk.start && tk.end ? countWorkingDays(tk.start, tk.end) : '',
          tk.type === 'task' ? (tk.done ? 100 : tk.progress || 0) : '',
          buildDepsText(tk),
          tk.done ? 'Y' : ''
        ]);
        walk(tk.id, depth + 1);
      });
  };
  walk(null, 0);
  const csvEsc = v => {
    v = String(v ?? '');
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  const csv = '\ufeff' + lines.map(r => r.map(csvEsc).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `gantt-${(proj.name || 'export').replace(/\s+/g, '-')}-${TODAY_STR}.csv`;
  a.href = url;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
