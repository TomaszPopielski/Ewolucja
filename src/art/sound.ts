/*
 * sound.ts — dźwięki interfejsu syntetyzowane w WebAudio (bez plików, gra zostaje
 * jednym plikiem offline). Domyślnie wyłączone (sala lekcyjna); włącza je gracz
 * w Ustawieniach. Każdy dźwięk to krótka, cicha figura w stylu „pozytywki”.
 */
import { getSettings } from './settings.ts';

export type SoundName = 'click' | 'stamp' | 'variant' | 'card' | 'warn' | 'era' | 'win' | 'lose' | 'good' | 'bad' | 'toast';

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (getSettings().sound !== 'on') return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch (e) { return null; }
}

/** Jeden ton: częstotliwość [Hz], start [s od teraz], długość [s], głośność, barwa. */
function tone(a: AudioContext, f: number, t0: number, dur: number, vol: number, type: OscillatorType = 'sine', glide = 0) {
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  const now = a.currentTime + t0;
  o.frequency.setValueAtTime(f, now);
  if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * glide), now + dur);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(vol, now + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g).connect(a.destination);
  o.start(now); o.stop(now + dur + 0.02);
}
/** Krótki szum (pieczątka, uderzenie). */
function thud(a: AudioContext, t0: number, dur: number, vol: number, freq = 600) {
  const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(a.currentTime + t0);
}

export function playSound(name: SoundName) {
  const a = audio(); if (!a) return;
  const V = 0.08;
  switch (name) {
    case 'click': tone(a, 660, 0, 0.06, V * 0.5, 'triangle'); break;
    case 'stamp': thud(a, 0, 0.12, 0.5, 900); tone(a, 523, 0.03, 0.18, V, 'triangle'); tone(a, 784, 0.1, 0.22, V * 0.8, 'triangle'); break;
    case 'variant': tone(a, 440, 0, 0.18, V, 'sine', 1.5); tone(a, 660, 0.12, 0.2, V * 0.7, 'sine'); break;
    case 'card': tone(a, 392, 0, 0.12, V * 0.8, 'triangle'); tone(a, 587, 0.08, 0.16, V * 0.8, 'triangle'); break;
    case 'warn': tone(a, 110, 0, 0.9, V * 1.2, 'sawtooth', 0.8); tone(a, 98, 0.25, 0.9, V, 'sine'); break;
    case 'era': [392, 494, 587, 784].forEach((f, i) => tone(a, f, i * 0.11, 0.6, V * 0.8, 'triangle')); break;
    case 'win': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(a, f, i * 0.14, 0.5, V, 'triangle')); break;
    case 'lose': [392, 349, 311, 262].forEach((f, i) => tone(a, f, i * 0.22, 0.6, V * 0.8, 'sine')); break;
    case 'good': tone(a, 587, 0, 0.15, V * 0.7, 'sine'); tone(a, 880, 0.09, 0.2, V * 0.6, 'sine'); break;
    case 'bad': tone(a, 220, 0, 0.3, V * 0.8, 'triangle', 0.7); break;
    case 'toast': tone(a, 880, 0, 0.08, V * 0.4, 'sine'); break;
  }
}
