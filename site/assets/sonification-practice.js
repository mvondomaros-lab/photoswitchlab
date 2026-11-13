/* Practice field for the app's audible spectrum; accessible presentation only. */
(() => {
  const assetRoot = new URL('../', document.currentScript.src);
  const practice = document.querySelector('[data-sonification-practice]');
  if (!practice) return;
  const comma = (value, digits) => value.toFixed(digits).replace('.', ',');
  let loading;

  function load(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL(src, assetRoot);
      script.onload = resolve;
      script.onerror = () => reject(new Error(`${src} konnte nicht geladen werden`));
      document.head.append(script);
    });
  }

  // Same model as the band figure: Gaussians with sigma = 0.15 eV on the app's 0.05 eV grid.
  function points() {
    return Array.from({length: 81}, (_, i) => {
      const x = Math.round((1.5 + i * 0.05) * 100) / 100;
      const y = [[3.0, 0.5], [4.0, 0.3]].reduce((sum, [energy, strength]) => sum + strength * Math.exp(-0.5 * ((x - energy) / 0.15) ** 2), 0);
      return {x, y};
    });
  }

  function create() {
    loading ??= load('assets/vendor/chart2music.js').then(() => load('assets/sonification-audio.js')).then(() => {
      const {err} = globalThis.c2mChart({
        type: 'line', element: practice.querySelector('[data-sonification]'), cc: practice.querySelector('[data-sonification-cc]'),
        lang: 'de', title: 'Bandenspektrum zum Üben', data: points(), audioEngine: globalThis.SonificationAudio?.(),
        axes: {
          x: {label: 'Energie / eV', format: (x) => `${comma(x, 2)} eV, ${Math.round(1239.8419843320026 / x)} nm`},
          y: {label: 'Relative Absorption', minimum: 0, format: (y) => y > 0 && y < 0.001 ? 'unter 0,001' : y.toLocaleString('de-DE', {maximumSignificantDigits: 2})},
        },
      });
      if (err) throw new Error(err);
    });
    return loading;
  }

  function sync() {
    const simple = document.body.classList.contains('text-preferred');
    practice.hidden = !simple;
    if (simple) create().catch((error) => { practice.hidden = true; console.error(error); });
  }
  document.addEventListener('photoswitchlab-presentation', sync);
  sync();
})();
