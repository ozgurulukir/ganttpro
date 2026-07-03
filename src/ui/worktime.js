import { t } from '../i18n/index.js';
import { parseDate, formatDate, dayOfWeek } from '../core/date.js';
import { setWorkDays, setCustomHolidays } from '../core/calendar.js';

const LS_WORKDAYS = 'gp_workdays';
const LS_HOLIDAYS = 'gp_customHolidays';
const DEFAULT_WORKDAYS = [1, 2, 3, 4, 5];

export function loadWorkDays() {
  try {
    return JSON.parse(localStorage.getItem(LS_WORKDAYS)) || DEFAULT_WORKDAYS;
  } catch {
    return DEFAULT_WORKDAYS;
  }
}

export function loadCustomHolidays() {
  try {
    return JSON.parse(localStorage.getItem(LS_HOLIDAYS)) || [];
  } catch {
    return [];
  }
}

export function saveWorkSettings(workdays, holidays) {
  localStorage.setItem(LS_WORKDAYS, JSON.stringify(workdays));
  localStorage.setItem(LS_HOLIDAYS, JSON.stringify(holidays));
}

let _workdays = loadWorkDays();
let _holidays = loadCustomHolidays();

export function getWorkDays() {
  return _workdays;
}
export function getCustomHolidays() {
  return _holidays;
}

export function openWorkTimeModal() {
  const workdays = [..._workdays];
  const holidays = [..._holidays];
  const days = t('worktime.dayShort', { returnObjects: true });

  let el = document.getElementById('worktimeOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'worktimeOverlay';
    el.className = 'overlay';
    el.innerHTML = `<div class='modal worktime-modal' onclick='event.stopPropagation()'>
      <button class='modal-close' onclick='document.getElementById("worktimeOverlay").classList.remove("open")'>✕</button>
      <div class='modal-title'>🗓 ${t('worktime.title')}</div>
      <div class='worktime-section'><h4>${t('worktime.workdays')}</h4><div class='worktime-day-chips' id='wtDayChips'></div></div>
      <div class='worktime-section'><h4>${t('worktime.customHolidays')}</h4><div id='wtHolidayList'></div><div style='display:flex;gap:8px;margin-top:8px'><input type='date' id='wtHolidayDate' style='padding:4px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px'><input id='wtHolidayLabel' placeholder='${t('worktime.holidayLabel')}' style='padding:4px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;flex:1'><button class='btn btn-primary' id='wtAddHoliday' style='font-size:12px'>${t('worktime.addHoliday')}</button></div></div>
      <div class='modal-footer'><button class='btn' onclick='document.getElementById("worktimeOverlay").classList.remove("open")'>${t('common.cancel')}</button><button class='btn btn-primary' id='wtSaveBtn'>${t('worktime.save')}</button></div>
    </div>`;
    el.addEventListener('click', e => {
      if (e.target === el) el.classList.remove('open');
    });
    document.body.appendChild(el);
  }

  // Render day chips
  const chipsEl = el.querySelector('#wtDayChips');
  chipsEl.innerHTML = '';
  days.forEach((name, i) => {
    const chip = document.createElement('span');
    chip.className = 'worktime-chip' + (workdays.includes(i) ? ' active' : '');
    chip.textContent = name;
    chip.onclick = () => {
      const idx = workdays.indexOf(i);
      if (idx >= 0) workdays.splice(idx, 1);
      else workdays.push(i);
      workdays.sort();
      chip.classList.toggle('active');
    };
    chipsEl.appendChild(chip);
  });

  // Render holidays
  function renderHolidays() {
    const listEl = el.querySelector('#wtHolidayList');
    listEl.replaceChildren();
    if (!holidays.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:12px;color:var(--t3);padding:4px 0';
      empty.textContent = t('worktime.noHolidays');
      listEl.appendChild(empty);
      return;
    }
    holidays.forEach((h, i) => {
      const row = document.createElement('div');
      row.className = 'worktime-holiday-row';

      const dateEl = document.createElement('span');
      dateEl.textContent = h.date;

      const labelEl = document.createElement('span');
      labelEl.style.color = 'var(--t3)';
      labelEl.textContent = h.label || '';

      const del = document.createElement('span');
      del.className = 'worktime-holiday-del';
      del.textContent = '✕';
      del.dataset.idx = String(i);
      del.onclick = () => {
        holidays.splice(i, 1);
        renderHolidays();
      };

      row.append(dateEl, labelEl, del);
      listEl.appendChild(row);
    });
  }
  renderHolidays();

  el.querySelector('#wtAddHoliday').onclick = () => {
    const date = el.querySelector('#wtHolidayDate').value;
    const label = el.querySelector('#wtHolidayLabel').value;
    if (!date) return;
    holidays.push({ date, label });
    holidays.sort((a, b) => a.date.localeCompare(b.date));
    el.querySelector('#wtHolidayDate').value = '';
    el.querySelector('#wtHolidayLabel').value = '';
    renderHolidays();
  };

  el.querySelector('#wtSaveBtn').onclick = () => {
    _workdays = workdays;
    _holidays = holidays;
    saveWorkSettings(workdays, holidays);
    setWorkDays(workdays);
    setCustomHolidays(holidays.map(h => h.date));
    el.classList.remove('open');
  };

  el.classList.add('open');
}
