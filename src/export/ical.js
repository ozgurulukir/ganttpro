import { D } from '../render/deps.js';

export function exportICalendar() {
  const { tasks } = D;
  let ics = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//GanttPro//EN\nCALSCALE:GREGORIAN\n';
  const fmt = d => d.replace(/-/g, '');
  tasks.forEach(task => {
    if (task.type === 'group') return;
    const start = task.start || task.date;
    const end = task.end || task.date;
    if (!start) return;
    const desc =
      `Assignee: ${task.assignee || 'None'}|Progress: ${task.progress || 0}%|Done: ${task.done ? 'Yes' : 'No'}`.replace(
        /[\n,;]/g,
        ' '
      );
    ics += 'BEGIN:VEVENT\n';
    ics += `DTSTART;VALUE=DATE:${fmt(start)}\n`;
    ics += `DTEND;VALUE=DATE:${fmt(end || start)}\n`;
    ics += `SUMMARY:${task.name.replace(/[\n,;]/g, ' ')}\n`;
    ics += `DESCRIPTION:${desc}\n`;
    ics += 'END:VEVENT\n';
  });
  ics += 'END:VCALENDAR';
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ganttpro-export.ics';
  a.click();
  URL.revokeObjectURL(a.href);
}
