import { t } from '../i18n/index.js';
import { setWorkDays, setCustomHolidays, loadHolidaysFromJSON } from '../core/calendar.js';
import { WORKDAYS_KEY, HOLIDAYS_KEY } from '../data/local.js';

const DEFAULT_WORKDAYS = [1, 2, 3, 4, 5];

export function loadWorkDays() {
  try {
    return JSON.parse(localStorage.getItem(WORKDAYS_KEY)) || DEFAULT_WORKDAYS;
  } catch {
    return DEFAULT_WORKDAYS;
  }
}

export function loadCustomHolidays() {
  try {
    return JSON.parse(localStorage.getItem(HOLIDAYS_KEY)) || [];
  } catch {
    return [];
  }
}

export function saveWorkSettings(workdays, holidays) {
  localStorage.setItem(WORKDAYS_KEY, JSON.stringify(workdays));
  localStorage.setItem(HOLIDAYS_KEY, JSON.stringify(holidays));
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
    el.innerHTML = `<div class='modal worktime-modal' role='dialog' aria-modal='true' aria-labelledby='worktimeTitle' onclick='event.stopPropagation()'>
      <button class='modal-close' aria-label='${t('common.close')}' data-i18n-aria-label='common.close' onclick='document.getElementById("worktimeOverlay").classList.remove("open")'>✕</button>
      <div class='modal-title' id='worktimeTitle'>🗓 ${t('worktime.title')}</div>
      <div class='worktime-section'><h4>${t('worktime.workdays')}</h4><div class='worktime-day-chips' id='wtDayChips'></div></div>
      <div class='worktime-section'><h4>${t('worktime.customHolidays')}</h4><div id='wtHolidayList'></div><div style='display:flex;gap:8px;margin-top:8px'><input type='date' id='wtHolidayDate' style='padding:4px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px'><input id='wtHolidayLabel' placeholder='${t('worktime.holidayLabel')}' style='padding:4px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;flex:1'><button class='btn btn-primary' id='wtAddHoliday' style='font-size:12px'>${t('worktime.addHoliday')}</button><button class='btn' id='wtLoadHoliday' style='font-size:12px'>${t('worktime.loadHoliday')}</button></div></div>
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
    const isSelected = workdays.includes(i);
    chip.className = 'worktime-chip' + (isSelected ? ' active' : '');
    chip.textContent = name;
    chip.setAttribute('role', 'checkbox');
    chip.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    chip.setAttribute('tabindex', '0');
    chip.setAttribute('aria-label', name);

    const toggle = () => {
      const idx = workdays.indexOf(i);
      if (idx >= 0) workdays.splice(idx, 1);
      else workdays.push(i);
      workdays.sort();
      const active = workdays.includes(i);
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-checked', active ? 'true' : 'false');
    };

    chip.onclick = toggle;
    chip.onkeydown = e => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggle();
      }
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
      del.setAttribute('role', 'button');
      del.setAttribute('tabindex', '0');
      const delLabel = h.label
        ? `${t('common.delete')}: ${h.date} (${h.label})`
        : `${t('common.delete')}: ${h.date}`;
      del.setAttribute('aria-label', delLabel);
      del.title = delLabel;

      const removeHoliday = () => {
        holidays.splice(i, 1);
        renderHolidays();
      };

      del.onclick = removeHoliday;
      del.onkeydown = e => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          removeHoliday();
        }
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

  el.querySelector('#wtLoadHoliday').onclick = async () => {
    try {
      const res = await fetch('/holidays/tw.json');
      if (!res.ok) return;
      const data = await res.json();
      loadHolidaysFromJSON(data);
      const entries = Array.isArray(data) ? data : [data];
      for (const entry of entries) {
        if (entry.holidays) {
          for (const [date, label] of Object.entries(entry.holidays)) {
            if (!holidays.find(h => h.date === date)) {
              holidays.push({ date, label });
            }
          }
        }
      }
      holidays.sort((a, b) => a.date.localeCompare(b.date));
      renderHolidays();
    } catch {
      // Silently ignore load failures.
    }
  };

  el.classList.add('open');
}
