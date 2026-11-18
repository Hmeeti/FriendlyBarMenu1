/* Friendly — новогодняя тема: гирлянда, снег, поздравление, отсчёт, переключатель.
   Отключить: убрать <script src="js/newyear.js"> из index.html (и css/newyear.css). */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var KEY = 'ny_fx';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var T = {
    ru: { greet: 'С Новым годом!', left: 'До Нового года:', d: 'дн.', on: 'Выключить снег и эффекты', off: 'Включить снег и эффекты' },
    kk: { greet: 'Жаңа жылыңызбен!', left: 'Жаңа жылға дейін:', d: 'күн', on: 'Қар мен эффектілерді өшіру', off: 'Қар мен эффектілерді қосу' },
    en: { greet: 'Happy New Year!', left: 'Until New Year:', d: 'd', on: 'Turn snow & effects off', off: 'Turn snow & effects on' }
  };
  function tr() { return T[root.getAttribute('data-lang')] || T.ru; }

  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function store(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  // Эффекты: по умолчанию включены, кроме prefers-reduced-motion (если пользователь не включил сам)
  var fx = stored() ? stored() === 'on' : !reduce;

  /* ---------- гирлянда ---------- */
  var garland = doc.createElement('div');
  garland.className = 'ny-garland';
  garland.setAttribute('aria-hidden', 'true');
  var gTile = 0;
  function buildGarland() {
    var tile = window.innerWidth < 360 ? 38 : 44;
    if (tile === gTile && garland.childNodes.length) return;
    gTile = tile;
    garland.classList.toggle('ny-garland--tight', tile === 38);
    garland.textContent = '';
    var n = Math.ceil(window.innerWidth / tile) + 1;
    var frag = doc.createDocumentFragment();
    for (var i = 0; i < n; i++) {
      var b = doc.createElement('span');
      b.className = 'ny-bulb';
      b.style.left = (i * tile + tile / 2) + 'px';
      b.style.setProperty('--d', '-' + ((i * 0.37) % 2.4).toFixed(2) + 's');
      frag.appendChild(b);
    }
    garland.appendChild(frag);
  }

  /* ---------- снег ---------- */
  var canvas = doc.createElement('canvas');
  canvas.className = 'ny-snow';
  canvas.setAttribute('aria-hidden', 'true');
  var ctx = canvas.getContext('2d');
  var flakes = [], W = 0, H = 0, dpr = 1, raf = 0, last = 0, t = 0;

  function makeFlake(randomY) {
    var r = 0.8 + Math.random() * 2.4;
    return {
      x: Math.random() * W,
      y: randomY ? Math.random() * H : -10,
      r: r,
      v: 18 + r * 12 + Math.random() * 10,      // крупнее — быстрее (глубина)
      a: 0.35 + (r / 3.2) * 0.5,                // крупнее — ярче
      ph: Math.random() * 6.28,
      sw: 8 + Math.random() * 22,               // амплитуда покачивания
      f: 0.4 + Math.random() * 0.9,
      bx: 0
    };
  }
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var want = W < 768 ? 35 : W < 1200 ? 70 : 110;   // на мобильных меньше
    while (flakes.length < want) { var f = makeFlake(true); f.bx = f.x; flakes.push(f); }
    flakes.length = want;
    buildGarland();
  }
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    var dt = last ? Math.min((ts - last) / 1000, 0.05) : 0.016;
    last = ts; t += dt;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    for (var i = 0; i < flakes.length; i++) {
      var s = flakes[i];
      s.y += s.v * dt;
      if (s.y > H + 10) { var n = makeFlake(false); n.bx = n.x; flakes[i] = s = n; }
      var x = s.bx + Math.sin(t * s.f + s.ph) * s.sw;
      ctx.globalAlpha = s.a;
      ctx.beginPath();
      ctx.arc(x, s.y, s.r, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function startSnow() { if (!raf && fx) { last = 0; raf = requestAnimationFrame(frame); } }
  function stopSnow() { if (raf) { cancelAnimationFrame(raf); raf = 0; } ctx.clearRect(0, 0, W, H); }

  /* ---------- футер: поздравление, отсчёт, сугроб ---------- */
  var greet = doc.createElement('div');
  greet.className = 'ny-greet';
  greet.innerHTML = '<div class="ny-greet__title"></div><div class="ny-greet__timer" aria-hidden="true"></div>';
  var gTitle = greet.firstChild, gTimer = greet.lastChild;
  var drift = doc.createElement('div');
  drift.className = 'ny-drift';
  drift.setAttribute('aria-hidden', 'true');

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function tick() {
    var L = tr(), now = new Date();
    gTitle.textContent = L.greet;
    if (now.getMonth() === 0) { gTimer.hidden = true; return; } // в январе — только поздравление
    var diff = new Date(now.getFullYear() + 1, 0, 1) - now;
    var s = Math.floor(diff / 1000);
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    gTimer.hidden = false;
    gTimer.textContent = L.left + ' ' + d + ' ' + L.d + ' ' + pad(h) + ':' + pad(m) + ':' + pad(s);
  }

  /* ---------- переключатель ---------- */
  var btn = doc.createElement('button');
  btn.type = 'button';
  btn.className = 'ny-toggle';
  btn.textContent = '❄';
  function applyFx() {
    root.classList.toggle('ny-fx-off', !fx);
    btn.setAttribute('aria-pressed', fx ? 'true' : 'false');
    var L = tr(); btn.setAttribute('aria-label', fx ? L.on : L.off); btn.title = fx ? L.on : L.off;
    fx ? startSnow() : stopSnow();
  }
  btn.addEventListener('click', function () { fx = !fx; store(fx ? 'on' : 'off'); applyFx(); });

  /* ---------- запуск ---------- */
  function init() {
    var hdr = doc.getElementById('hdr');
    if (hdr) hdr.insertBefore(garland, hdr.firstChild);
    var foot = doc.getElementById('foot');
    if (foot) { foot.insertBefore(greet, foot.firstChild); foot.parentNode.insertBefore(drift, foot.nextSibling); }
    doc.body.appendChild(canvas);
    doc.body.appendChild(btn);
    var tc = doc.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute('content', '#0a1330');

    resize(); tick(); applyFx();
    setInterval(function () { if (!doc.hidden) { tick(); var L = tr(); btn.title = fx ? L.on : L.off; btn.setAttribute('aria-label', btn.title); } }, 1000);

    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 150); });
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) stopSnow(); else if (fx) startSnow(); });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
