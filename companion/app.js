'use strict';
const token = location.hash.slice(1);
history.replaceState(null, '', location.pathname);
const $ = id => document.getElementById(id);
let ready = false, bundle = null, busy = false;
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function controls() {
  $('apply').disabled = busy || !ready || !bundle || (!$('items').checked && !$('runes').checked);
  $('retry').disabled = busy;
  $('file').disabled = busy;
  $('items').disabled = busy; $('runes').disabled = busy;
}
async function call(path, body = {}) {
  if (!token) throw new Error('This preview session is missing its access token. Close this tab and reopen the companion.');
  const response = await fetch(path, {method:'POST', headers:{'Content-Type':'application/json', 'X-Rift-Token':token}, body:JSON.stringify(body), credentials:'omit', redirect:'error'});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The local companion could not complete this request.');
  return result;
}
function textElement(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
function render() {
  $('preview').hidden = !bundle;
  if (!bundle) return;
  $('build-name').textContent = bundle.buildName;
  $('champion').textContent = `${bundle.championAlias} · Patch ${bundle.patch} · Summoner’s Rift`;
  $('item-list').replaceChildren();
  for (const block of bundle.itemSet.blocks) {
    const section = document.createElement('div'); section.className = 'block';
    section.append(textElement('h4', block.type));
    const list = document.createElement('ul');
    for (const item of block.items) list.append(textElement('li', `${bundle.labels.items[item.id]}${item.count > 1 ? ` ×${item.count}` : ''}`));
    section.append(list); $('item-list').append(section);
  }
  $('rune-list').replaceChildren(...bundle.runePage.selectedPerkIds.map(id => textElement('li', bundle.labels.runes[id])));
}
async function check() {
  busy = true; controls(); status('Checking League Client…');
  try {
    const result = await call('/status'); bundle = result.bundle; ready = result.ready;
    render();
    status(result.error || (ready ? 'League Client is ready. Review your build, then click Apply.' : 'Load an items + runes build file to begin.'), Boolean(result.error));
  } catch (error) { ready = false; status(error.message || 'Could not reach the local companion. Reopen it to retry.', true); }
  finally { busy = false; controls(); }
}
$('file').addEventListener('change', async () => {
  const file = $('file').files[0]; if (!file) return;
  busy = true; ready = false; controls();
  try {
    if (!/\.riftbuild(?: \([1-9][0-9]*\))?\.json$/i.test(file.name) || file.size > 65536) throw new Error('Choose an items + runes .riftbuild.json file smaller than 64 KB.');
    const result = await call('/load', {bundle:JSON.parse(await file.text())});
    bundle = result.bundle; render(); await check();
  } catch (error) { status(error.message || 'This build file could not be read.', true); }
  finally { busy = false; controls(); $('file').value = ''; }
});
$('apply').addEventListener('click', async () => {
  if (busy || !ready) return;
  busy = true; controls(); status('Applying your selected build settings…');
  try { const result = await call('/apply', {items:$('items').checked, runes:$('runes').checked}); status(result.message); }
  catch (error) { ready = false; status(error.message || 'Apply could not finish. Check League Client and retry.', true); }
  finally { busy = false; controls(); }
});
$('retry').addEventListener('click', check);
$('items').addEventListener('change', controls); $('runes').addEventListener('change', controls);
$('close').addEventListener('click', async () => { try { await call('/close'); ready = false; busy = true; controls(); $('close').disabled = true; status('Companion closed. You can close this tab.'); } catch (error) { status(error.message, true); } });
check();
