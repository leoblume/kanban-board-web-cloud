// weather-panel.js — painel do tempo (lado direito)
import { getWeather, searchCities, iconFor, rainOutlook } from './weather-core.js';

const REFRESH_MS = 30 * 60 * 1000;   // atualização automática: 30 min
const DEFAULT_CITIES = [{ name: 'Novo Hamburgo, RS', sub: 'Rio Grande do Sul, Brasil', lat: -29.6783, lon: -51.1306 }];

const $ = id => document.getElementById(id);
const tabsEl = $('weather-city-tabs'), bodyEl = $('weather-body'), footerEl = $('weather-footer');
const searchBox = $('weather-search'), searchInput = $('weather-search-input'), searchResults = $('weather-search-results');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const readJson = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fb; } catch { return fb; } };

// ---------- estado ----------
let cities = readJson('weatherCities', DEFAULT_CITIES);
if (!Array.isArray(cities) || !cities.length) cities = DEFAULT_CITIES.slice();
let active = Math.min(Math.max(parseInt(localStorage.getItem('weatherActive') || '0', 10) || 0, 0), cities.length - 1);
const cache = new Map();           // "lat,lon" -> { data, at }
let errorMsg = null, loading = false;
let selectedModel = null, modelViewUntil = 0;
const MODEL_VIEW_MS = 25 * 1000;
const keyOf = c => `${c.lat},${c.lon}`;
const saveCities = () => { localStorage.setItem('weatherCities', JSON.stringify(cities)); localStorage.setItem('weatherActive', String(active)); };

// ---------- formatação ----------
const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const mmTxt = v => (v == null || v < 0.1) ? '0 mm' : `${nf.format(v)} mm`;
const deg = v => v == null ? '–' : `${Math.round(v)}°`;
const fmtDur = min => {
  min = Math.max(0, Math.round(min / 5) * 5);
  if (min < 90) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};
const dayLabel = (iso, i) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12);
  const wd = dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const name = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : wd.charAt(0).toUpperCase() + wd.slice(1);
  return { name, date: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}` };
};

// ---------- dados ----------
const fetchWeather = ({ lat, lon }) => getWeather({ lat, lon });
const apiSearch = q => searchCities(q);

async function loadCity(city, force = false) {
  const c = cache.get(keyOf(city));
  if (!force && c && Date.now() - c.at < REFRESH_MS) { render(); return; }
  loading = true; render();
  try {
    const data = await fetchWeather(city);
    cache.set(keyOf(city), { data, at: Date.now() });
    errorMsg = null;
  } catch (e) {
    console.error('Erro ao carregar clima:', e);
    errorMsg = 'Não foi possível carregar a previsão.';
  }
  loading = false; render();
}

// ---------- render ----------
function renderTabs() {
  tabsEl.innerHTML = cities.map((c, i) => `
    <button class="wx-tab${i === active ? ' is-active' : ''}" data-i="${i}" title="${esc(c.sub || c.name)}">
      ${esc(c.name.split(',')[0])}${cities.length > 1 ? `<span class="wx-tab-x" data-x="${i}" title="Remover">×</span>` : ''}
    </button>`).join('');
}

function rainBanner(d) {
  const o = rainOutlook(d.nowcast.steps, d.nowcast.stepMin);
  const extra = [o.n ? `${o.agree}/${o.n} modelos` : (o.prob != null ? `${o.prob}%` : null), o.mm != null ? `~${mmTxt(o.mm)}` : null].filter(Boolean).join(' · ');
  if (o.kind === 'now') {
    const until = o.untilMin == null ? 'sem previsão de parar nas próximas 24 h' : `deve parar em ~${fmtDur(o.untilMin)}`;
    return { cls: 'wet', icon: '🌧️', title: 'Chovendo agora', sub: `${until}${extra ? ' · ' + extra : ''}` };
  }
  if (o.kind === 'soon') {
    const when = o.inMin < 5 ? 'em instantes' : `em ~${fmtDur(o.inMin)}`;
    const dur = o.durMin == null ? '' : ` · dura ~${fmtDur(o.durMin)}`;
    return { cls: 'soon', icon: '🌦️', title: `Chuva ${when}`, sub: `${extra}${dur}` };
  }
  if (o.kind === 'dry') {
    const next = d.days.findIndex((x, i) => i > 0 && (x.prob >= 40 || x.mm >= 1));
    const sub = next > 0 ? `Próxima chuva: ${dayLabel(d.days[next].date, next).name} ${dayLabel(d.days[next].date, next).date} (${d.days[next].prob}%, ${mmTxt(d.days[next].mm)})` : 'Sem chuva relevante nos próximos 10 dias';
    return { cls: 'dry', icon: '☀️', title: 'Sem chuva nas próximas 24 h', sub };
  }
  return { cls: 'dry', icon: '❔', title: 'Sem dados de chuva', sub: '' };
}

function render() {
  renderTabs();
  const city = cities[active];
  const entry = cache.get(keyOf(city));

  if (!entry) {
    bodyEl.innerHTML = errorMsg
      ? `<div class="wx-msg wx-msg--err">${esc(errorMsg)}<br><button class="wx-link" id="wx-retry">Tentar de novo</button></div>`
      : `<div class="wx-msg">Carregando previsão…</div>`;
    footerEl.textContent = '';
    return;
  }

  const baseData = entry.data;
  const selected = selectedModel && Date.now() < modelViewUntil
    ? (baseData.modelForecasts || []).find(m => m.id === selectedModel) : null;
  if (!selected && selectedModel) { selectedModel = null; modelViewUntil = 0; }
  const d = selected ? selected.data : baseData;
  const cur = d.current, b = rainBanner(d);
  bodyEl.innerHTML = `
    <div class="wx-now">
      <div class="wx-now-icon" title="${esc(cur.text)}">${iconFor(cur.cat, cur.isDay)}</div>
      <div class="wx-now-info">
        <div class="wx-now-temp">${deg(cur.temp)}</div>
        <div class="wx-now-text">${esc(cur.text)}</div>
        <div class="wx-now-feels">Sensação ${deg(cur.feels)}</div>
      </div>
    </div>
    <div class="wx-rain wx-rain--${b.cls}">
      <div class="wx-rain-icon">${b.icon}</div>
      <div><div class="wx-rain-title">${esc(b.title)}</div><div class="wx-rain-sub">${esc(b.sub)}</div></div>
    </div>
    <div class="wx-days-title">Próximos 10 dias</div>
    <div class="wx-days">
      ${d.days.map((x, i) => {
        const l = dayLabel(x.date, i);
        const confTxt = { alta: 'Modelos concordam', moderada: 'Divergência moderada', baixa: 'Modelos divergem', limitada: 'Poucos modelos neste dia' }[x.conf];
        const tip = x.n ? `${x.text} · ${x.n} modelo${x.n > 1 ? 's' : ''}${x.spread != null ? ` · máx. varia ${Math.round(x.spread)}°` : ''}${x.probSource === 'concordância' ? ` · chuva: ${x.wet}/${x.n} modelos` : ''} · ${confTxt}` : x.text;
        return `<div class="wx-day${x.prob >= 40 || x.mm >= 1 ? ' is-wet' : ''}" title="${esc(tip)}">
          <span class="wx-day-name"><span class="wx-dot wx-dot--${x.conf || 'limitada'}"></span>${l.name}<small>${l.date}</small></span>
          <span class="wx-day-icon">${iconFor(x.cat, true)}</span>
          <span class="wx-day-temp"><b>${deg(x.tmax)}</b><i>${deg(x.tmin)}</i></span>
          <span class="wx-day-rain"><em>${Math.round(x.prob)}%</em>${mmTxt(x.mm)}</span>
        </div>`;
      }).join('')}
    </div>`;

  const time = new Date(entry.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const c = baseData.consensus;
  const confidenceLabel = c ? ({ alta: 'Alta', moderada: 'Moderada', baixa: 'Baixa', limitada: 'Limitada' }[c.confidence] || 'Parcial') : '—';
  const confidenceClass = c?.confidence === 'alta' ? 'is-high' : c?.confidence === 'moderada' ? 'is-medium' : 'is-low';
  const modelNames = c ? c.models.map(m => `${m.ok ? '✓' : '×'} ${m.label}`).join(' · ') : 'Open-Meteo';
  const modelButtons = c ? `<div class="wx-model-picker" aria-label="Selecionar previsão meteorológica">
    <button type="button" class="wx-model-choice${!selected ? ' is-active' : ''}" data-model="consensus">Consenso</button>
    ${(baseData.modelForecasts || []).map(m => `<button type="button" class="wx-model-choice${selected?.id === m.id ? ' is-active' : ''}" data-model="${esc(m.id)}">${esc(m.label)}</button>`).join('')}
  </div>` : '';
  const remaining = selected ? Math.max(0, Math.ceil((modelViewUntil - Date.now()) / 1000)) : 0;
  const viewLabel = selected ? `Exibindo ${esc(selected.label)} · volta ao consenso em ${remaining}s` : `Clima Consenso ${confidenceLabel}`;
  footerEl.innerHTML = `${c ? `<div class="wx-consensus ${confidenceClass}"><span>${viewLabel}</span><b>${selected ? 'Individual' : `${c.count}/${c.total} modelos`}</b></div>${modelButtons}<div class="wx-models" title="${esc(modelNames)}">${esc(modelNames)}</div>` : ''}<div>${loading ? 'Atualizando…' : `Atualizado às ${time}`} · ${c ? 'Open-Meteo · ECMWF / GFS / ICON' : 'Fonte: Open-Meteo'}</div>${d.note ? `<div class="wx-note">${esc(d.note)}</div>` : ''}`;
}

// ---------- eventos ----------
tabsEl.addEventListener('click', e => {
  const x = e.target.closest('.wx-tab-x');
  if (x) {                                   // remover cidade
    e.stopPropagation();
    const i = Number(x.dataset.x);
    cities.splice(i, 1);
    if (active >= cities.length) active = cities.length - 1;
    else if (i < active) active--;
    selectedModel = null; modelViewUntil = 0;
    saveCities(); loadCity(cities[active]); return;
  }
  const tab = e.target.closest('.wx-tab');
  if (tab) { active = Number(tab.dataset.i); selectedModel = null; modelViewUntil = 0; saveCities(); errorMsg = null; loadCity(cities[active]); }
});

bodyEl.addEventListener('click', e => { if (e.target.id === 'wx-retry') loadCity(cities[active], true); });
footerEl.addEventListener('click', e => {
  const button = e.target.closest('[data-model]');
  if (!button) return;
  const id = button.dataset.model;
  if (id === 'consensus') { selectedModel = null; modelViewUntil = 0; }
  else { selectedModel = id; modelViewUntil = Date.now() + MODEL_VIEW_MS; }
  render();
});
$('weather-refresh').addEventListener('click', () => loadCity(cities[active], true));

$('weather-add-city').addEventListener('click', () => {
  searchBox.hidden = !searchBox.hidden;
  if (!searchBox.hidden) searchInput.focus(); else { searchInput.value = ''; searchResults.innerHTML = ''; }
});

let searchTimer, searchSeq = 0;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = searchInput.value.trim();
  if (q.length < 2) { searchResults.innerHTML = ''; return; }
  searchTimer = setTimeout(async () => {
    const seq = ++searchSeq;
    searchResults.innerHTML = '<div class="wx-msg">Buscando…</div>';
    try {
      const res = await apiSearch(q);
      if (seq !== searchSeq) return;
      window.__wxResults = res;
      searchResults.innerHTML = res.length
        ? res.map((r, i) => `<button class="wx-result" data-i="${i}"><b>${esc(r.name)}</b><small>${esc(r.sub || '')}</small></button>`).join('')
        : '<div class="wx-msg">Nenhuma cidade encontrada.</div>';
    } catch (e) { if (seq === searchSeq) searchResults.innerHTML = '<div class="wx-msg wx-msg--err">Erro na busca.</div>'; }
  }, 350);
});
searchInput.addEventListener('keydown', e => { if (e.key === 'Escape') $('weather-add-city').click(); });

searchResults.addEventListener('click', e => {
  const btn = e.target.closest('.wx-result');
  if (!btn) return;
  const r = (window.__wxResults || [])[Number(btn.dataset.i)];
  if (!r) return;
  const idx = cities.findIndex(c => Math.abs(c.lat - r.lat) < 0.02 && Math.abs(c.lon - r.lon) < 0.02);
  if (idx >= 0) active = idx; else { cities.push({ name: r.name, sub: r.sub, lat: r.lat, lon: r.lon }); active = cities.length - 1; }
  selectedModel = null; modelViewUntil = 0;
  saveCities();
  searchBox.hidden = true; searchInput.value = ''; searchResults.innerHTML = '';
  errorMsg = null; loadCity(cities[active]);
});

// ---------- mostrar / ocultar (igual ao painel da agenda) ----------
// Cada página pode ter sua própria preferência (data-weather-key) e padrão (data-weather-default="visible")
const hiddenKey = document.body.dataset.weatherKey || 'weatherHidden';
const defaultHidden = document.body.dataset.weatherDefault === 'visible' ? window.innerWidth < 1100 : window.innerWidth < 1400;
const applyHidden = hidden => document.body.classList.toggle('weather-is-hidden', hidden);
$('hide-weather-button').addEventListener('click', () => { applyHidden(true); localStorage.setItem(hiddenKey, 'true'); });
$('show-weather-button').addEventListener('click', () => { applyHidden(false); localStorage.setItem(hiddenKey, 'false'); });
const storedHidden = localStorage.getItem(hiddenKey);
applyHidden(storedHidden === null ? defaultHidden : storedHidden === 'true');

// Mantém o painel acima da agenda semanal (que fica fixa embaixo)
const sched = $('weekly-schedule-panel');
const syncOffset = () => {
  const hidden = document.body.classList.contains('schedule-is-hidden');
  document.documentElement.style.setProperty('--schedule-h', hidden ? '0px' : `${sched.offsetHeight}px`);
};
if (sched) {
  new ResizeObserver(syncOffset).observe(sched);
  new MutationObserver(syncOffset).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  syncOffset();
}

// ---------- atualização automática ----------
setInterval(() => loadCity(cities[active], true), REFRESH_MS);   // a cada 30 min
setInterval(() => {
  if (selectedModel && Date.now() >= modelViewUntil) { selectedModel = null; modelViewUntil = 0; }
  render();
}, 1000); // atualiza contador de 25 s e recalcula a previsão de chuva
document.addEventListener('visibilitychange', () => {            // abas em segundo plano atrasam timers
  if (document.visibilityState !== 'visible') return;
  const c = cache.get(keyOf(cities[active]));
  if (!c || Date.now() - c.at >= REFRESH_MS) loadCity(cities[active], true); else render();
});

render();
loadCity(cities[active], true);
