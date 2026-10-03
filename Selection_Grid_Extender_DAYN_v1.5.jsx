#target "illustrator"

/*
Selection Grid Extender — v1.4

The selected object (or the combined bounds of several selected objects) is the BASE SQUARE.
- Columns / Rows divide the base square into cells.
- "Extend outside" adds extra cells (same size) on the Left, Right, Top and Bottom.
- Tip: Columns = 1 and Rows = 1 uses the object itself as one cell and repeats it outward.

v1.4:
- Rotated grid now FITS TIGHTLY: the base area is measured along the rotated axes using the
  object's real anchor points and the extreme points of its curves (tangent points), so the
  grid edges touch the outermost points of the shape (rounded corners included).
  Groups / compound paths / clipping masks are handled. Text, images and symbols fall back
  to their bounding-box corners.

v1.3:
- Rotate the grid by any angle (positive = counter-clockwise, like Illustrator's Rotate tool).
  Two base-area modes:
    * Fit tightly to the selection (see v1.4).
    * Same size as selection: the selection box itself is rotated, same width / height.
- Angle presets (0, 45, 90). The angle is not remembered between runs.

v1.2: Units dropdown (pt, mm, cm, in, px, pc), defaults to the document ruler units.
v1.1: Link sides, separate col/row gutters, inside/outside colours, replace previous grid,
      remembered settings + Reset, lock layer, arrow-key stepping.
*/

(function () {
  if (app.documents.length === 0) { alert("Open a document first."); return; }
  var doc = app.activeDocument;

  var selItems = [];
  try { for (var s = 0; s < doc.selection.length; s++) selItems.push(doc.selection[s]); } catch (e0) {}
  if (selItems.length === 0) { alert("Select an object first.\nThe selection is used as the base square."); return; }

  var LAYER_PREFIX = "Selection Grid - ";
  var PREVIEW_LAYER = "_Grid Preview";

  var UNITS = [
    { abbr: 'pt', name: 'Points (pt)',      f: 1,           dec: 2, gStep: 1,   sStep: 0.1   },
    { abbr: 'mm', name: 'Millimeters (mm)', f: 2.834645669, dec: 2, gStep: 1,   sStep: 0.05  },
    { abbr: 'cm', name: 'Centimeters (cm)', f: 28.34645669, dec: 3, gStep: 0.1, sStep: 0.005 },
    { abbr: 'in', name: 'Inches (in)',      f: 72,          dec: 3, gStep: 0.05, sStep: 0.002 },
    { abbr: 'px', name: 'Pixels (px)',      f: 1,           dec: 2, gStep: 1,   sStep: 0.1   },
    { abbr: 'pc', name: 'Picas (pc)',       f: 12,          dec: 2, gStep: 0.5, sStep: 0.01  }
  ];
  var curUnit = 1;

  function docUnitIndex() {
    try {
      var u = doc.rulerUnits;
      if (u === RulerUnits.Points) return 0;
      if (u === RulerUnits.Millimeters) return 1;
      if (u === RulerUnits.Centimeters) return 2;
      if (u === RulerUnits.Inches) return 3;
      if (u === RulerUnits.Pixels) return 4;
      if (u === RulerUnits.Picas) return 5;
    } catch (e) {}
    return 1;
  }
  function fmtLen(pt) {
    var u = UNITS[curUnit];
    return (pt / u.f).toFixed(u.dec) + " " + u.abbr;
  }

  var DEF = {
    cols: 4, rows: 4,
    gutC: 0, gutR: 0, gutLink: 1,
    extL: 0, extR: 0, extT: 0, extB: 0,
    linkAll: 0, linkLR: 0, linkTB: 0,
    vis: 0, diff: 1, guides: 1, replace: 1, lock: 1,
    stroke: 0.5, live: 1, unit: -1,
    angle: 0, rotMode: 0
  };
  var SETTINGS_FILE = new File(Folder.userData + "/SelectionGridExtender_v12_settings.txt");

  function loadSettings() {
    var V = {}, k;
    for (k in DEF) { V[k] = DEF[k]; }
    try {
      if (SETTINGS_FILE.exists) {
        SETTINGS_FILE.open('r');
        var txt = SETTINGS_FILE.read();
        SETTINGS_FILE.close();
        var lines = txt.split("\n");
        for (var i = 0; i < lines.length; i++) {
          var ln = lines[i].replace(/\r/g, "");
          var p = ln.split("=");
          if (p.length === 2 && DEF.hasOwnProperty(p[0]) && p[1] !== "" && !isNaN(Number(p[1]))) {
            V[p[0]] = Number(p[1]);
          }
        }
      }
    } catch (e) {}
    V.angle = 0;
    return V;
  }
  function saveSettings(v) {
    try {
      var out = [], k;
      for (k in v) { if (k === 'angle') continue; out.push(k + "=" + v[k]); }
      SETTINGS_FILE.encoding = "UTF-8";
      SETTINGS_FILE.open('w');
      SETTINGS_FILE.write(out.join("\n"));
      SETTINGS_FILE.close();
    } catch (e) {}
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function toNum(v, d) { var n = Number(v); return isNaN(n) ? d : n; }
  function nowStamp() {
    function p(n) { return (n < 10 ? "0" : "") + n; }
    var d = new Date();
    return d.getFullYear() + "" + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  function getBounds(useVisible) {
    var L = null, T = null, R = null, B = null;
    for (var i = 0; i < selItems.length; i++) {
      var g;
      try { g = useVisible ? selItems[i].visibleBounds : selItems[i].geometricBounds; } catch (e) { continue; }
      if (!g) continue;
      if (L === null || g[0] < L) L = g[0];
      if (T === null || g[1] > T) T = g[1];
      if (R === null || g[2] > R) R = g[2];
      if (B === null || g[3] < B) B = g[3];
    }
    if (L === null) return null;
    return { L: L, T: T, R: R, B: B, W: R - L, H: T - B };
  }
  if (!getBounds(false)) { alert("The selected object has no measurable bounds."); return; }

  var geo = null;

  function addPathGeo(p, out) {
    var pts, n;
    try { pts = p.pathPoints; n = pts.length; } catch (e) { return; }
    if (n === 0) return;
    var sw = 0;
    try { if (p.stroked) sw = p.strokeWidth; } catch (e1) {}
    var P = [];
    for (var i = 0; i < n; i++) {
      P.push({ a: pts[i].anchor, l: pts[i].leftDirection, r: pts[i].rightDirection });
    }
    var segs = [];
    function mk(i1, j1) {
      segs.push([P[i1].a[0], P[i1].a[1], P[i1].r[0], P[i1].r[1], P[j1].l[0], P[j1].l[1], P[j1].a[0], P[j1].a[1]]);
    }
    for (var k = 0; k < n - 1; k++) mk(k, k + 1);
    var closed = false;
    try { closed = p.closed; } catch (e2) {}
    if (closed && n > 1) mk(n - 1, 0);
    out.push({ segs: segs, pts: (n === 1 ? [[P[0].a[0], P[0].a[1]]] : []), sw: sw });
  }

  function collectGeo(it, out) {
    var t = "";
    try { t = it.typename; } catch (e) { return; }
    if (t === "PathItem") { addPathGeo(it, out); return; }
    if (t === "CompoundPathItem") {
      for (var i = 0; i < it.pathItems.length; i++) addPathGeo(it.pathItems[i], out);
      return;
    }
    if (t === "GroupItem") {
      var items = it.pageItems, j;
      if (it.clipped) {
        for (j = 0; j < items.length; j++) {
          var x = items[j], isClip = false;
          try {
            if (x.typename === "PathItem") isClip = x.clipping;
            else if (x.typename === "CompoundPathItem") isClip = x.pathItems[0].clipping;
          } catch (e3) {}
          if (isClip) { collectGeo(x, out); return; }
        }
      }
      for (j = 0; j < items.length; j++) collectGeo(items[j], out);
      return;
    }
    try {
      var g = it.geometricBounds, v = it.visibleBounds;
      out.push({
        segs: [],
        pts:  [[g[0], g[1]], [g[2], g[1]], [g[2], g[3]], [g[0], g[3]]],
        vpts: [[v[0], v[1]], [v[2], v[1]], [v[2], v[3]], [v[0], v[3]]],
        sw: 0
      });
    } catch (e4) {}
  }

  function tightExtents(angleDeg, useVis) {
    if (!geo) {
      geo = [];
      for (var i = 0; i < selItems.length; i++) collectGeo(selItems[i], geo);
    }
    if (geo.length === 0) return null;

    var a = angleDeg * Math.PI / 180;
    var ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;

    function add(acc, x, y) {
      var p = x * ux + y * uy, q = x * vx + y * vy;
      if (p < acc.umin) acc.umin = p;
      if (p > acc.umax) acc.umax = p;
      if (q < acc.vmin) acc.vmin = q;
      if (q > acc.vmax) acc.vmax = q;
    }
    function addSeg(acc, s) {
      add(acc, s[0], s[1]);
      add(acc, s[6], s[7]);
      for (var ax = 0; ax < 2; ax++) {
        var dx = (ax === 0) ? ux : vx, dy = (ax === 0) ? uy : vy;
        var a0 = s[0] * dx + s[1] * dy, a1 = s[2] * dx + s[3] * dy;
        var a2 = s[4] * dx + s[5] * dy, a3 = s[6] * dx + s[7] * dy;
        var d0 = a1 - a0, d1 = a2 - a1, d2 = a3 - a2;
        var qa = d0 - 2 * d1 + d2, qb = 2 * (d1 - d0), qc = d0;
        var ts = [];
        if (Math.abs(qa) < 1e-12) {
          if (Math.abs(qb) > 1e-12) ts.push(-qc / qb);
        } else {
          var disc = qb * qb - 4 * qa * qc;
          if (disc >= 0) {
            var sq = Math.sqrt(disc);
            ts.push((-qb + sq) / (2 * qa));
            ts.push((-qb - sq) / (2 * qa));
          }
        }
        for (var ti = 0; ti < ts.length; ti++) {
          var t = ts[ti];
          if (t > 0 && t < 1) {
            var m = 1 - t, b0 = m * m * m, b1 = 3 * m * m * t, b2 = 3 * m * t * t, b3 = t * t * t;
            add(acc, b0 * s[0] + b1 * s[2] + b2 * s[4] + b3 * s[6],
                     b0 * s[1] + b1 * s[3] + b2 * s[5] + b3 * s[7]);
          }
        }
      }
    }

    var G = { umin: 1e30, umax: -1e30, vmin: 1e30, vmax: -1e30 };
    for (var gi = 0; gi < geo.length; gi++) {
      var item = geo[gi];
      var acc = { umin: 1e30, umax: -1e30, vmin: 1e30, vmax: -1e30 };
      var si, pi;
      for (si = 0; si < item.segs.length; si++) addSeg(acc, item.segs[si]);
      var plist = (useVis && item.vpts) ? item.vpts : item.pts;
      for (pi = 0; pi < plist.length; pi++) add(acc, plist[pi][0], plist[pi][1]);
      if (acc.umin > 1e29) continue;
      if (useVis && item.sw > 0) {
        var h = item.sw / 2;
        acc.umin -= h; acc.umax += h; acc.vmin -= h; acc.vmax += h;
      }
      if (acc.umin < G.umin) G.umin = acc.umin;
      if (acc.umax > G.umax) G.umax = acc.umax;
      if (acc.vmin < G.vmin) G.vmin = acc.vmin;
      if (acc.vmax > G.vmax) G.vmax = acc.vmax;
    }
    if (G.umin > 1e29) return null;
    return G;
  }

  function baseRect(o) {
    var s = getBounds(o.vis);
    if (!s) return null;
    var cx = (s.L + s.R) / 2, cy = (s.T + s.B) / 2;
    var W = s.W, H = s.H;
    if (o.rotMode === 0 && o.angle !== 0) {
      var ex = tightExtents(o.angle, o.vis);
      if (ex) {
        var a = o.angle * Math.PI / 180;
        var ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
        var cu = (ex.umin + ex.umax) / 2, cv = (ex.vmin + ex.vmax) / 2;
        W = ex.umax - ex.umin;
        H = ex.vmax - ex.vmin;
        cx = cu * ux + cv * vx;
        cy = cu * uy + cv * vy;
      } else {
        var ab = Math.abs(o.angle * Math.PI / 180);
        var ca = Math.abs(Math.cos(ab)), sa = Math.abs(Math.sin(ab));
        W = s.W * ca + s.H * sa;
        H = s.W * sa + s.H * ca;
      }
    }
    return { L: cx - W / 2, R: cx + W / 2, T: cy + H / 2, B: cy - H / 2, W: W, H: H, cx: cx, cy: cy, selW: s.W, selH: s.H };
  }

  function removeLayer(name) {
    for (var i = doc.layers.length - 1; i >= 0; i--) {
      if (doc.layers[i].name === name) { try { doc.layers[i].locked = false; doc.layers[i].remove(); } catch (e) {} }
    }
  }
  function getOrAddLayer(name) {
    for (var i = 0; i < doc.layers.length; i++) { if (doc.layers[i].name === name) return doc.layers[i]; }
    var L = doc.layers.add(); L.name = name; return L;
  }
  function clearLayer(L) {
    try { var a = L.pageItems; for (var i = a.length - 1; i >= 0; i--) { a[i].remove(); } } catch (e) {}
  }
  function inColor()  { var c = new RGBColor(); c.red = 0;   c.green = 160; c.blue = 255; return c; }
  function outColor() { var c = new RGBColor(); c.red = 255; c.green = 90;  c.blue = 0;   return c; }
  function line(L, x1, y1, x2, y2, w, col) {
    var p = L.pathItems.add();
    p.setEntirePath([[x1, y1], [x2, y2]]);
    p.filled = false; p.stroked = true; p.strokeWidth = w; p.strokeColor = col;
    return p;
  }

  function edges(start, size, gap, n, before, after, dir) {
    var out = [];
    for (var k = -before; k < n + after; k++) {
      var a = start + dir * k * (size + gap);
      var b = a + dir * size;
      if (gap === 0) { if (k === -before) out.push(a); out.push(b); }
      else { out.push(a); out.push(b); }
    }
    return out;
  }

  // ---------- UI ----------
  var dlg = new Window('dialog', 'Selection Grid Extender');
  dlg.orientation = 'column'; dlg.alignChildren = ['fill', 'top']; dlg.spacing = 8; dlg.margins = 12;

  var unitRow = dlg.add('group'); unitRow.orientation = 'row'; unitRow.alignChildren = ['left', 'center']; unitRow.spacing = 8;
  var unitLab = unitRow.add('statictext', undefined, 'Units'); unitLab.preferredSize = [60, 22];
  var unitNames = [];
  for (var u = 0; u < UNITS.length; u++) unitNames.push(UNITS[u].name);
  var unitDrop = unitRow.add('dropdownlist', undefined, unitNames);
  unitDrop.preferredSize = [170, 22];
  unitDrop.selection = curUnit;

  var info1 = dlg.add('statictext', undefined, ''); info1.preferredSize = [460, 18];
  var info2 = dlg.add('statictext', undefined, ''); info2.preferredSize = [460, 18];
  var info3 = dlg.add('statictext', undefined, ''); info3.preferredSize = [460, 18];
  var info4 = dlg.add('statictext', undefined, ''); info4.preferredSize = [460, 18];

  function addArrows(e, getv, setv, step, onUser) {
    e.addEventListener('keydown', function (k) {
      var n = k.keyName;
      if (n === 'Up' || n === 'Down') {
        var st = (typeof step === 'function') ? step() : step;
        var d = (k.shiftKey ? 10 : 1) * st * (n === 'Up' ? 1 : -1);
        setv(getv() + d);
        k.preventDefault();
        onUser();
      }
    });
  }

  function intField(parent, label, labW, min, max, onUser) {
    var g = parent.add('group'); g.orientation = 'row'; g.alignChildren = ['left', 'center']; g.spacing = 4;
    var t = g.add('statictext', undefined, label); t.preferredSize = [labW, 22];
    var e = g.add('edittext', undefined, '0'); e.characters = 5;
    function getv() { return clamp(Math.round(toNum(e.text, 0)), min, max); }
    function setv(v) { e.text = String(clamp(Math.round(toNum(v, 0)), min, max)); }
    e.onChange = function () { setv(e.text); onUser(); };
    addArrows(e, getv, setv, 1, onUser);
    return { get: getv, set: setv, group: g };
  }

  function stepper(parent, label, min, max, onUser) {
    var n = intField(parent, label, 60, min, max, onUser);
    var m = n.group.add('button', undefined, '-'); m.preferredSize = [26, 22];
    var p = n.group.add('button', undefined, '+'); p.preferredSize = [26, 22];
    m.onClick = function () { n.set(n.get() - 1); onUser(); };
    p.onClick = function () { n.set(n.get() + 1); onUser(); };
    return n;
  }

  function lenField(parent, label, labW, minPt, maxPt, stepKey, onUser) {
    var g = parent.add('group'); g.orientation = 'row'; g.alignChildren = ['left', 'center']; g.spacing = 4;
    var t = g.add('statictext', undefined, label); t.preferredSize = [labW, 22];
    var e = g.add('edittext', undefined, '0'); e.characters = 7;
    var val = 0;
    function disp() { return Math.round(val / UNITS[curUnit].f * 10000) / 10000; }
    function refresh() { e.text = String(disp()); t.text = label + ' (' + UNITS[curUnit].abbr + ')'; }
    function getPt() { return val; }
    function setPt(pt) { val = clamp(toNum(pt, 0), minPt, maxPt); e.text = String(disp()); }
    function getD() { return disp(); }
    function setD(d) { val = clamp(toNum(d, 0) * UNITS[curUnit].f, minPt, maxPt); e.text = String(disp()); }
    e.onChange = function () { setD(e.text); onUser(); };
    addArrows(e, getD, setD, function () { return UNITS[curUnit][stepKey]; }, onUser);
    return { get: getPt, set: setPt, refresh: refresh, group: g };
  }

  function degField(parent, label, labW, min, max, onUser) {
    var g = parent.add('group'); g.orientation = 'row'; g.alignChildren = ['left', 'center']; g.spacing = 4;
    var t = g.add('statictext', undefined, label); t.preferredSize = [labW, 22];
    var e = g.add('edittext', undefined, '0'); e.characters = 7;
    function getv() { return Math.round(clamp(toNum(e.text, 0), min, max) * 100) / 100; }
    function setv(v) { e.text = String(Math.round(clamp(toNum(v, 0), min, max) * 100) / 100); }
    e.onChange = function () { setv(e.text); onUser(); };
    addArrows(e, getv, setv, 1, onUser);
    return { get: getv, set: setv, group: g };
  }

  // Compact row 1: inside and outside panels.
  var topPanels = dlg.add('group');
  topPanels.orientation = 'row'; topPanels.alignChildren = ['left', 'top']; topPanels.spacing = 8;

  var pIn = topPanels.add('panel', undefined, 'Grid inside selection');
  pIn.orientation = 'column'; pIn.alignChildren = ['left', 'top']; pIn.margins = [12, 16, 12, 10]; pIn.spacing = 4;
  var cols = stepper(pIn, 'Columns', 1, 200, changed);
  var rows = stepper(pIn, 'Rows', 1, 200, changed);
  var gutC = lenField(pIn, 'Col gutter', 110, 0, 5000, 'gStep', function () {
    if (gutLink.value) gutR.set(gutC.get());
    changed();
  });
  var gutR = lenField(pIn, 'Row gutter', 110, 0, 5000, 'gStep', function () {
    if (gutLink.value) gutC.set(gutR.get());
    changed();
  });
  var gutLink = pIn.add('checkbox', undefined, 'Link column / row gutters');
  gutLink.onClick = function () { if (gutLink.value) gutR.set(gutC.get()); changed(); };

  var pOut = topPanels.add('panel', undefined, 'Extend outside selection (extra cells)');
  pOut.orientation = 'column'; pOut.alignChildren = ['left', 'top']; pOut.margins = [12, 16, 12, 10]; pOut.spacing = 6;
  var sideRow = pOut.add('group'); sideRow.orientation = 'row'; sideRow.alignChildren = ['left', 'top']; sideRow.spacing = 16;
  var colA = sideRow.add('group'); colA.orientation = 'column'; colA.alignChildren = ['left', 'top']; colA.spacing = 4;
  var colB = sideRow.add('group'); colB.orientation = 'column'; colB.alignChildren = ['left', 'top']; colB.spacing = 4;

  var sides = {};
  sides.L = stepper(colA, 'Left',   0, 200, function () { sideChanged('L'); });
  sides.R = stepper(colA, 'Right',  0, 200, function () { sideChanged('R'); });
  sides.T = stepper(colB, 'Top',    0, 200, function () { sideChanged('T'); });
  sides.B = stepper(colB, 'Bottom', 0, 200, function () { sideChanged('B'); });

  var linkRow = pOut.add('group'); linkRow.orientation = 'row'; linkRow.alignChildren = ['left', 'center']; linkRow.spacing = 12;
  var linkAll = linkRow.add('checkbox', undefined, 'Link all sides');
  var linkLR  = linkRow.add('checkbox', undefined, 'Link Left + Right');
  var linkTB  = linkRow.add('checkbox', undefined, 'Link Top + Bottom');

  function maxOf(keys) {
    var m = 0;
    for (var i = 0; i < keys.length; i++) { m = Math.max(m, sides[keys[i]].get()); }
    return m;
  }
  function setSides(keys, v) { for (var i = 0; i < keys.length; i++) { sides[keys[i]].set(v); } }
  function sideChanged(key) {
    var v = sides[key].get();
    if (linkAll.value) { setSides(['L', 'R', 'T', 'B'], v); }
    else {
      if (linkLR.value && (key === 'L' || key === 'R')) setSides(['L', 'R'], v);
      if (linkTB.value && (key === 'T' || key === 'B')) setSides(['T', 'B'], v);
    }
    changed();
  }
  function updateLinkUI() { linkLR.enabled = !linkAll.value; linkTB.enabled = !linkAll.value; }
  linkAll.onClick = function () {
    updateLinkUI();
    if (linkAll.value) setSides(['L', 'R', 'T', 'B'], maxOf(['L', 'R', 'T', 'B']));
    changed();
  };
  linkLR.onClick = function () { if (linkLR.value) setSides(['L', 'R'], maxOf(['L', 'R'])); changed(); };
  linkTB.onClick = function () { if (linkTB.value) setSides(['T', 'B'], maxOf(['T', 'B'])); changed(); };

  // Compact row 2: rotation and options panels.
  var bottomPanels = dlg.add('group');
  bottomPanels.orientation = 'row'; bottomPanels.alignChildren = ['left', 'top']; bottomPanels.spacing = 8;

  var pRot = bottomPanels.add('panel', undefined, 'Rotate grid');
  pRot.orientation = 'column'; pRot.alignChildren = ['left', 'top']; pRot.margins = [12, 16, 12, 10]; pRot.spacing = 4;
  var angleRow = pRot.add('group'); angleRow.orientation = 'row'; angleRow.alignChildren = ['left', 'center']; angleRow.spacing = 4;
  var angleF = degField(angleRow, 'Angle (deg)', 80, -360, 360, changed);
  function presetBtn(label, deg) {
    var b = angleRow.add('button', undefined, label); b.preferredSize = [38, 22];
    b.onClick = function () { angleF.set(deg); changed(); };
  }
  presetBtn('0', 0); presetBtn('45', 45); presetBtn('90', 90);
  var rotCover = pRot.add('radiobutton', undefined, 'Fit tightly to the selection (edges touch its outermost points / curves)');
  var rotSame  = pRot.add('radiobutton', undefined, 'Same size as selection (rotate the selection box itself)');
  rotCover.onClick = changed; rotSame.onClick = changed;

  var pOpt = bottomPanels.add('panel', undefined, 'Options');
  pOpt.orientation = 'column'; pOpt.alignChildren = ['left', 'top']; pOpt.margins = [12, 16, 12, 10]; pOpt.spacing = 4;
  var visChk = pOpt.add('checkbox', undefined, 'Include stroke width (use visible bounds)');
  var diffChk = pOpt.add('checkbox', undefined, 'Different colour for lines outside the base area (blue inside, orange outside)');
  var guideChk = pOpt.add('checkbox', undefined, 'Convert to guides on Apply');
  var replaceChk = pOpt.add('checkbox', undefined, 'Replace previous grid on Apply');
  var lockChk = pOpt.add('checkbox', undefined, 'Lock grid layer after Apply');
  var strokeF = lenField(pOpt, 'Line stroke', 110, 0.05, 72, 'sStep', changed);
  visChk.onClick = changed; diffChk.onClick = changed;

  var liveChk = dlg.add('checkbox', undefined, 'Live Preview');
  liveChk.onClick = function () { if (liveChk.value) preview(); else clearPreview(); };

  var bar = dlg.add('group'); bar.alignment = 'center'; bar.spacing = 8;
  var resetBtn = bar.add('button', undefined, 'Reset');
  var previewBtn = bar.add('button', undefined, 'Preview');
  var cancelBtn = bar.add('button', undefined, 'Cancel', { name: 'cancel' });
  var applyBtn = bar.add('button', undefined, 'Apply', { name: 'ok' });

  function refreshUnitFields() {
    gutC.refresh(); gutR.refresh(); strokeF.refresh();
  }
  unitDrop.onChange = function () {
    if (!unitDrop.selection) return;
    curUnit = unitDrop.selection.index;
    refreshUnitFields();
    updateInfo();
  };

  function applyValues(v) {
    var ui = v.unit;
    if (!(ui >= 0 && ui < UNITS.length)) ui = docUnitIndex();
    curUnit = Math.round(ui);
    unitDrop.selection = curUnit;

    cols.set(v.cols); rows.set(v.rows);
    gutC.set(v.gutC); gutR.set(v.gutR); gutLink.value = !!v.gutLink;
    sides.L.set(v.extL); sides.R.set(v.extR); sides.T.set(v.extT); sides.B.set(v.extB);
    linkAll.value = !!v.linkAll; linkLR.value = !!v.linkLR; linkTB.value = !!v.linkTB;
    updateLinkUI();
    angleF.set(v.angle);
    rotCover.value = (v.rotMode !== 1); rotSame.value = (v.rotMode === 1);
    visChk.value = !!v.vis; diffChk.value = !!v.diff; guideChk.value = !!v.guides;
    replaceChk.value = !!v.replace; lockChk.value = !!v.lock;
    strokeF.set(v.stroke);
    refreshUnitFields();
    liveChk.value = !!v.live;
  }
  function getValues() {
    return {
      cols: cols.get(), rows: rows.get(),
      gutC: gutC.get(), gutR: gutR.get(), gutLink: gutLink.value ? 1 : 0,
      extL: sides.L.get(), extR: sides.R.get(), extT: sides.T.get(), extB: sides.B.get(),
      linkAll: linkAll.value ? 1 : 0, linkLR: linkLR.value ? 1 : 0, linkTB: linkTB.value ? 1 : 0,
      vis: visChk.value ? 1 : 0, diff: diffChk.value ? 1 : 0, guides: guideChk.value ? 1 : 0,
      replace: replaceChk.value ? 1 : 0, lock: lockChk.value ? 1 : 0,
      stroke: strokeF.get(), live: liveChk.value ? 1 : 0, unit: curUnit,
      angle: angleF.get(), rotMode: rotSame.value ? 1 : 0
    };
  }
  function readOpts() {
    var v = getValues();
    return {
      cols: v.cols, rows: v.rows,
      gx: v.gutC, gy: v.gutR,
      extL: v.extL, extR: v.extR, extT: v.extT, extB: v.extB,
      vis: !!v.vis, diff: !!v.diff, guides: !!v.guides,
      replace: !!v.replace, lock: !!v.lock,
      stroke: v.stroke,
      angle: v.angle, rotMode: v.rotMode
    };
  }

  function cellSize(b, o) {
    return {
      w: (b.W - o.gx * (o.cols - 1)) / o.cols,
      h: (b.H - o.gy * (o.rows - 1)) / o.rows
    };
  }

  function updateInfo() {
    var o = readOpts();
    var b = baseRect(o);
    if (!b) return;
    var c = cellSize(b, o);
    info1.text = "Selection: " + fmtLen(b.selW) + " x " + fmtLen(b.selH);
    if (o.angle !== 0) {
      info4.text = "Grid base (rotated " + o.angle + " deg): " + fmtLen(b.W) + " x " + fmtLen(b.H);
    } else {
      info4.text = "";
    }
    if (c.w <= 0 || c.h <= 0) {
      info2.text = "Gutter is too large for this many columns/rows.";
    } else {
      info2.text = "Cell: " + fmtLen(c.w) + " x " + fmtLen(c.h);
    }
    info3.text = "Total grid: " + (o.cols + o.extL + o.extR) + " columns x " + (o.rows + o.extT + o.extB) + " rows";
  }

  function build(layer, o) {
    var b = baseRect(o);
    if (!b || b.W <= 0 || b.H <= 0) throw Error("The selection has no size.");
    var c = cellSize(b, o);
    if (c.w <= 0 || c.h <= 0) throw Error("Gutter is too large for this many columns/rows.");

    var xs = edges(b.L, c.w, o.gx, o.cols, o.extL, o.extR, 1);
    var ys = edges(b.T, c.h, o.gy, o.rows, o.extT, o.extB, -1);
    var xMin = xs[0], xMax = xs[xs.length - 1];
    var yTop = ys[0], yBot = ys[ys.length - 1];
    var eps = 0.01, w = o.stroke, cin = inColor(), cout = outColor();
    var i, x, y;

    var ang = o.angle * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang);
    function P(px, py) {
      var dx = px - b.cx, dy = py - b.cy;
      return [b.cx + dx * ca - dy * sa, b.cy + dx * sa + dy * ca];
    }
    function seg(x1, y1, x2, y2, col) {
      if (o.angle === 0) { line(layer, x1, y1, x2, y2, w, col); return; }
      var p1 = P(x1, y1), p2 = P(x2, y2);
      line(layer, p1[0], p1[1], p2[0], p2[1], w, col);
    }

    for (i = 0; i < xs.length; i++) {
      x = xs[i];
      if (!o.diff) { seg(x, yTop, x, yBot, cin); continue; }
      var xInside = (x >= b.L - eps && x <= b.R + eps);
      if (!xInside) { seg(x, yTop, x, yBot, cout); continue; }
      if (yTop - b.T > eps) seg(x, yTop, x, b.T, cout);
      seg(x, b.T, x, b.B, cin);
      if (b.B - yBot > eps) seg(x, b.B, x, yBot, cout);
    }

    for (i = 0; i < ys.length; i++) {
      y = ys[i];
      if (!o.diff) { seg(xMin, y, xMax, y, cin); continue; }
      var yInside = (y <= b.T + eps && y >= b.B - eps);
      if (!yInside) { seg(xMin, y, xMax, y, cout); continue; }
      if (b.L - xMin > eps) seg(xMin, y, b.L, y, cout);
      seg(b.L, y, b.R, y, cin);
      if (xMax - b.R > eps) seg(b.R, y, xMax, y, cout);
    }
  }

  var _busy = false;

  function clearPreview() { removeLayer(PREVIEW_LAYER); app.redraw(); }

  function preview() {
    if (_busy) return; _busy = true;
    try {
      var o = readOpts();
      var L = getOrAddLayer(PREVIEW_LAYER);
      L.visible = true; L.locked = false;
      clearLayer(L);
      build(L, o);
      app.redraw();
    } catch (e) { alert("Preview error: " + e.message); }
    finally { _busy = false; }
  }

  function changed() {
    updateInfo();
    if (liveChk.value) preview();
  }

  function apply() {
    try {
      removeLayer(PREVIEW_LAYER);
      var o = readOpts();

      var olds = [];
      if (o.replace) {
        for (var i = 0; i < doc.layers.length; i++) {
          if (doc.layers[i].name.indexOf(LAYER_PREFIX) === 0) olds.push(doc.layers[i]);
        }
      }

      var L = doc.layers.add();
      L.name = LAYER_PREFIX + nowStamp();
      L.visible = true; L.locked = false;
      build(L, o);

      if (o.guides) {
        var items = L.pathItems;
        for (var j = items.length - 1; j >= 0; j--) { try { items[j].guides = true; } catch (e1) {} }
      }

      for (var k = 0; k < olds.length; k++) {
        try { olds[k].locked = false; olds[k].remove(); } catch (e2) {}
      }

      if (o.lock) { L.locked = true; }
      saveSettings(getValues());
      dlg.close(1);
    } catch (e) { alert("Apply error: " + e.message); }
  }

  resetBtn.onClick = function () { applyValues(DEF); changed(); };
  previewBtn.onClick = function () { updateInfo(); preview(); };
  cancelBtn.onClick = function () { removeLayer(PREVIEW_LAYER); dlg.close(0); };
  applyBtn.onClick = function () { apply(); };

  var _initial = loadSettings();
  applyValues(_initial);
  dlg.onShow = function () {
    try { unitDrop.selection = curUnit; } catch (e) {}
    updateInfo();
    if (liveChk.value) preview();
  };

  dlg.center();
  dlg.show();
})();