// src/board.js
// Loads assets/board.svg into #boardHost, merges flx6_map.json with local mappings,
// and exposes initBoard() + consumeInfo(info) for main.js to light/move parts.

import { loadMappings as loadLocalMappings } from './mapper.js';

const DEFAULT_SVG_URL = './assets/board.svg';
const DEFAULT_MAP_URL = './flx6_map.json';

let svgRoot = null;
let unifiedMap = [];
const lastCCValue = Object.create(null);

export async function initBoard({ hostId, svgUrl = DEFAULT_SVG_URL, mapUrl = DEFAULT_MAP_URL } = {}){
  const host = document.getElementById(hostId);
  if (!host) throw new Error(`Board host #${hostId} not found`);

  // Load SVG
  const svgTxt = await (await fetch(svgUrl, { cache: 'no-store' })).text();
  host.innerHTML = svgTxt;
  svgRoot = host.querySelector('svg');

  // Merge file map (with targets) + localStorage map (names only)
  const fileMap = await fetchJSON(mapUrl);
  const local   = loadLocalMappings();
  unifiedMap = mergeMaps(fileMap, local);
}

function mergeMaps(fileMap, local){
  const byKey = new Map();

  // Prefer entries with a target from the file map
  fileMap.forEach(m => {
    if (m.key || m.target) byKey.set(m.key || m.target, m);
  });

  // Merge local learned names; keep file targets if present
  local.forEach(m => {
    const k = m.key || m.name;
    if (byKey.has(k)){
      const base = byKey.get(k);
      byKey.set(k, { ...base, name: m.name || base.name });
    } else {
      byKey.set(k, { ...m });
    }
  });

  return Array.from(byKey.values());
}

async function fetchJSON(url){
  try{
    const r = await fetch(url, { cache: 'no-store' });
    return r.ok ? await r.json() : [];
  }catch{
    return [];
  }
}

function infoKey(info){
  const code = info.type === 'cc' ? info.controller
           : (info.type === 'noteon' || info.type === 'noteoff') ? info.d1
           : info.d1;
  return `${info.type}:${info.ch}:${code}`;
}

// Some controllers send NOTE ON with velocity 0 instead of a NOTE OFF
function isNoteOnZeroOff(info){
  // We don't know your exact classifier shape, so check both common fields
  // d2 (raw data byte 2) or velocity/value props that some classifiers add
  return info?.type === 'noteon' && (info.d2 === 0 || info.velocity === 0 || info.value === 0);
}

export function consumeInfo(info){
  if (!svgRoot) return;

  const k = infoKey(info);
  // Match by exact "key" if provided, else by (type,ch,code)
  const entry = unifiedMap.find(m =>
    (m.key && m.key === k && m.target) ||
    (!m.key && m.type === (info.type||'') && m.ch === info.ch && m.code === (info.controller ?? info.d1) && m.target)
  );
  if (!entry) return;

  const el = svgRoot.getElementById(entry.target);
  if (!el) return;

  // Handle NOTE-ON with velocity 0 as off
  if (isNoteOnZeroOff(info)){
    el.classList.remove('lit');
    return;
  }

  if (info.type === 'cc'){
    el.classList.add('lit');
    animateContinuous(el, entry, info.value);
  } else if (info.type === 'noteon'){
    el.classList.add('lit');
    setTimeout(()=> el.classList.remove('lit'), 120);
  } else if (info.type === 'noteoff'){
    el.classList.remove('lit');
  }
}

function animateContinuous(el, entry, value){
  lastCCValue[entry.target] = value;
  const id = (entry.target || '').toLowerCase();

  // Vertical sliders/faders:
  // support 'fader', 'slider_tempo', and any id starting with 'slider_'
  if ((/fader|slider_tempo|^slider_/i.test(id)) && el.hasAttribute('y')) {
    const minY = parseFloat(el.getAttribute('data-minY') || el.getAttribute('y') || '0');
    const maxY = parseFloat(el.getAttribute('data-maxY') || (minY + 140));
    const y    = lerp(minY, maxY, value/127);
    el.setAttribute('y', y.toFixed(1));
    return;
  }

  // Crossfader horizontal:
  // support 'xfader' and 'crossfader'
  if ((id.includes('xfader') || id.includes('crossfader')) && el.hasAttribute('x')) {
    const minX = parseFloat(el.getAttribute('data-minX') || '-200');
    const maxX = parseFloat(el.getAttribute('data-maxX') || '200');
    const x    = lerp(minX, maxX, value/127);
    el.setAttribute('x', x.toFixed(1));
    return;
  }

  // Knobs / continuous circles (trim, eq, filter, generic knob)
  if (id.includes('knob') || id.includes('trim') || id.includes('eq_') || id.includes('filter')){
    const r0 = parseFloat(el.getAttribute('r') || '10');
    const r  = clamp(r0 * (0.9 + 0.25*(value/127)), 8, r0*1.25);
    el.setAttribute('r', r.toFixed(2));
    return;
  }

  // Default: light only
  el.classList.add('lit');
}

function lerp(a,b,t){ return a + (b-a)*t; }
function clamp(v,lo,hi){ return Math.max(lo, Math.min(hi, v)); }
