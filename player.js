// Свой плеер: ссылка на ролик YouTube открывается тут же, поверх страницы, с крупными кнопками —
// назад/вперёд на 10 с, медленнее (для разбора техники), «Повтор» — крутить последние 8 с.
// Сам ролик хранить нельзя (правила YouTube), поэтому в телефоне храним другое: что смотрел и где остановился —
// 30 дней (localStorage 'padel-video'). Без интернета-API — обычное встроенное видео.
(() => {
  const KEY = 'padel-video', DAYS = 30, LOOP = 8;
  const load = () => {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
    const old = Date.now() - DAYS * 864e5;
    for (const id in s) if (!(s[id].at > old)) delete s[id];
    return s;
  };
  const store = (id, v) => {
    const s = load();
    s[id] = { ...s[id], ...v, at: Date.now() };
    const ids = Object.keys(s).sort((a, b) => s[b].at - s[a].at);
    ids.slice(30).forEach(k => delete s[k]);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  };
  const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  // id и секунда из ссылки: youtu.be/ID?t=13, youtube.com/watch?v=ID&t=13s, /shorts/ID
  const parse = href => {
    let u; try { u = new URL(href, location.href); } catch (e) { return null; }
    let id = null;
    if (u.hostname === 'youtu.be') id = u.pathname.slice(1);
    else if (/(^|\.)youtube\.com$/.test(u.hostname)) id = u.searchParams.get('v') || (u.pathname.match(/^\/(shorts|embed)\/([\w-]{11})/) || [])[2];
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    return { id, t: parseInt(u.searchParams.get('t') || u.searchParams.get('start') || '0', 10) || 0 };
  };

  const box = document.createElement('div');
  box.className = 'vp';
  box.hidden = true;
  box.innerHTML = `<div class="vp-in">
    <div class="vp-head"><b class="vp-title"></b><button class="vp-x" aria-label="Закрыть">✕</button></div>
    <div class="vp-frame"><div class="vp-host"></div></div>
    <div class="vp-ctl">
      <button data-v="back" aria-label="Назад 10 секунд">↺<small>10</small></button>
      <button data-v="play" class="vp-play" aria-label="Пауза">⏸</button>
      <button data-v="fwd" aria-label="Вперёд 10 секунд">↻<small>10</small></button>
      <button data-v="rate" aria-label="Скорость">1×</button>
      <button data-v="loop" aria-label="Повтор">🔁<small>Повтор</small></button>
    </div>
    <p class="vp-note"></p>
    <a class="vp-yt" target="_blank" rel="noopener">↗ Открыть на YouTube</a>
  </div>`;
  const $ = s => box.querySelector(s);
  const add = () => document.body.append(box);
  document.body ? add() : addEventListener('DOMContentLoaded', add);

  // API YouTube — один раз, по первому ролику
  let api = null;
  const ytApi = () => api || (api = new Promise((ok, no) => {
    if (window.YT && YT.Player) return ok();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev && prev(); ok(); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = no;
    document.head.append(s);
    setTimeout(no, 6000);
  }));

  let yt = null, cur = null, tick = 0, loopA = null, rate = 1, pushed = false;
  const RATES = [1, 0.75, 0.5];
  const note = t => { $('.vp-note').textContent = t; };

  function open(id, t = 0, title = '') {
    if (typeof Voice !== 'undefined' && Voice.stop) Voice.stop();
    const saved = load()[id];
    title = title || saved?.title || (typeof VID !== 'undefined' && VID[id]) || 'Видео';
    // без отметки времени — с того места, где остановился
    let from = t;
    if (!t && saved?.t > 5 && !(saved.dur && saved.t > saved.dur - 10)) from = Math.floor(saved.t);
    cur = { id, title };
    store(id, { title, t: from });
    $('.vp-title').textContent = title;
    $('.vp-yt').href = `https://youtu.be/${id}${from ? '?t=' + from : ''}`;
    note(from && from !== t ? `Продолжаем с ${mmss(from)}` : from ? `С ${mmss(from)}` : '');
    loopA = null; rate = 1; paint();
    box.hidden = false;
    document.documentElement.classList.add('vp-open');
    if (!pushed) { history.pushState({ vp: 1 }, ''); pushed = true; }
    const host = document.createElement('div');
    $('.vp-host').replaceChildren(host);
    box.classList.add('basic');
    ytApi().then(() => {
      if (!cur || cur.id !== id) return;
      yt = new YT.Player(host, {
        host: 'https://www.youtube-nocookie.com', videoId: id, width: '100%', height: '100%',
        playerVars: { start: from, autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
        events: { onReady: () => { box.classList.remove('basic'); paint(); }, onStateChange: paint },
      });
    }).catch(() => {
      // API не загрузился — простое встроенное видео, без своих кнопок
      if (!cur || cur.id !== id) return;
      host.outerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?start=${from}&autoplay=1&playsinline=1&rel=0" allow="autoplay; fullscreen; encrypted-media" allowfullscreen></iframe>`;
    });
    clearInterval(tick);
    tick = setInterval(() => {
      if (!yt || !yt.getCurrentTime) return;
      const now = yt.getCurrentTime(), dur = yt.getDuration && yt.getDuration();
      if (loopA !== null && now >= loopA + LOOP) yt.seekTo(loopA, true);
      if (now > 0) store(id, { t: Math.floor(now), dur: dur || undefined });
    }, 500);
  }

  function close(fromHistory) {
    if (box.hidden) return;
    clearInterval(tick);
    if (yt && yt.getCurrentTime && cur) { try { store(cur.id, { t: Math.floor(yt.getCurrentTime()) }); } catch (e) {} }
    try { yt && yt.destroy && yt.destroy(); } catch (e) {}
    yt = null; cur = null;
    $('.vp-host').replaceChildren();
    box.hidden = true;
    document.documentElement.classList.remove('vp-open');
    if (pushed) { pushed = false; if (!fromHistory) history.back(); }
    dispatchEvent(new Event('padel-video'));
  }

  function paint() {
    const playing = yt && yt.getPlayerState && yt.getPlayerState() === 1;
    const p = $('.vp-play');
    p.textContent = playing ? '⏸' : '▶';
    p.setAttribute('aria-label', playing ? 'Пауза' : 'Играть');
    $('[data-v="rate"]').textContent = String(rate).replace('0.', ',') + '×';
    $('[data-v="loop"]').classList.toggle('on', loopA !== null);
  }

  box.addEventListener('click', e => {
    if (e.target === box || e.target.closest('.vp-x')) return close();
    const b = e.target.closest('[data-v]');
    if (!b || !yt || !yt.getCurrentTime) return;
    const now = yt.getCurrentTime();
    switch (b.dataset.v) {
      case 'play': yt.getPlayerState() === 1 ? yt.pauseVideo() : yt.playVideo(); break;
      case 'back': yt.seekTo(Math.max(0, now - 10), true); break;
      case 'fwd': yt.seekTo(now + 10, true); break;
      case 'rate': rate = RATES[(RATES.indexOf(rate) + 1) % RATES.length]; yt.setPlaybackRate(rate);
        note(rate === 1 ? 'Обычная скорость' : `Медленнее: ${String(rate).replace('0.', ',')}×`); break;
      case 'loop':
        if (loopA === null) { loopA = Math.max(0, now - LOOP); yt.seekTo(loopA, true); yt.playVideo(); note(`Повтор: ${mmss(loopA)}–${mmss(loopA + LOOP)}`); }
        else { loopA = null; note('Повтор выключен'); }
        break;
    }
    setTimeout(paint, 150);
  });
  addEventListener('keydown', e => { if (!box.hidden && e.key === 'Escape') close(); });
  // кнопка «Назад» на телефоне закрывает плеер, а не страницу
  addEventListener('popstate', () => { if (!box.hidden) close(true); });

  // любые ссылки на ролики — в свой плеер
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || a.closest('.vp')) return;
    const v = parse(a.href);
    if (!v) return;
    e.preventDefault();
    const text = a.textContent.replace(/^[▶\s]+/, '').replace(/\s·\s\d+:\d\d$/, '').trim();
    open(v.id, v.t, a.dataset.title || text);
  });

  // недавние: [{id, title, t, dur, at}], свежие первыми
  const recent = () => { const s = load(); return Object.entries(s).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.at - a.at); };
  window.Player = { open, close, recent, parse, mmss, get current() { return cur; } };
})();
