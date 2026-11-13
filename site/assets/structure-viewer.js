/* Progressive 3D structure viewer for the structures chapter. */
(() => {
  const assetRoot = new URL('../', document.currentScript.src);
  const nglUrl = new URL('assets/vendor/ngl.js', assetRoot);
  const structureUrl = new URL('assets/structures/azobenzene-trans.sdf', assetRoot);
  let nglPromise;

  function syncPresentation(viewer) {
    const simple = document.body.classList.contains('text-preferred');
    const ready = viewer.dataset.viewerState === 'ready';
    const figure = viewer.closest('figure');
    figure.querySelector('[data-viewer-fallback]').hidden = !simple && ready;
    figure.querySelector('[data-viewer-instruction]').hidden = simple || !ready;
    viewer.querySelector('[data-viewer-status]').hidden = simple || ready;
    if (!simple && ready) viewer._nglStage?.handleResize();
  }

  function loadNgl() {
    if (globalThis.NGL) return Promise.resolve(globalThis.NGL);
    if (nglPromise) return nglPromise;
    nglPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = nglUrl;
      script.onload = () => globalThis.NGL ? resolve(globalThis.NGL) : reject(new Error('NGL fehlt'));
      script.onerror = () => reject(new Error('NGL konnte nicht geladen werden'));
      document.head.append(script);
    });
    return nglPromise;
  }

  function showFallback(viewer, error) {
    viewer.dataset.viewerState = 'failed';
    const status = viewer.querySelector('[data-viewer-status]');
    status.textContent = 'Das interaktive 3D-Modell ist nicht verfügbar. Die Skelettformel bleibt als Ersatzdarstellung sichtbar.';
    syncPresentation(viewer);
    console.error(error);
  }

  async function initialize(viewer) {
    if (document.body.classList.contains('text-preferred')) return;
    if (viewer.dataset.viewerState) return;
    viewer.dataset.viewerState = 'loading';
    try {
      const NGL = await loadNgl();
      if (document.body.classList.contains('text-preferred')) {
        delete viewer.dataset.viewerState;
        syncPresentation(viewer);
        return;
      }
      const stage = new NGL.Stage(viewer, {
        backgroundColor: '#fafcff',
        quality: 'medium',
        clipDist: 0.1,
        fogNear: 100,
        fogFar: 200,
      });
      const resizeObserver = new ResizeObserver(() => { if (!document.body.classList.contains('text-preferred')) stage.handleResize(); });
      resizeObserver.observe(viewer);
      const component = await stage.loadFile(structureUrl.href, {ext: 'sdf'});
      component.addRepresentation('ball+stick', {
        aspectRatio: 1.8,
        bondScale: 0.35,
        multipleBond: 'symmetric',
      });
      component.autoView(0);
      stage.handleResize();
      requestAnimationFrame(() => {
        if (document.body.classList.contains('text-preferred')) return;
        stage.handleResize();
        component.autoView(0);
      });
      viewer.dataset.viewerState = 'ready';
      viewer._nglStage = stage;
      viewer._nglResizeObserver = resizeObserver;
      syncPresentation(viewer);
    } catch (error) {
      showFallback(viewer, error);
    }
  }

  for (const viewer of document.querySelectorAll('[data-ngl-viewer]')) {
    const disclosure = viewer.closest('details');
    const initializeWhenOpen = () => {
      syncPresentation(viewer);
      if (!disclosure || disclosure.open) initialize(viewer);
    };
    document.addEventListener('photoswitchlab-presentation', initializeWhenOpen);
    disclosure?.addEventListener('toggle', initializeWhenOpen);
    initializeWhenOpen();
  }
})();
