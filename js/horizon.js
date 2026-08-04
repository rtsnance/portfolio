// ============================================================
// HORIZON — the band is the theme now. There is no picker.
//
// The light is continuous, not four states. Between the four named
// anchors every semantic token is linearly interpolated in RGB and
// written to :root. At 10:15 the visitor is in a light that is
// neither sunrise nor day and has no name.
//
// The head bootstrap on every page runs the same interpolation
// before first paint. If you change ANCHORS, PALETTES or TOKENS
// here, change them there too and recompute the sha256 in _headers.
// ============================================================
(function () {
  'use strict';

  // -------- tunables, kept named and adjacent on purpose --------
  var MAGNET_RANGE = 0.9;      // hours; how far an anchor's pull reaches
  var MAGNET_STRENGTH = 0.55;  // 0-1; how hard it pulls at the anchor
  var DRIFT_MS = 90000;        // release to true local time
  var CREEP_MS = 30000;        // idle resync interval
  var KEY_RESUME_MS = 1200;    // quiet time after a keypress before drift
  var KEY_STEP = 0.25;         // hours per arrow
  var KEY_STEP_BIG = 1;        // hours per shift-arrow
  var FLIP_AT = 0.78;          // fraction across where the word flips side
  var WORD_GAP = 8;            // px between marker and word; matches --space-2

  // -------- the four lights, verbatim from desert-ds.css --------
  // Order matches TOKENS below.
  var PALETTES = {
    night:   ['#14162E', '#F2F0FA', '#D2D2E6', '#9FA0C0', '#6E6F94', '#E8C877', '#2E3358', '#1E2240', '#0E1024', '#434974'],
    sunrise: ['#FBF1EA', '#382B2E', '#574549', '#8A7076', '#B49AA0', '#D5871F', '#F0D8C8', '#FFF8F2', '#F5E4D9', '#E4C4B0'],
    day:     ['#FCF7EC', '#292420', '#463F34', '#6E6555', '#9C917E', '#D06334', '#EBD7B3', '#FDFAF3', '#F6ECD6', '#D6BB85'],
    sunset:  ['#FBEADF', '#2E2228', '#4A3742', '#7C6169', '#AD8E96', '#C64A6E', '#F0CDB8', '#FFF4EC', '#F5D8C7', '#E7B79C']
  };

  var TOKENS = [
    '--bg-page', '--text-strong', '--text-body', '--text-muted', '--text-faint',
    '--accent', '--border', '--bg-raised', '--bg-sunk', '--border-strong'
  ];

  // Night sits at both ends of the band, because it does.
  var ANCHORS = [
    [0, 'night'], [6.5, 'sunrise'], [12.5, 'day'], [18.5, 'sunset'], [24, 'night']
  ];

  var WORDS = { night: 'Night', sunrise: 'Sunrise', day: 'Day', sunset: 'Sunset' };

  // -------- environment --------
  function mq(q) { return window.matchMedia ? window.matchMedia(q) : { matches: false }; }

  // Someone whose machine asks for dark has stated a preference. The page
  // opens at night and never drifts. Dragging still works and sticks.
  var darkQuery = mq('(prefers-color-scheme: dark)');
  var motionQuery = mq('(prefers-reduced-motion: reduce)');
  function locked() { return darkQuery.matches; }
  function reduced() { return motionQuery.matches; }

  // -------- color --------
  function channels(hex) {
    return [
      parseInt(hex.substr(1, 2), 16),
      parseInt(hex.substr(3, 2), 16),
      parseInt(hex.substr(5, 2), 16)
    ];
  }

  function mix(a, b, t) {
    var x = channels(a), y = channels(b), out = '#', i, v;
    for (i = 0; i < 3; i++) {
      v = Math.round(x[i] + (y[i] - x[i]) * t).toString(16);
      out += v.length < 2 ? '0' + v : v;
    }
    return out;
  }

  function segment(h) {
    var i = 0;
    while (i < ANCHORS.length - 2 && h >= ANCHORS[i + 1][0]) i++;
    return i;
  }

  function paletteAt(h) {
    var i = segment(h);
    var lo = ANCHORS[i], hi = ANCHORS[i + 1];
    var t = (h - lo[0]) / (hi[0] - lo[0]);
    var a = PALETTES[lo[1]], b = PALETTES[hi[1]], out = [], k;
    for (k = 0; k < TOKENS.length; k++) out.push(mix(a[k], b[k], t));
    return out;
  }

  // The word names the anchor you are nearest, not the segment you are in.
  function lightName(h) {
    var best = ANCHORS[0], bestD = Infinity, i, d;
    for (i = 0; i < ANCHORS.length; i++) {
      d = Math.abs(h - ANCHORS[i][0]);
      if (d < bestD) { bestD = d; best = ANCHORS[i]; }
    }
    return WORDS[best[1]];
  }

  function nearestAnchorHour(h) {
    var best = 0, bestD = Infinity, i, d;
    for (i = 0; i < ANCHORS.length; i++) {
      d = Math.abs(h - ANCHORS[i][0]);
      if (d < bestD) { bestD = d; best = ANCHORS[i][0]; }
    }
    return best;
  }

  // A dial with detents, not a dial that fights you.
  function magnetize(h) {
    var near = nearestAnchorHour(h);
    var d = Math.abs(h - near);
    if (d < MAGNET_RANGE) h = h + (near - h) * (1 - d / MAGNET_RANGE) * MAGNET_STRENGTH;
    return h;
  }

  function trueHour() {
    var d = new Date();
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  }

  // Never let a bad number reach the palette: one NaN turns every token
  // into "#NaNNaNNaN" and the page loses all of its color at once.
  function clamp(h) {
    if (typeof h !== 'number' || h !== h) return hour === null ? 0 : hour;
    return h < 0 ? 0 : h > 24 ? 24 : h;
  }

  // -------- state --------
  var band, marker, word, root = document.documentElement;
  var hour = null;
  var dragging = false;
  var driftFrame = null;
  var creepTimer = null;
  var keyTimer = null;
  var announced = '';
  var widthCache = {};

  // Measured once per word. Reading offsetWidth every frame during a drag
  // would force a layout right after we wrote --hz-x.
  function wordWidth(name) {
    if (widthCache[name] === undefined) widthCache[name] = word.offsetWidth;
    return widthCache[name];
  }

  function remeasure() {
    widthCache = {};
    if (hour !== null) paint(hour);
  }

  function paint(h) {
    hour = clamp(h);
    var colors = paletteAt(hour), i;
    for (i = 0; i < TOKENS.length; i++) root.style.setProperty(TOKENS[i], colors[i]);

    var frac = hour / 24;
    band.style.setProperty('--hz-x', (frac * 100) + '%');

    var name = lightName(hour);
    if (word.textContent !== name) word.textContent = name;

    // FLIP_AT is tuned for a wide viewport. On a narrow one the word runs off
    // the edge well before 78%, so also flip once it actually would not fit.
    var bw = band.clientWidth;
    band.classList.toggle('flip',
      frac > FLIP_AT || (bw > 0 && frac * bw + WORD_GAP + wordWidth(name) > bw));

    // Keep aria current without narrating every animation frame at it.
    var stamp = name + ':' + (Math.round(hour * 4) / 4);
    if (stamp !== announced) {
      announced = stamp;
      band.setAttribute('aria-valuenow', String(Math.round(hour * 100) / 100));
      band.setAttribute('aria-valuetext', name);
    }
  }

  // -------- drift: back to true local time over 90 seconds --------
  function cancelDrift() {
    if (driftFrame !== null) { cancelAnimationFrame(driftFrame); driftFrame = null; }
  }

  function startDrift() {
    cancelDrift();
    if (locked()) return;
    if (reduced()) { paint(trueHour()); return; }

    var from = hour;
    var t0 = performance.now();

    driftFrame = requestAnimationFrame(function step(t) {
      var p = (t - t0) / DRIFT_MS;
      if (p >= 1) {
        driftFrame = null;
        paint(trueHour());
        return;
      }
      var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      // Recompute the target every frame so it stays honest for the full 90s.
      paint(from + (trueHour() - from) * e);
      driftFrame = requestAnimationFrame(step);
    });
  }

  // -------- creep: someone reading for an hour ends in a different light --------
  function startCreep() {
    if (creepTimer !== null) return;
    creepTimer = setInterval(function () {
      if (locked() || dragging || driftFrame !== null || keyTimer !== null) return;
      paint(trueHour());
    }, CREEP_MS);
  }

  // -------- drag: the whole horizon is the track --------
  function hourFromEvent(e) {
    var r = band.getBoundingClientRect();
    if (!r.width) return hour;  // collapsed viewport; hold rather than divide by zero
    return clamp((e.clientX - r.left) / r.width * 24);
  }

  function onPointerDown(e) {
    cancelDrift();
    if (keyTimer !== null) { clearTimeout(keyTimer); keyTimer = null; }
    dragging = true;
    band.classList.add('dragging');
    if (band.setPointerCapture) {
      try { band.setPointerCapture(e.pointerId); } catch (err) { /* no capture, still fine */ }
    }
    paint(magnetize(hourFromEvent(e)));
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragging) return;
    paint(magnetize(hourFromEvent(e)));
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    band.classList.remove('dragging');
    if (band.releasePointerCapture) {
      try { band.releasePointerCapture(e.pointerId); } catch (err) { /* already gone */ }
    }
    startDrift();
  }

  // -------- keyboard --------
  function onKeyDown(e) {
    var step = e.shiftKey ? KEY_STEP_BIG : KEY_STEP;
    var next = null;

    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = hour + step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = hour - step;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 24;
    else return;

    e.preventDefault();
    cancelDrift();
    paint(next);

    if (keyTimer !== null) clearTimeout(keyTimer);
    keyTimer = setTimeout(function () { keyTimer = null; startDrift(); }, KEY_RESUME_MS);
  }

  // -------- init --------
  function init() {
    band = document.getElementById('hz');
    if (!band) return;
    marker = band.querySelector('.hz-marker');
    word = band.querySelector('.hz-word');

    paint(locked() ? 0 : trueHour());

    band.addEventListener('pointerdown', onPointerDown);
    band.addEventListener('pointermove', onPointerMove);
    band.addEventListener('pointerup', onPointerUp);
    band.addEventListener('pointercancel', onPointerUp);
    band.addEventListener('keydown', onKeyDown);
    band.addEventListener('dragstart', function (e) { e.preventDefault(); });

    // The word's width decides when it has to flip, so re-measure whenever
    // it could have changed: viewport resize, and the webfont arriving.
    window.addEventListener('resize', remeasure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);

    // If the OS flips to dark mid-visit, honor it: go to night and stay.
    if (darkQuery.addEventListener) {
      darkQuery.addEventListener('change', function () {
        cancelDrift();
        if (locked()) paint(0); else startDrift();
      });
    }

    startCreep();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
