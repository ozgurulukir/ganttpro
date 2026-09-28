import { D } from '../render/deps.js';
import { t } from '../i18n/index.js';

export function exportPDF() {
  const { curProj, tasks } = D;
  const proj = curProj();
  const now = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Taipei' });
  document.getElementById('printProjName').textContent = proj.name;
  document.getElementById('printMeta').textContent =
    `${t('export.printed')}: ${now}  |  ${t('export.period')}: ${proj.startDate} ~ ${proj.endDate}  |  ${t('export.taskCount', { count: tasks.length })}`;

  // Temporarily remove dark mode for print (white background)
  const wasDark = document.body.classList.contains('dark');
  if (wasDark) document.body.classList.remove('dark');

  window.print();

  if (wasDark) document.body.classList.add('dark');
}

export function openPrintSettings() {
  let el = document.getElementById('printOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'printOverlay';
    el.className = 'overlay';
    el.innerHTML = `<div class='modal print-settings-modal' onclick='event.stopPropagation()'>
      <button class='modal-close' onclick='document.getElementById("printOverlay").classList.remove("open")'>✕</button>
      <div class='modal-title'>🖨 ${t('printSettings.title')}</div>
      <div class='print-settings-row'><label>${t('printSettings.paperSize')}</label><select id='printPaper'><option value='A4'>A4</option><option value='A3'>A3</option></select></div>
      <div class='print-settings-row'><label>${t('printSettings.orientation')}</label><select id='printOrientation'><option value='landscape'>${t('printSettings.landscape')}</option><option value='portrait'>${t('printSettings.portrait')}</option></select></div>
      <div class='print-settings-row'><label>${t('printSettings.showTaskList')}</label><input type='checkbox' id='printTaskList' checked></div>
      <div class='modal-footer'><button class='btn' onclick='document.getElementById("printOverlay").classList.remove("open")'>${t('common.cancel')}</button><button class='btn btn-primary' id='printGoBtn'>${t('printSettings.print')}</button></div>
    </div>`;
    el.addEventListener('click', e => {
      if (e.target === el) el.classList.remove('open');
    });
    document.body.appendChild(el);
  }
  el.querySelector('#printGoBtn').onclick = () => {
    const size = el.querySelector('#printPaper').value;
    const orient = el.querySelector('#printOrientation').value;
    const style = document.createElement('style');
    style.id = 'printInjected';
    style.textContent = `@page{size:${size} ${orient};margin:12mm}`;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => style.remove(), 1000);
    el.classList.remove('open');
  };
  el.classList.add('open');
}
