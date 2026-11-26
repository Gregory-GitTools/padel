// Читалка карточек: ‹ Назад · ▶ Слушать / ■ Стоп · Вперёд ›.
// Слушать — читает подряд с текущей карточки; стрелки листают и во время чтения, и без него.
// стрелки — SVG: символы ‹ › в шрифте слишком мелкие
const CHEV = d => `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d < 0 ? 'M15 4l-8 8 8 8' : 'M9 4l8 8-8 8'}"/></svg>`;
// opts: bar — куда вставить кнопки, ids() — видимые карточки, text(id) — что читать, el(id) — DOM-карточка.
function Reader(opts) {
  let pos = 0, on = false, single = null, run = 0;
  opts.bar.innerHTML = `<button id="rdPrev" aria-label="Назад">${CHEV(-1)}</button>
    <button class="primary grow" id="rdPlay">▶ Слушать</button>
    <button id="rdNext" aria-label="Вперёд">${CHEV(1)}</button>
    <button id="rdRate" aria-label="Скорость">1×</button>`;
  const $ = id => document.getElementById(id);
  const list = () => opts.ids();

  function mark(id, scroll) {
    document.querySelectorAll('.card.playing').forEach(x => x.classList.remove('playing'));
    document.querySelectorAll('.spk.on').forEach(x => { x.classList.remove('on'); x.textContent = '🔊'; });
    const el = id != null && opts.el(id);
    if (!el) return;
    el.classList.add('playing', 'open');
    if (scroll) el.scrollIntoView({ behavior:'smooth', block:'center' });
  }
  function ui() {
    $('rdPlay').textContent = on ? '■ Стоп' : '▶ Слушать';
    $('rdPlay').classList.toggle('on', on);
    $('rdRate').textContent = (Voice.rate === 1.05 ? 1 : Voice.rate) + '×';
  }
  function speak() {
    const l = list(), id = l[pos], my = ++run;
    mark(id, true);
    Voice.say(opts.text(id), { force:true, onend: () => {
      if (my !== run || !on) return;
      if (pos + 1 >= l.length) { pos = 0; return stop(); }   // дочитал — следующий раз с начала
      setTimeout(() => { if (my === run && on) { pos++; speak(); } }, 600);
    } });
  }
  function play() { if (!list().length) return; on = true; single = null; pos = Math.min(pos, list().length - 1); ui(); speak(); }
  function stop() { on = false; run++; Voice.stop(); single = null; ui(); mark(null); }
  function go(d) {
    const l = list(); if (!l.length) return;
    pos = Math.max(0, Math.min(l.length - 1, pos + d));
    if (on) speak(); else { mark(l[pos], true); }
  }
  // одна карточка: 🔊 на ней — читает её; повторное нажатие — стоп
  function toggle(id, btn) {
    if (single === id || (on && list()[pos] === id)) return stop();
    stop();
    const i = list().indexOf(id); if (i >= 0) pos = i;
    single = id; const my = ++run;
    mark(id, false);
    if (btn) { btn.classList.add('on'); btn.textContent = '■'; }
    Voice.say(opts.text(id), { force:true, onend: () => { if (my === run) { single = null; mark(null); } } });
  }

  $('rdPlay').onclick = () => on ? stop() : play();
  $('rdPrev').onclick = () => go(-1);
  $('rdNext').onclick = () => go(1);
  $('rdRate').onclick = () => { const r = [1.05, 1.3, 0.9]; Voice.rate = r[(r.indexOf(Voice.rate) + 1) % r.length]; ui(); };
  if (!Voice.supported) $('rdPlay').disabled = true;
  ui();
  return { stop, toggle, reset: () => { stop(); pos = 0; }, get pos() { return pos; }, get on() { return on; } };
}
