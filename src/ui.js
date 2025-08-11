// src/ui.js
import { toHex } from './midi.js';

export function $(id){ return document.getElementById(id); }
export const els = {
  inputSel: $('inputSel'),
  outputSel: $('outputSel'),
  reqBtn: $('reqBtn'),
  clearBtn: $('clearBtn'),
  dlBtn: $('dlBtn'),
  timestamps: $('timestamps'),
  autoscroll: $('autoscroll'),
  showHex: $('showHex'),
  wantSysex: $('wantSysex'),
  logBody: $('logBody'),
  logWrap: $('logWrap'),
  connDot: $('connDot'),
  connText: $('connText'),
  learnBtn: $('learnBtn'),
  mapName: $('mapName'),
  addMapBtn: $('addMapBtn'),
  mapList: $('mapList'),
  saveMapBtn: $('saveMapBtn'),
  dlMapBtn: $('dlMapBtn'),
  chanLeds: $('chanLeds'),
  ccBars: $('ccBars'),
  noteLeds: $('noteLeds'),
  lastMsg: $('lastMsg')
};

let logCount = 0;
const NOTE_WINDOW = 16;
let noteBase = 0;

export function escapeHtml(s){
  return String(s).replace(/[&<>\"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;" }[c]));
}

export function setConnState(ok){
  els.connDot.className = 'dot ' + (ok ? 'ok' : 'bad');
  els.connText.textContent = ok ? 'MIDI connected' : 'MIDI not connected';
}

export function fillDeviceSelects(inputs, outputs){
  els.inputSel.innerHTML = '';
  inputs.forEach(input => {
    const opt = document.createElement('option');
    opt.value = input.id;
    opt.textContent = `${input.name}${input.manufacturer ? ' — '+input.manufacturer : ''}`;
    els.inputSel.appendChild(opt);
  });
  els.outputSel.innerHTML = '';
  outputs.forEach(output => {
    const opt = document.createElement('option');
    opt.value = output.id;
    opt.textContent = `${output.name}${output.manufacturer ? ' — '+output.manufacturer : ''}`;
    els.outputSel.appendChild(opt);
  });
}

export function buildVisuals(){
  els.chanLeds.innerHTML = '';
  for (let i=0;i<16;i++){
    const d=document.createElement('div');
    d.className='led'; d.title='Channel '+(i+1);
    els.chanLeds.appendChild(d);
  }
  els.ccBars.innerHTML = '';
  for (let i=0;i<16;i++){
    const wrap=document.createElement('div'); wrap.className='bar';
    const lab=document.createElement('label'); lab.textContent='CC'+(i+noteBase);
    const span=document.createElement('span'); span.style.height='0%';
    wrap.appendChild(lab); wrap.appendChild(span);
    els.ccBars.appendChild(wrap);
  }
  buildNoteLeds();
}

export function buildNoteLeds(){
  els.noteLeds.innerHTML = '';
  for (let i=0;i<NOTE_WINDOW;i++){
    const d=document.createElement('div');
    d.className='led'; d.title='Note '+(i+noteBase);
    els.noteLeds.appendChild(d);
  }
}

export function handleArrowKeys(){
  window.addEventListener('keydown', (e)=>{
    if(e.key==='ArrowRight'){ noteBase = Math.min(112, noteBase+16); buildNoteLeds(); }
    if(e.key==='ArrowLeft'){ noteBase = Math.max(0, noteBase-16); buildNoteLeds(); }
  });
}

export function flash(el){
  el.classList.add('active');
  setTimeout(()=>el.classList.remove('active'), 120);
}

export function updateVisuals(info){
  const chanEl = els.chanLeds.children[(info.ch-1)] || null;
  if (chanEl) flash(chanEl);
  if (info.type==='cc'){
    const idx = info.controller - noteBase;
    const wrap = els.ccBars.children[(idx % 16)];
    if (wrap){
      const bar = wrap.querySelector('span');
      const pct = Math.round((info.value/127)*100);
      bar.style.height = pct+'%';
      wrap.querySelector('label').textContent = `CC${info.controller}·${info.value}`;
      flash(wrap);
    }
  }
  if (info.type==='noteon' || info.type==='noteoff'){
    const idx = info.d1 - noteBase;
    const led = els.noteLeds.children[(idx % NOTE_WINDOW)];
    if (led){
      (info.type==='noteon') ? led.classList.add('active') : led.classList.remove('active');
      led.title = `Note ${info.d1}`;
      flash(led);
    }
  }
}

export function addLogRow({time, device, type, ch, data, raw}){
  const tr=document.createElement('tr');
  tr.innerHTML = `<td class="nowrap">${(++logCount).toString().padStart(4,'0')}</td>
    <td class="nowrap">${time||''}</td>
    <td>${escapeHtml(device)}</td>
    <td class="nowrap"><span class="badge">${type}</span></td>
    <td>${ch}</td>
    <td>${escapeHtml(data)}</td>
    <td class="muted">${escapeHtml(raw)}</td>`;
  els.logBody.appendChild(tr);
  if (els.autoscroll.checked){ els.logWrap.scrollTop = els.logWrap.scrollHeight; }
}

export function clearLog(){
  els.logBody.innerHTML = ''; 
  logCount = 0;
}

export function downloadCSV(){
  const rows = [['#','time','device','type','channel','data','raw']];
  for (const tr of els.logBody.querySelectorAll('tr')){
    const tds = [...tr.children].map(td => td.innerText);
    rows.push(tds);
  }
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'midi_log.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

export function renderMap(listEl, mappings, onDelete){
  listEl.innerHTML = '';
  mappings.forEach((m, idx) => {
    const d = document.createElement('div'); d.className = 'mapitem';
    d.innerHTML = `
      <div class="k">${escapeHtml(m.key)}</div>
      <div class="v">${escapeHtml(m.name)}</div>
      <div class="tiny" style="margin-top:6px">${escapeHtml(m.device||'any')} • ch ${m.ch} • ${m.type} ${m.code}</div>
      <div class="row" style="margin-top:6px">
        <button data-i="${idx}" class="ghost">Delete</button>
      </div>`;
    d.querySelector('button').onclick = () => onDelete(idx);
    listEl.appendChild(d);
  });
}

export function formatData(info){
  if (info.type==='cc')     return `CC ${info.controller} → ${info.value}`;
  if (info.type==='noteon' || info.type==='noteoff') return `Note ${info.d1} vel ${info.d2}`;
  if (info.type==='pitch')  return `PB ${info.value}`;
  return `${info.d1 ?? ''} ${info.d2 ?? ''}`;
}

export function rawFmt(data, asHex){
  return asHex ? toHex(data) : Array.from(data).join(',');
}
