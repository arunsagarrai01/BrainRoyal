/**
 * Tiny WebAudio sound effects.
 *
 * No audio files are shipped: short oscillator blips are generated in the browser
 * and can be muted from the game HUD. The preference is stored in localStorage.
 */
const STORAGE_KEY = "brainroyale:sound";

let audioContext = null;

export function getSoundEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Private mode / storage disabled: sound still works for this page view.
  }
}

/** kind: "correct" | "wrong" | "tick" */
export function playTone(kind) {
  if (!getSoundEnabled()) return;

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    audioContext ??= new AudioCtx();

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    const settings = {
      correct: { type: "sine", from: 880, to: 1320, length: 0.18, volume: 0.12 },
      wrong: { type: "sawtooth", from: 240, to: 120, length: 0.24, volume: 0.09 },
      tick: { type: "square", from: 640, to: 640, length: 0.06, volume: 0.05 },
    }[kind] || { type: "sine", from: 520, to: 520, length: 0.1, volume: 0.08 };

    oscillator.type = settings.type;
    oscillator.frequency.setValueAtTime(settings.from, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      settings.to,
      now + settings.length
    );

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(settings.volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + settings.length + 0.04
    );

    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + settings.length + 0.05);
  } catch {
    // Audio is a nice-to-have; never let it break the game.
  }
}
