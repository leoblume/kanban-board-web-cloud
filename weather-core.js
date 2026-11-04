// weather-core.js — lógica de clima (Open-Meteo: gratuito, sem chave, chamado direto do navegador)
//
// Formato normalizado devolvido por getWeather():
// {
//   provider: 'open-meteo', note: null, updatedAt: ms,
//   current: { temp, feels, cat, text, isDay },
//   nowcast: { stepMin, steps: [{ t: ms (início do passo), mm, prob|null }] },
//   days:    [{ date: 'YYYY-MM-DD', cat, text, tmax, tmin, prob, mm }]   // 10 dias
// }

const pad = n => String(n).padStart(2, '0');

// Categorias de condição do tempo. "sev" = gravidade (usada para escolher o símbolo do dia).
export const CAT = {
  clear:         { icon: '☀️',  night: '🌙', label: 'Céu limpo',             sev: 0 },
  mostly_clear:  { icon: '🌤️', night: '🌙', label: 'Predomínio de sol',     sev: 1 },
  partly:        { icon: '⛅',  night: '☁️', label: 'Parcialmente nublado',  sev: 2 },
  mostly_cloudy: { icon: '🌥️', night: '☁️', label: 'Muito nublado',         sev: 3 },
  cloudy:        { icon: '☁️',  night: '☁️', label: 'Nublado',               sev: 4 },
  fog:           { icon: '🌫️', night: '🌫️', label: 'Neblina',               sev: 5 },
  wind:          { icon: '💨',  night: '💨', label: 'Ventania',              sev: 5 },
  drizzle:       { icon: '🌦️', night: '🌧️', label: 'Chuva fraca',           sev: 6 },
  showers:       { icon: '🌦️', night: '🌧️', label: 'Pancadas de chuva',     sev: 7 },
  rain:          { icon: '🌧️', night: '🌧️', label: 'Chuva',                 sev: 8 },
  heavy_rain:    { icon: '🌧️', night: '🌧️', label: 'Chuva forte',           sev: 9 },
  snow:          { icon: '🌨️', night: '🌨️', label: 'Neve / granizo',        sev: 9 },
  storm:         { icon: '⛈️', night: '⛈️', label: 'Tempestade',            sev: 10 },
};

export function iconFor(cat, isDay = true) {
  const c = CAT[cat] || CAT.cloudy;
  return isDay ? c.icon : c.night;
}

async function getJson(url, label) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${label} HTTP ${r.status}`);
  return r.json();
}

// ---------- Open-Meteo ----------
function catFromWmo(code) {
  if (code === 0) return 'clear';
  if (code === 1) return 'mostly_clear';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ([51, 53, 55, 56, 57, 61].includes(code)) return 'drizzle';
  if ([63, 66, 67].includes(code)) return 'rain';
  if (code === 65 || code === 82) return 'heavy_rain';
  if (code === 80 || code === 81) return 'showers';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';
  return 'cloudy';
}

async function openMeteoWeather(lat, lon) {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${lat}&longitude=${lon}`
    + '&current=temperature_2m,apparent_temperature,weather_code,is_day'
    + '&minutely_15=precipitation'
    + '&hourly=precipitation,precipitation_probability'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max'
    + '&forecast_days=10&timezone=auto';
  const j = await getJson(url, 'Open-Meteo');
  const off = (j.utc_offset_seconds || 0) * 1000;
  const toMs = s => Date.parse(s + 'Z') - off;   // horário local (sem fuso) -> epoch

  // Probabilidade por hora (o valor da hora H vale para o intervalo (H-1h, H])
  const probByHour = new Map();
  if (j.hourly && j.hourly.time) {
    j.hourly.time.forEach((s, i) => probByHour.set(toMs(s), j.hourly.precipitation_probability ? j.hourly.precipitation_probability[i] : null));
  }

  let steps = [], stepMin = 15;
  if (j.minutely_15 && j.minutely_15.time && j.minutely_15.precipitation) {
    // precipitação em minutely_15 = soma dos 15 min ANTERIORES ao horário
    steps = j.minutely_15.time.map((s, i) => {
      const end = toMs(s);
      const hourEnd = Math.ceil(end / 3600000) * 3600000;
      return { t: end - 15 * 60000, mm: j.minutely_15.precipitation[i] || 0, prob: probByHour.get(hourEnd) ?? null };
    });
  } else {
    stepMin = 60;
    steps = j.hourly.time.map((s, i) => ({
      t: toMs(s) - 3600000, mm: j.hourly.precipitation[i] || 0,
      prob: j.hourly.precipitation_probability ? (j.hourly.precipitation_probability[i] ?? null) : null,
    }));
  }
  const now = Date.now();
  steps = steps.filter(s => s.t + stepMin * 60000 > now && s.t < now + 24 * 3600000);

  const dd = j.daily;
  const days = dd.time.map((date, i) => {
    const cat = catFromWmo(dd.weather_code[i]);
    return {
      date, cat, text: CAT[cat].label,
      prob: dd.precipitation_probability_max ? (dd.precipitation_probability_max[i] ?? 0) : 0,
      mm: Math.round((dd.precipitation_sum[i] || 0) * 10) / 10,
      tmax: dd.temperature_2m_max[i], tmin: dd.temperature_2m_min[i],
    };
  });
  const cc = catFromWmo(j.current.weather_code);
  return {
    provider: 'open-meteo', note: null, updatedAt: Date.now(),
    current: { temp: j.current.temperature_2m, feels: j.current.apparent_temperature, cat: cc, text: CAT[cc].label, isDay: j.current.is_day !== 0 },
    nowcast: { stepMin, steps },
    days,
  };
}

// ---------- API pública ----------
export async function getWeather({ lat, lon }) {
  return openMeteoWeather(lat, lon);
}

export async function searchCities(q) {
  q = (q || '').trim();
  if (q.length < 2) return [];
  const j = await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=pt&format=json`, 'Open-Meteo geocoding');
  return (j.results || []).map(r => ({
    name: r.admin1 ? `${r.name}, ${r.admin1}` : r.name,
    sub: [r.admin1, r.country].filter(Boolean).join(', '),
    lat: r.latitude, lon: r.longitude,
  }));
}

// Previsão de chuva a partir dos passos (15 min ou 1 h). Recalculada a cada render com a hora atual.
export function rainOutlook(steps, stepMin, now = Date.now()) {
  const ms = stepMin * 60000, limit = now + 24 * 3600000;
  const up = (steps || []).filter(s => s.t + ms > now && s.t < limit).sort((a, b) => a.t - b.t);
  if (!up.length) return { kind: 'unknown' };
  const wet = s => s.mm >= 0.1 && (s.prob == null || s.prob >= 30);
  const i = up.findIndex(wet);
  if (i === -1) return { kind: 'dry' };
  let j = i, mm = 0, prob = 0;
  while (j < up.length && wet(up[j])) { mm += up[j].mm; prob = Math.max(prob, up[j].prob ?? 0); j++; }
  const end = j < up.length ? up[j].t : null;
  const start = up[i].t;
  const mmR = Math.round(mm * 10) / 10, probR = prob || null;
  if (start <= now) return { kind: 'now', untilMin: end == null ? null : Math.max(0, (end - now) / 60000), mm: mmR, prob: probR };
  return { kind: 'soon', inMin: (start - now) / 60000, durMin: end == null ? null : (end - start) / 60000, mm: mmR, prob: probR };
}
