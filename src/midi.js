// src/midi.js
export let midiAccess = null;
export let currentInput = null;
export let currentOutput = null;

export function requestAccess({ sysex = false } = {}) {
  return navigator.requestMIDIAccess({ sysex });
}

export function setAccess(access) {
  midiAccess = access;
}

export function listInputs() {
  if (!midiAccess) return [];
  return Array.from(midiAccess.inputs.values());
}

export function listOutputs() {
  if (!midiAccess) return [];
  return Array.from(midiAccess.outputs.values());
}

export function bindInput(id, onMessage) {
  if (currentInput) currentInput.onmidimessage = null;
  currentInput = id ? midiAccess.inputs.get(id) : null;
  if (currentInput) currentInput.onmidimessage = onMessage;
  return currentInput;
}

export function bindOutput(id) {
  currentOutput = id ? midiAccess.outputs.get(id) : null;
  return currentOutput;
}

export function sendTestNote() {
  if (!currentOutput) return;
  // Note on ch1, note 36, vel 100; then off
  currentOutput.send([0x90, 36, 100]);
  setTimeout(() => currentOutput.send([0x80, 36, 0]), 120);
}

export function classify(bytes) {
  const [status, d1, d2] = bytes;
  const typeNibble = status >> 4;
  const ch = (status & 0x0f) + 1;
  switch (typeNibble) {
    case 0x8: return { type: 'noteoff', ch, d1, d2 };
    case 0x9: return { type: d2 ? 'noteon' : 'noteoff', ch, d1, d2 };
    case 0xB: return { type: 'cc', ch, controller: d1, value: d2 };
    case 0xE: return { type: 'pitch', ch, value: ((d2 << 7) | d1) - 8192 };
    default:  return { type: 'other', ch, d1, d2 };
  }
}

export function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
}
