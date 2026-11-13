/* Shared Chart2Music audio engine for the app and the teaching website. */
"use strict";
// Chart2Music never resumes its AudioContext; Safari keeps such a context suspended.
// This engine resumes it within each key press and otherwise plays a short tone.
globalThis.SonificationAudio = function () {
  const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Context) return undefined;
  let context = null, output = null;
  return {
    get masterGain() { return output?.gain.value ?? 0.5; },
    set masterGain(value) { if (output) output.gain.value = value; },
    playDataPoint(frequency, panning, duration = 0.2) {
      if (!context) {
        context = new Context();
        output = context.createGain();
        output.gain.value = 0.5;
        output.connect(context.destination);
      }
      if (context.state !== "running") context.resume?.();
      const start = context.currentTime, oscillator = context.createOscillator(), envelope = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = frequency;
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(0.6, start + 0.02);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(envelope);
      if (context.createStereoPanner) {
        const panner = context.createStereoPanner();
        panner.pan.value = panning;
        envelope.connect(panner).connect(output);
      } else envelope.connect(output);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.05);
    },
  };
};
