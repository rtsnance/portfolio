/* ============================================================
   Quilt hero — behaviour
   Vanilla, no dependencies, no build step. Load with `defer`:
       <script src="js/quilt.js" defer></script>
   External on purpose: index.html's inline scripts are pinned by
   sha256 in _headers, and a new inline block would need a new hash.

   Progressive enhancement. The panel is GENERATED FROM the
   <article class="case"> blocks already in the page, and once it is
   built it takes their place: the source articles, and anything else
   marked data-quilt-source, are hidden under html.quilt-on. If this
   file fails to load, the case list is still the list.
   ============================================================ */
(function () {
  "use strict";

  /* ---- THEME: every magic number in the layout lives here ---- */
  var THEME = {
    SOURCE:    "article.case", // where the content comes from
    G:          1.1,   // grout between tiles, % of panel
    BAR_H:      7.5,   // collapsed horizontal bar, % of panel height
    SLV_W:      7.5,   // collapsed vertical sliver, % of panel width
    CARD_W:    22,     // the middle scale, % of panel width
    MIN_BAND:  14,     // shortest timeline band, % of panel width
    TICK_GUTTER: 8,    // % of panel height reserved for the year ruler
    Y_PAD:      1,     // years of air either side of the timeline axis
    TICK_STEP:  2,     // years between ruler ticks
    CYCLE:   4200,     // one beat of the opening sequence, ms. 0 skips it.
    LOGO_ASPECT: 3.5,  // a logo this wide-to-tall renders at its scale's base height
    LOGO_K: [0.7, 1.8] // how far squarer or wider logos may grow or shrink from that
  };

  var CAPTION = {
    quilt:    "Reading order",
    mosaic:   "Every piece at one size",
    timeline: "Arranged by when"
  };

  var mount = document.querySelector("[data-quilt]");
  if (!mount) { return; }

  /* ---- dates ----
     data-from / data-to take "2023", "2023-04" or "present" and read as
     decimal years. Both ends are inclusive: from="2023-04" to="2024-04"
     runs from the start of April 2023 to the end of April 2024, and a
     bare year covers the whole year.                                   */
  function toYears(s, end) {
    s = (s || "").trim();
    if (/^present$/i.test(s)) {
      var now = new Date();
      return now.getFullYear() + (now.getMonth() + 1) / 12;
    }
    var m = s.match(/^(\d{4})(?:-(\d{1,2}))?$/);
    if (!m) { return null; }
    var month = m[2] ? parseInt(m[2], 10) - 1 : 0;
    var span = end ? (m[2] ? 1 : 12) : 0;
    return parseInt(m[1], 10) + (month + span) / 12;
  }

  /* ---- read the page ---- */
  var sources = Array.prototype.slice.call(document.querySelectorAll(THEME.SOURCE));

  function readCase(art) {
    var txt = function (sel) {
      var n = art.querySelector(sel);
      return n ? n.textContent.trim() : "";
    };
    var link = art.querySelector(".ctitle a") || art.querySelector("a[href]");
    var num = txt(".cnum");                       // "01 — SigmaSight"
    var split = num.split(/\s+[—–-]\s+/);
    var from = toYears(art.getAttribute("data-from"), false);
    var to = toYears(art.getAttribute("data-to") || art.getAttribute("data-from"), true);
    return {
      n:      split[0] || "",
      name:   split[1] || num,
      title:  txt(".ctitle"),
      desc:   txt(".cdesc"),
      mnum:   txt(".cmnum"),
      mlabel: txt(".cmlabel"),
      href:   link ? link.getAttribute("href") : null,
      from:   from,
      to:     from === null ? null : to,
      brand:  {
        logo:   art.getAttribute("data-logo"),
        motion: art.getAttribute("data-logo-motion"),
        bg:     art.getAttribute("data-brand-bg"),
        fg:     art.getAttribute("data-brand-fg"),
        accent: art.getAttribute("data-brand-accent"),
        edge:   art.getAttribute("data-brand-edge"),
        motif:  art.getAttribute("data-brand-motif")
      }
    };
  }

  var items = sources.map(readCase);
  if (items.length < 2) { return; }
  var dated = items.every(function (w) { return w.from !== null; });

  /* ---- geometry: the load-bearing part ----
     Returns one box per item: {state, x, y, w, h} in % of the panel.
     Reading order is preserved in quilt mode: pieces BEFORE the
     featured one collapse to bars along the top, the piece AFTER it
     holds the card column, everything past that collapses to slivers
     on the right. That is what tells you where you are.            */
  function arrange(mode, featured) {
    var n = items.length;
    var G = THEME.G;
    var box = new Array(n);
    var i;

    if (mode === "mosaic") {
      var cols = Math.ceil(Math.sqrt(n));
      var rows = Math.ceil(n / cols);
      var mw = (100 - G * (cols - 1)) / cols;
      var mh = (100 - G * (rows - 1)) / rows;
      for (i = 0; i < n; i++) {
        box[i] = { state: "card",
                   x: (i % cols) * (mw + G),
                   y: Math.floor(i / cols) * (mh + G),
                   w: mw, h: mh };
      }
      return box;
    }

    if (mode === "timeline") {
      var years = items.map(function (w) { return w.from; })
                       .concat(items.map(function (w) { return w.to; }));
      var y0 = Math.min.apply(null, years) - THEME.Y_PAD;
      var y1 = Math.max.apply(null, years) + THEME.Y_PAD;
      var span = y1 - y0;
      var order = items.map(function (w, k) { return k; })
                       .sort(function (a, b) { return items[a].from - items[b].from; });
      var rh = (100 - THEME.TICK_GUTTER - G * (n - 1)) / n;
      order.forEach(function (k, row) {
        var x = ((items[k].from - y0) / span) * 100;
        var wd = Math.max(((items[k].to - items[k].from) / span) * 100, THEME.MIN_BAND);
        if (x + wd > 100) { x = 100 - wd; }
        box[k] = { state: "band", x: x, y: row * (rh + G), w: wd, h: rh };
      });
      box.axis = { y0: y0, y1: y1 };
      return box;
    }

    // quilt
    var before = featured;
    var after = n - 1 - featured;
    var slivers = Math.max(after - 1, 0);
    var topBand = before > 0 ? THEME.BAR_H + G : 0;
    var cardBand = after > 0 ? THEME.CARD_W + G : 0;
    var slvBand = slivers > 0 ? THEME.SLV_W + G : 0;
    var barW = (100 - G * (before - 1)) / Math.max(before, 1);
    var featW = 100 - cardBand - slvBand;
    var slvH = (100 - topBand - G * (slivers - 1)) / Math.max(slivers, 1);

    for (i = 0; i < n; i++) {
      if (i < featured) {
        box[i] = { state: "bar", x: i * (barW + G), y: 0, w: barW, h: THEME.BAR_H };
      } else if (i === featured) {
        box[i] = { state: "featured", x: 0, y: topBand, w: featW, h: 100 - topBand };
      } else if (i === featured + 1) {
        box[i] = { state: "card", x: featW + G, y: topBand, w: THEME.CARD_W, h: 100 - topBand };
      } else {
        box[i] = { state: "sliver", x: 100 - THEME.SLV_W,
                   y: topBand + (i - featured - 2) * (slvH + G),
                   w: THEME.SLV_W, h: slvH };
      }
    }
    return box;
  }

  /* ---- build ---- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  var stage = el("div", "quilt-stage");
  var modes = el("div", "quilt-modes");
  modes.setAttribute("role", "group");
  modes.setAttribute("aria-label", "Arrangement");

  var MODES = [["quilt", "Quilt"], ["mosaic", "Mosaic"]];
  if (dated) { MODES.push(["timeline", "Timeline"]); }

  var buttons = MODES.map(function (m) {
    var b = el("button", null, m[1]);
    b.type = "button";
    b.setAttribute("data-mode", m[0]);
    b.setAttribute("aria-pressed", m[0] === "quilt" ? "true" : "false");
    b.addEventListener("click", function () { touch(); setMode(m[0]); });
    modes.appendChild(b);
    return b;
  });

  modes.appendChild(el("span", "quilt-spacer"));
  var caption = el("span", "quilt-caption", CAPTION.quilt);
  modes.appendChild(caption);

  var panel = el("div", "quilt");
  panel.setAttribute("data-mode", "quilt");
  panel.setAttribute("role", "group");
  panel.setAttribute("aria-label", "Selected work");

  var ticks = el("div", "quilt-ticks");
  panel.appendChild(ticks);

  /* Brand values go onto the tile as custom properties. quilt.css reads
     them and falls back to Desert tokens when a case has none.          */
  function brand(t, b) {
    if (b.bg) { t.style.setProperty("--brand-bg", b.bg); t.setAttribute("data-branded", ""); }
    if (b.fg) { t.style.setProperty("--brand-fg", b.fg); }
    if (b.accent) { t.style.setProperty("--brand-accent", b.accent); }
    if (b.edge) { t.style.setProperty("--brand-edge", b.edge); t.setAttribute("data-edge", ""); }
    if (b.motif) { t.setAttribute("data-motif", b.motif); }
  }

  /* A logo sized by its shape: height scales with 1/sqrt(aspect), so a
     wide wordmark and a square mark read at about the same weight.
     A brand whose logo moves (data-logo-motion) gets it as a muted,
     looping video with the still as its poster. Reduced motion keeps
     the still. (Checked here because the state block below runs after
     the tiles are built.)                                              */
  function logo(w) {
    var moving = !!w.brand.motion && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var node = el(moving ? "video" : "img", "quilt-logo");
    function size(nw, nh) {
      var k = Math.sqrt(THEME.LOGO_ASPECT / ((nw / nh) || THEME.LOGO_ASPECT));
      k = Math.min(THEME.LOGO_K[1], Math.max(THEME.LOGO_K[0], k));
      node.style.setProperty("--logo-k", k.toFixed(2));
    }
    if (moving) {
      node.muted = true;
      node.setAttribute("muted", "");  // autoplay needs the attribute as well as the property
      node.loop = true;
      node.autoplay = true;
      node.playsInline = true;
      node.setAttribute("aria-hidden", "true");
      if (w.brand.logo) { node.poster = w.brand.logo; }
      node.addEventListener("loadedmetadata", function () { size(node.videoWidth, node.videoHeight); });
      // The autoplay flag alone doesn't start a video built in script, so ask
      // once there's a frame. If the browser refuses, the poster stays up.
      node.addEventListener("loadeddata", function () {
        var p = node.play();
        if (p && p.catch) { p.catch(function () {}); }
      });
      node.src = w.brand.motion;
    } else {
      node.alt = "";                   // the tile's button already names the case
      node.decoding = "async";
      node.addEventListener("load", function () { size(node.naturalWidth, node.naturalHeight); });
      node.src = w.brand.logo;
    }
    return node;
  }

  /* The way out of the panel. The piece itself is a control (it arranges
     the panel), so the link sits beside that button, not inside it: a
     link inside a <button> is invalid and unreachable by keyboard.      */
  function caseLink(w, words) {
    var a = el("a", "quilt-link", words + " ");
    a.href = w.href;
    a.setAttribute("aria-label", "Read the " + w.name + " case study");
    var arrow = el("span", "quilt-arrow", "→");
    arrow.setAttribute("aria-hidden", "true");
    a.appendChild(arrow);
    return a;
  }

  /* One record per piece: its element, its button, and the faces and
     links that belong to each state, so paint() can show exactly one
     face and let only that face's link take focus.                   */
  var tiles = items.map(function (w, i) {
    var t = el("div", "quilt-tile");
    brand(t, w.brand);

    var hit = el("button", "quilt-hit");
    hit.type = "button";
    hit.setAttribute("aria-label", w.name + ". " + w.title);
    t.appendChild(hit);

    var rec = { el: t, hit: hit, faces: {}, links: {} };

    var face = el("div", "quilt-face");
    var top = el("div", "quilt-top");
    if (w.brand.logo) {
      top.appendChild(logo(w));
      top.appendChild(el("span", "quilt-num", w.n));
    } else {
      top.appendChild(el("span", "quilt-label", w.n + " / " + w.name));
    }
    face.appendChild(top);
    var body = el("div");
    body.appendChild(el("h3", null, w.title));
    body.appendChild(el("p", null, w.desc));
    var metric = el("div", "quilt-metric");
    metric.appendChild(el("b", null, w.mnum));
    metric.appendChild(el("span", "quilt-label", w.mlabel));
    body.appendChild(metric);
    if (w.href) { rec.links.featured = body.appendChild(caseLink(w, "Read the case study")); }
    face.appendChild(body);
    t.appendChild(face);
    rec.faces.featured = [face];

    var mid = el("div", "quilt-mid");
    mid.appendChild(el("span", "quilt-num", w.n));
    mid.appendChild(w.brand.logo ? logo(w) : el("h4", null, w.name));
    mid.appendChild(el("p", null, w.desc));
    mid.appendChild(el("span", "quilt-rule", w.mnum));
    if (w.href) { rec.links.card = mid.appendChild(caseLink(w, "Case study")); }
    t.appendChild(mid);
    rec.faces.card = [mid];

    var band = el("div", "quilt-band");
    band.appendChild(el("h4", null, w.name));
    // A band carries its name only. The ruler underneath IS the year axis;
    // repeating the dates inside every band competes with it and, at this
    // panel width, wins by eating the name.
    t.appendChild(band);
    rec.faces.band = [band];

    // The band's surface is the brand; its logo sits inside when it has one.
    if (w.brand.logo) {
      var mark = el("div", "quilt-mark");
      mark.appendChild(logo(w));
      t.appendChild(mark);
      rec.faces.band.push(mark);
    }

    [["bar", "h"], ["sliver", "v"]].forEach(function (d) {
      var e = el("div", "quilt-edge quilt-edge-" + d[1]);
      e.appendChild(el("span", "quilt-n", w.n));
      e.appendChild(el("span", null, w.name));
      t.appendChild(e);
      rec.faces[d[0]] = [e];
    });

    hit.addEventListener("click", function () {
      touch();
      if (mode !== "quilt") { setMode("quilt"); feature(i); return; }
      if (featured === i && w.href) { window.location.href = w.href; return; }
      feature(i);
    });
    hit.addEventListener("focus", function () { touch(); if (mode === "quilt") { feature(i); } });
    t.addEventListener("mouseenter", function () { if (touched && mode === "quilt") { feature(i); } });

    panel.appendChild(t);
    return rec;
  });

  stage.appendChild(modes);
  stage.appendChild(panel);
  mount.appendChild(stage);

  // The panel is built, so the list it came from steps aside. It stays in
  // the page as the panel's source and as plain links for crawlers.
  sources.forEach(function (art) { art.setAttribute("data-quilt-source", ""); });
  document.documentElement.classList.add("quilt-on");

  /* ---- state ---- */
  var mode = "quilt";
  var featured = 0;
  var touched = false;
  var timer = null;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function touch() {
    if (touched) { return; }
    touched = true;
    if (timer) { clearInterval(timer); }
  }

  function drawTicks(axis) {
    ticks.textContent = "";
    if (!axis) { return; }
    var span = axis.y1 - axis.y0;
    for (var y = Math.ceil(axis.y0); y < axis.y1; y += THEME.TICK_STEP) {
      var x = ((y - axis.y0) / span) * 100;
      var line = el("i");
      line.style.left = x + "%";
      var lab = el("b", null, String(y));
      lab.style.left = x + "%";
      ticks.appendChild(line);
      ticks.appendChild(lab);
    }
  }

  function paint() {
    var boxes = arrange(mode, featured);
    var panelW = panel.clientWidth;
    drawTicks(boxes.axis);
    tiles.forEach(function (rec, i) {
      var b = boxes[i];
      var t = rec.el;
      t.setAttribute("data-state", b.state);
      rec.hit.setAttribute("aria-expanded", b.state === "featured" ? "true" : "false");
      t.style.left = b.x + "%";
      t.style.top = b.y + "%";
      t.style.width = b.w + "%";
      t.style.height = b.h + "%";
      // only the visible face is read out, and only its link takes focus
      Object.keys(rec.faces).forEach(function (s) {
        rec.faces[s].forEach(function (f) {
          if (s === b.state) { f.removeAttribute("aria-hidden"); } else { f.setAttribute("aria-hidden", "true"); }
        });
      });
      Object.keys(rec.links).forEach(function (s) { rec.links[s].tabIndex = s === b.state ? 0 : -1; });
      if (b.state === "band") { placeName(t, b, panelW); }
    });
  }

  /* A band is drawn at its true length, so its name rarely fits inside.
     It sits beside the band: to the right if it fits there, otherwise on
     whichever side has more room, clipped to that room.                 */
  function placeName(t, b, panelW) {
    var name = t.querySelector(".quilt-band");
    var right = panelW * (100 - b.x - b.w) / 100;
    var left = panelW * b.x / 100;
    name.style.maxWidth = "none";
    var side = (name.scrollWidth <= right || right >= left) ? "right" : "left";
    t.setAttribute("data-side", side);
    name.style.maxWidth = (side === "right" ? right : left) + "px";
  }

  window.addEventListener("resize", function () { if (mode === "timeline") { paint(); } });

  function setMode(m) {
    mode = m;
    panel.setAttribute("data-mode", m);
    caption.textContent = CAPTION[m];
    buttons.forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-mode") === m ? "true" : "false");
    });
    paint();
  }

  function feature(k) {
    if (k === featured && mode === "quilt") { return; }
    featured = k;
    paint();
  }

  panel.addEventListener("keydown", function (e) {
    if (mode !== "quilt") { return; }
    var d = (e.key === "ArrowRight" || e.key === "ArrowDown") ? 1
          : (e.key === "ArrowLeft" || e.key === "ArrowUp") ? -1 : 0;
    if (!d) { return; }
    e.preventDefault();
    touch();
    feature((featured + d + tiles.length) % tiles.length);
    tiles[featured].hit.focus();
  });

  /* ---- opening sequence ----
     Mosaic first, every piece at once. Then Quilt, featuring each piece in
     reading order, one CYCLE apart. Then Timeline, where it stays. Runs
     once. Any click, key or focus in the panel stops it where it is.     */
  var intro = THEME.CYCLE > 0 && !reduce;
  if (intro) { setMode("mosaic"); } else { paint(); }

  function runIntro() {
    if (touched) { return; }
    var beat = 0;
    timer = setInterval(function () {
      beat += 1;
      if (beat === 1) { setMode("quilt"); }
      else if (beat <= tiles.length) { feature(beat - 1); }
      else {
        clearInterval(timer);
        if (dated) { setMode("timeline"); }
      }
    }, THEME.CYCLE);
  }

  // A background tab would run the sequence unseen, so wait to be looked at.
  function whenVisible(fn) {
    if (document.visibilityState !== "hidden") { fn(); return; }
    document.addEventListener("visibilitychange", function wait() {
      if (document.visibilityState === "hidden") { return; }
      document.removeEventListener("visibilitychange", wait);
      fn();
    });
  }

  if (intro) { whenVisible(runIntro); }
}());
