import './style.css';
import './challengers.css';
import { createI18n } from './i18n.js';

let storage;
try { storage = localStorage; } catch { /* Optional language preference. */ }
const i18n = createI18n(storage);
const t = key => i18n.t(`challengers.${key}`);
const root = document.querySelector('#challengers-app');
root.innerHTML = `<div class="ambient" aria-hidden="true"><div class="orb orb-one"></div><div class="orb orb-two"></div></div>
  <header class="header wrap archive-header"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true">𓂀</span>RADE</a>
  <a href="/" data-copy="home"></a><div class="language-switch" role="group"><button type="button" data-language="sr">SR</button><span aria-hidden="true">|</span><button type="button" data-language="en">EN</button></div></header>
  <main class="wrap archive"><div class="archive-heading"><span class="eyebrow" data-copy="eyebrow"></span><h1 data-copy="title"></h1><p data-copy="subtitle"></p><span class="archive-glyph" aria-hidden="true">𓂀</span></div>
  <p id="archive-status" role="status"></p><div id="challenger-list" class="challenger-grid"></div>
  <button id="archive-more" class="button secondary" type="button" hidden></button></main>
  <footer class="wrap"><p data-copy="foot"></p><a href="/#challenge" class="button primary" id="archive-apply"></a></footer>`;
const list = document.querySelector('#challenger-list');
const status = document.querySelector('#archive-status');
const more = document.querySelector('#archive-more');
let rows = [], next = null, loading = false, failed = false;
const busy = new Set();
const errors = new Set();

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function renderRows() {
  list.replaceChildren();
  for (const row of rows) {
    const card = element('article', undefined, `challenger-tablet${row.defeated_at ? ' is-defeated' : ''}`);
    const top = element('div', undefined, 'tablet-heading');
    top.append(element('span', `𓆣 / ${String(row.id).padStart(4, '0')}`, 'micro gold'), element('span', t(row.defeated_at ? 'defeated' : 'pending'), 'verdict-state'));
    card.append(top, element('h2', row.steam_nick));
    const mmr = element('div', undefined, 'challenger-mmr');
    mmr.append(element('strong', i18n.format(row.mmr)), element('span', t('mmr'), 'micro'));
    card.append(mmr, element('h3', t('reason'), 'micro gold'), element('p', row.description, 'challenger-reason'));
    const facts = element('dl', undefined, 'challenger-facts');
    for (const [key, value] of [['immortal', row.immortal_worthy], ['mortal', row.believes_rade_mortal], ['better', row.better_than_rade]]) {
      const pair = element('div');
      pair.append(element('dt', t(key)), element('dd', value === 'da' ? t('yes') : value === 'ne' ? t('no') : t('unknown')));
      facts.append(pair);
    }
    card.append(facts);
    const date = new Date(row.created_at.replace(' ', 'T') + 'Z');
    card.append(element('p', `${t('date')}: ${Number.isNaN(date.getTime()) ? t('unknown') : date.toLocaleDateString(i18n.language === 'sr' ? 'sr-Latn-RS' : 'en-GB')}`, 'micro muted'));
    const verdict = element('div', undefined, 'challenger-verdict');
    verdict.append(element('p', t('question')));
    const button = element('button', t(row.defeated_at ? 'defeated' : busy.has(row.id) ? 'marking' : 'yes'), 'button primary');
    button.type = 'button';
    button.disabled = Boolean(row.defeated_at) || busy.has(row.id);
    button.addEventListener('click', () => markDefeated(row.id));
    verdict.append(button);
    if (errors.has(row.id)) { const error = element('p', t('error'), 'error'); error.setAttribute('role', 'alert'); verdict.append(error); }
    card.append(verdict);
    list.append(card);
  }
}

function refresh() {
  document.documentElement.lang = i18n.language === 'sr' ? 'sr-Latn' : 'en';
  document.title = `RADE KOMŠA — ${t('nav')}`;
  root.querySelectorAll('[data-copy]').forEach(node => { node.textContent = t(node.dataset.copy); });
  root.querySelector('.language-switch').setAttribute('aria-label', i18n.t('a11y.language'));
  root.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === i18n.language)));
  document.querySelector('#archive-apply').textContent = i18n.t('nav.challenge');
  status.textContent = loading ? t('loading') : failed ? t('error') : !rows.length ? t('empty') : '';
  more.textContent = failed ? t('retry') : t('more');
  more.hidden = !failed && next === null;
  more.disabled = loading;
  renderRows();
}

async function load() {
  if (loading) return;
  loading = true; failed = false; refresh();
  try {
    const response = await fetch(`/api/challengers${next ? `?before=${next}` : ''}`, { signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error('Load failed');
    rows.push(...data.challengers.filter(row => !rows.some(existing => existing.id === row.id)));
    next = data.next;
  } catch { failed = true; }
  finally { loading = false; refresh(); }
}

async function markDefeated(id) {
  if (busy.has(id) || rows.find(row => row.id === id)?.defeated_at) return;
  busy.add(id); errors.delete(id); refresh();
  try {
    const response = await fetch(`/api/challengers/${id}/defeat`, { method: 'POST', signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok || !data.success || !data.defeatedAt) throw new Error('Verdict failed');
    rows.find(row => row.id === id).defeated_at = data.defeatedAt;
  } catch { errors.add(id); }
  finally { busy.delete(id); refresh(); }
}

root.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => { i18n.setLanguage(button.dataset.language); refresh(); }));
more.addEventListener('click', load);
load();
