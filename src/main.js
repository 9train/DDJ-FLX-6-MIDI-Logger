// src/main.js
import {
  requestAccess, setAccess, listInputs, listOutputs,
  bindInput, bindOutput, classify, sendTestNote
} from './midi.js';
import {
  $, els, setConnState, fillDeviceSelects, buildVisuals, handleArrowKeys,
  updateVisuals, addLogRow, clearLog, downloadCSV, renderMap,
  formatData, rawFmt
} from './ui.js';
import {
  loadMappings, saveMappings, addMapping, deleteMapping, downloadJSON
} from './mapper.js';

let mappings = loadMappings();
let learning = false;
let lastLearnMsg = null;

function ts(){ return new Date().toLocaleTimeString(); }

function onMIDIMessage(e){
  const data = new Uint8Array(e.data);
  lastLearnMsg = e;
  const info = classify(data);

  // visuals
  updateVisuals(info);

  // log
  addLogRow({
    time: els.timestamps.checked ? ts() : '',
    device: (els.inputSel.selectedOptions[0]?.textContent || 'n/a'),
    type: info.type,
    ch: info.ch,
    data: formatData(info),
    raw: rawFmt(data, els.showHex.checked)
  });

  // learning hint
  if (learning){
    const guess = info.type==='cc' ? `CC_${info.controller}`
              : (info.type==='noteon'||info.type==='noteoff') ? `NOTE_${info.d1}`
              : info.type.toUpperCase();
    if (!els.mapName.value) els.mapName.value = guess;
    els.lastMsg.textContent = `Captured ${guess} on ch ${info.ch}`;
    els.lastMsg.style.color = '#cde2ff';
  }
}

async function initMIDI(){
  try{
    const access = await requestAccess({ sysex: els.wantSysex.checked });
    setAccess(access);
    setConnState(true);
    fillDeviceSelects(listInputs(), listOutputs());
    access.onstatechange = () => {
      fillDeviceSelects(listInputs(), listOutputs());
      // rebind to current selections
      changePorts();
    };
  }catch(err){
    alert('MIDI request failed: '+err.message);
    setConnState(false);
  }
}

function changePorts(){
  const inId = els.inputSel.value;
  const outId = els.outputSel.value;
  bindInput(inId, onMIDIMessage);
  bindOutput(outId);
  setConnState(Boolean(inId));
}

function wireUI(){
  // Build visuals and key handlers
  buildVisuals(); handleArrowKeys();

  // Buttons
  els.reqBtn.addEventListener('click', initMIDI);
  els.clearBtn.addEventListener('click', clearLog);
  els.dlBtn.addEventListener('click', downloadCSV);
  els.saveMapBtn.addEventListener('click', () => { saveMappings(mappings); flashBtn(els.saveMapBtn); });
  els.dlMapBtn.addEventListener('click', () => downloadJSON(mappings));

  // Combo changes
  els.inputSel.addEventListener('change', changePorts);
  els.outputSel.addEventListener('change', changePorts);

  // Learn mode
  els.learnBtn.addEventListener('click', ()=>{
    learning = !learning;
    els.learnBtn.textContent = learning ? 'Stop learning' : 'Start learning';
    els.lastMsg.textContent = learning ? 'Learning… move a control' : 'Paused';
    els.lastMsg.style.color = learning ? '#cde2ff' : '#9fb2de';
  });

  // Add mapping
  els.addMapBtn.addEventListener('click', ()=>{
    if (!lastLearnMsg){ alert('Move a control while learning first.'); return; }
    const data = new Uint8Array(lastLearnMsg.data);
    const info = classify(data);
    const name = els.mapName.value.trim() || 'UNNAMED';
    addMapping(mappings, { name, info, device: (els.inputSel.selectedOptions[0]?.textContent||'') });
    els.mapName.value = '';
    saveMappings(mappings);
    drawMap();
  });

  // Connection pill LED test
  document.querySelector('.pill').addEventListener('click', sendTestNote);

  // First draw of map
  drawMap();
}

function drawMap(){
  renderMap(els.mapList, mappings, (idx)=>{
    deleteMapping(mappings, idx);
    saveMappings(mappings);
    drawMap();
  });
}

function flashBtn(btn){
  btn.classList.add('active');
  setTimeout(()=>btn.classList.remove('active'), 150);
}

// boot
wireUI();
