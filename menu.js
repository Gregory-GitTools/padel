// Меню-барабан, как в Atlas (core/layers-panel.js → rotor): кнопка ☰ справа вверху открывает барабан разделов.
// Кнопки по дуге, как в игровом автомате: в центре крупно, к краям темнее и прозрачнее, по кругу.
// Крутится пальцем по всему экрану или колёсиком мыши; встаёт ближайшей кнопкой в центр.
// Нажал кнопку — она докручивается в центр и открывает раздел. Подписи с номером видны 2 с после открытия
// и после каждой прокрутки, потом гаснут — не наезжают друг на друга у краёв.
(() => {
  const NAV = [
    ['index.html', '🏠', 'Главная'], ['rules.html', '📜', 'Правила'], ['score.html', '🎾', 'Счёт'],
    ['ref.html', '📚', 'Справка'], ['academy.html', '🎓', 'Академия'], ['training.html', '🏃', 'Тренинг'],
    ['tournament.html', '🏆', 'Турнир'], ['comic.html', '💬', 'Комикс'],
  ];
  const BTN = 64, GAP = 78, DETENT = 0.7, LABEL_MS = 2000;
  const here = location.pathname.split('/').pop() || 'index.html';
  const cur = Math.max(0, NAV.findIndex(([h]) => h === here));

  const toggle = document.createElement('button');
  toggle.className = 'dtoggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Меню');
  toggle.innerHTML = '<span>☰</span>';
  // затемнение на весь экран: ловит палец и колёсико, нажатие мимо кнопок — закрыть
  const shade = document.createElement('div');
  shade.className = 'dshade';
  shade.hidden = true;
  const box = document.createElement('div');
  box.className = 'drum closed';
  shade.append(box);
  document.body.append(shade, toggle);

  const cells = NAV.map(([href, icon, name], i) => {
    const cell = document.createElement('div');
    cell.className = 'dcell';
    cell.innerHTML = `<a class="dbtn${i === cur ? ' on' : ''}" href="${href}" aria-label="${name}">${icon}</a>` +
      `<span class="dlabel" data-num="${i + 1}">${name}</span>`;
    return cell;
  });
  box.append(...cells);

  // --- барабан: та же математика, что в Atlas ---
  let raw = 0, target = 0, frame = 0, onArrive = null;
  const n = cells.length;
  const geom = () => {
    const full = box.clientHeight / 2 - BTN / 2 - 4;
    const half = Math.max(1, Math.min(n / 2 + 0.5, Math.PI / 2 / Math.asin(Math.min(1, GAP / full))));
    const step = Math.PI / 2 / half;
    return { step, radius: Math.min(full, GAP / Math.sin(step)) };
  };
  const shownAt = (v) => v - (DETENT * Math.sin(2 * Math.PI * v)) / (2 * Math.PI);
  const wrap = (d) => ((d % n) + n + n / 2) % n - n / 2;
  const centerIndex = () => ((Math.round(raw) % n) + n) % n;
  // высота, в которую встают все кнопки без повторов
  const need = () => { const step = Math.PI / 2 / (n / 2 + 0.5); return 2 * Math.min(GAP / Math.sin(step), 400) + BTN + 8; };

  // подписи: показать и погасить через 2 с покоя
  let quietTimer = 0;
  const wake = () => {
    box.classList.remove('quiet');
    clearTimeout(quietTimer);
    quietTimer = setTimeout(() => box.classList.add('quiet'), LABEL_MS);
  };

  function layout() {
    if (shade.hidden) return;
    wake();
    const cy = box.clientHeight / 2, { radius, step } = geom();
    const off = shownAt(raw);
    cells.forEach((cell, i) => {
      const a = wrap(i - off) * step;
      if (Math.abs(a) >= Math.PI / 2) { cell.hidden = true; return; }
      const k = Math.cos(a);
      cell.hidden = false;
      cell.style.transform = `translateY(${cy + radius * Math.sin(a) - BTN / 2}px)`;
      cell.style.filter = `brightness(${0.55 + 0.45 * k})`;
      cell.style.opacity = String(Math.min(1, 0.25 + k));
      cell.style.zIndex = String(Math.round(k * 100));
    });
  }

  const animate = () => {
    cancelAnimationFrame(frame);
    const tick = () => {
      const d = target - raw;
      if (Math.abs(d) < 0.002) {
        raw = target;
        layout();
        const done = onArrive; onArrive = null;
        if (done) done();
        return;
      }
      raw += d * 0.18;
      layout();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  };
  const spinTo = (i, then) => {
    target = Math.round(raw) + wrap(i - Math.round(raw));
    onArrive = then;
    animate();
  };

  let snapTimer = 0;
  shade.addEventListener('wheel', (e) => {
    e.preventDefault();
    target += e.deltaY / (e.deltaMode === 1 ? 3 : 100);
    onArrive = null;
    animate();
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => { target = Math.round(target); animate(); }, 160);
  }, { passive: false });

  let drag = null, suppressClick = false;
  shade.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    suppressClick = false;
    drag = { y: e.clientY, raw, t: performance.now(), v: 0, moved: false, id: e.pointerId };
  });
  shade.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y;
    if (!drag.moved) {
      if (Math.abs(dy) < 6) return;
      drag.moved = true;
      shade.setPointerCapture(e.pointerId);
      onArrive = null;
      cancelAnimationFrame(frame);
    }
    const { radius, step: a } = geom(), step = radius * a;
    const now = performance.now(), next = drag.raw - dy / step;
    drag.v = (next - raw) / Math.max(1, now - drag.t);
    drag.t = now;
    raw = target = next;
    layout();
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.moved) {
      suppressClick = true;
      target = Math.round(raw + Math.max(-3, Math.min(3, drag.v * 250)));
      animate();
    }
    drag = null;
  };
  shade.addEventListener('pointerup', endDrag);
  shade.addEventListener('pointercancel', endDrag);

  // щелчок: после прокрутки — ничего; по кнопке — докрутить и открыть; мимо кнопок — закрыть
  shade.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; e.preventDefault(); return; }
    const a = e.target.closest('.dbtn');
    if (!a) { close(); return; }
    e.preventDefault();
    const i = cells.indexOf(a.parentElement), go = () => { if (i === cur) close(); else location.href = a.href; };
    if (i === centerIndex() && Math.abs(raw - Math.round(raw)) < 0.01) go(); else spinTo(i, go);
  });

  // --- открыть / закрыть ---
  function open() {
    const t = toggle.getBoundingClientRect();
    shade.hidden = false;
    const top = t.bottom + 10, room = innerHeight - top - 12;
    box.style.top = top + 'px';
    box.style.height = Math.min(room, need()) + 'px';
    cancelAnimationFrame(frame);
    raw = target = cur;
    layout();
    toggle.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('drum-open');
    requestAnimationFrame(() => { shade.classList.add('show'); box.classList.remove('closed'); });
  }
  function close() {
    if (shade.hidden) return;
    toggle.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('drum-open');
    shade.classList.remove('show');
    box.classList.add('closed');
    setTimeout(() => { if (box.classList.contains('closed')) shade.hidden = true; }, 250);
  }
  toggle.addEventListener('click', () => (shade.hidden || box.classList.contains('closed') ? open() : close()));
  addEventListener('keydown', (e) => {
    if (shade.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); spinTo(centerIndex() + (e.key === 'ArrowDown' ? 1 : -1)); }
    else if (e.key === 'Enter') cells[centerIndex()].querySelector('.dbtn').click();
  });
  addEventListener('resize', () => { if (!shade.hidden) open(); });
  // вернулись кнопкой «Назад» — меню закрыто
  addEventListener('pageshow', () => { shade.hidden = true; shade.classList.remove('show'); box.classList.add('closed'); toggle.classList.remove('open'); document.documentElement.classList.remove('drum-open'); });

  window.Drum = { open, close, spinTo, centerIndex, cells, cur, LABEL_MS };
})();
