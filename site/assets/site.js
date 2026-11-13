/* Optional enhancements; navigation, disclosures and equations work without JS. */
const root = new URL('../', document.currentScript.src);
// This preference affects presentation only; all descriptions remain available.
const textPreference = document.querySelector('#text-preference');
if (textPreference) {
  const query = new URLSearchParams(location.search).get('text');
  let saved = false;
  try { saved = localStorage.getItem('photoswitchlab.textPreferred') === 'true'; } catch (_) {}
  textPreference.checked = query === '1' || (query !== '0' && saved);
  if (query === '1' || query === '0') {
    try { localStorage.setItem('photoswitchlab.textPreferred', String(textPreference.checked)); } catch (_) {}
  }
  const descriptions = [...document.querySelectorAll('details.text-alternative')];
  const disclosureStates = {
    graphical: descriptions.map(description => description.open),
    text: descriptions.map(() => true),
  };
  const sidebar = document.querySelector('.sidebar');
  const main = document.querySelector('main');
  const article = main?.querySelector?.('article');
  const navigation = sidebar?.querySelector?.('.site-menu');
  const outlinePanel = document.querySelector('.outline');
  let sidebarOrigin;
  const navigationStates = {graphical: navigation ? !matchMedia('(max-width: 700px)').matches : undefined, text: false};
  const originalOutlineHidden = outlinePanel?.hidden;
  let activeMode = textPreference.checked ? 'text' : 'graphical';
  const apply = () => {
    document.body.classList.toggle('text-preferred', activeMode === 'text');
    descriptions.forEach((description, index) => { description.open = disclosureStates[activeMode][index]; });
    if (sidebar?.parentNode && article) {
      if (activeMode === 'text') {
        if (!sidebarOrigin) {
          sidebarOrigin = document.createComment('Original site navigation position');
          sidebar.parentNode.insertBefore(sidebarOrigin, sidebar);
        }
        main.insertBefore(sidebar, article);
      } else if (sidebarOrigin) sidebarOrigin.parentNode.insertBefore(sidebar, sidebarOrigin.nextSibling);
      navigation.open = navigationStates[activeMode];
      if (outlinePanel) outlinePanel.hidden = activeMode === 'text' || originalOutlineHidden;
    }
    if (typeof Event === 'function') document.dispatchEvent?.(new Event('photoswitchlab-presentation'));
  };
  apply();
  textPreference.addEventListener('change', () => {
    disclosureStates[activeMode] = descriptions.map(description => description.open);
    navigationStates[activeMode] = navigation?.open;
    activeMode = textPreference.checked ? 'text' : 'graphical';
    apply();
    try { localStorage.setItem('photoswitchlab.textPreferred', String(textPreference.checked)); } catch (_) {}
  });
}
const mobileNavigation = matchMedia('(max-width: 700px)');
const siteMenu = document.querySelector('.site-menu');
siteMenu.open = textPreference?.checked ? false : !mobileNavigation.matches;
mobileNavigation.addEventListener('change', event => { if (!textPreference?.checked) siteMenu.open = !event.matches; });
const outline = document.querySelector('.outline details');
if (outline && matchMedia('(max-width: 1150px)').matches) outline.open = false;

const dialog = document.querySelector('#search-dialog');
const input = document.querySelector('#search-input');
const results = document.querySelector('#search-results');
const status = document.querySelector('#search-status');
const searchButton = document.querySelector('#search-toggle');
let entries;
searchButton.hidden = false;
searchButton.addEventListener('click', async () => {
  dialog.showModal(); input.focus();
  if (!entries) {
    status.textContent = 'Suche wird geladen …';
    try {
      const response = await fetch(new URL('assets/search.json', root));
      if (!response.ok) throw new Error(response.status);
      entries = await response.json(); search();
    } catch (_) { status.textContent = 'Die Suche konnte nicht geladen werden. Bitte versuchen Sie es erneut.'; }
  }
});
function search() {
  results.replaceChildren();
  if (!entries) return;
  const terms = input.value.trim().toLocaleLowerCase('de').split(/\s+/).filter(Boolean);
  if (!terms.length) { status.textContent = 'Geben Sie einen Suchbegriff ein.'; return; }
  const matches = entries.filter(entry => terms.every(term => (entry.title + ' ' + entry.text).toLocaleLowerCase('de').includes(term)));
  // Prefer matches in chapter/section names over incidental mentions in prose.
  const score = entry => terms.filter(term => entry.title.toLocaleLowerCase('de').includes(term)).length;
  matches.sort((a, b) => score(b) - score(a));
  status.textContent = `${matches.length} Treffer`;
  for (const entry of matches) {
    const item = document.createElement('li');
    const link = document.createElement('a'); link.href = new URL(entry.url, root); link.textContent = entry.title;
    link.addEventListener('click', () => dialog.close());
    const snippet = document.createElement('p');
    const start = Math.max(0, entry.text.toLocaleLowerCase('de').indexOf(terms[0]) - 50);
    snippet.textContent = (start ? '… ' : '') + entry.text.slice(start, start + 200) + ' …';
    item.append(link, snippet); results.append(item);
  }
}
input.addEventListener('input', search);
// Open enclosing explanations when following a deep link into a disclosure.
function revealAnchor() {
  let target;
  try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (_) { return; }
  if (!target) return;
  if (target.matches('a[data-legacy-anchor]')) { location.replace(target.href); return; }
  for (let parent = target.parentElement; parent; parent = parent.parentElement) {
    if (parent.tagName === 'DETAILS') parent.open = true;
  }
}
addEventListener('hashchange', revealAnchor); revealAnchor();
