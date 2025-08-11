// src/mapper.js
const KEY = 'flx6_map';

export function loadMappings() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

export function saveMappings(m) {
  localStorage.setItem(KEY, JSON.stringify(m));
}

export function addMapping(mappings, { name, info, device }) {
  const key = `${info.type}:${info.ch}:${info.type === 'cc' ? info.controller :
    (info.type === 'noteon' || info.type === 'noteoff') ? info.d1 : info.d1}`;
  mappings.push({
    name: name || 'UNNAMED',
    key,
    device: device || '',
    ch: info.ch,
    type: info.type,
    code: info.type === 'cc' ? info.controller :
          (info.type === 'noteon' || info.type === 'noteoff') ? info.d1 : info.d1
  });
  return mappings;
}

export function deleteMapping(mappings, index) {
  mappings.splice(index, 1);
  return mappings;
}

export function downloadJSON(mappings, filename = 'flx6_map.json') {
  const blob = new Blob([JSON.stringify(mappings, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
