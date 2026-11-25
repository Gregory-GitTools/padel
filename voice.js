// Озвучка через встроенный синтез речи браузера (на телефоне работает без интернета)
const Voice = (() => {
  const synth = window.speechSynthesis;
  let ru = null, queue = [], onEnd = null;
  const KEY = 'padel-voice';
  const st = Object.assign({ on: true, rate: 1.05 }, JSON.parse(localStorage.getItem(KEY) || '{}'));
  function pick() {
    const vs = synth ? synth.getVoices() : [];
    ru = vs.find(v => /^ru/i.test(v.lang) && /google|milena|yandex|natural/i.test(v.name)) || vs.find(v => /^ru/i.test(v.lang)) || null;
  }
  if (synth) { pick(); synth.onvoiceschanged = pick; }
  function say(text, opts = {}) {
    if (!synth || (!st.on && !opts.force)) return;
    if (!opts.queue) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU'; if (ru) u.voice = ru; u.rate = st.rate;
    if (opts.onend) u.onend = opts.onend;
    synth.speak(u);
  }
  return {
    say,
    stop: () => synth && synth.cancel(),
    get on() { return st.on; },
    set on(v) { st.on = v; localStorage.setItem(KEY, JSON.stringify(st)); if (!v) synth && synth.cancel(); },
    get rate() { return st.rate; },
    set rate(v) { st.rate = v; localStorage.setItem(KEY, JSON.stringify(st)); },
    supported: !!synth,
  };
})();
