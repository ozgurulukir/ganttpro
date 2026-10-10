import { icalEsc } from '../core/format.js';
import { D } from '../render/deps.js';

export function exportICalendar() {
  const { tasks } = D;
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//GanttPro//EN\r\nCALSCALE:GREGORIAN\r\n';
  const fmt = d => d.replace(/-/g, '');
  tasks.forEach(task => {
    if (task.type === 'group') return;
    const start = task.start || task.date;
    const end = task.end || task.date;
    if (!start) return;
    const assignee = icalEsc(task.assignee || 'None');
    const desc = `Assignee: ${assignee}|Progress: ${task.progress || 0}%|Done: ${task.done ? 'Yes' : 'No'}`;
    ics += 'BEGIN:VEVENT\r\n';
    ics += `DTSTART;VALUE=DATE:${fmt(start)}\r\n`;
    ics += `DTEND;VALUE=DATE:${fmt(end || start)}\r\n`;
    ics += `SUMMARY:${icalEsc(task.name)}\r\n`;
    ics += `DESCRIPTION:${desc}\r\n`;
    ics += 'END:VEVENT\r\n';
  });
  ics += 'END:VCALENDAR';
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ganttpro-export.ics';
  a.click();
  URL.revokeObjectURL(a.href);
}
