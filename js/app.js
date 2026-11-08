// ============================================================================
// Materialize Map Studio — editor de mapas por provincias para vídeos
// ============================================================================
import { COUNTRY_LIST } from './countries.js';
import {
  WORLD_W, WORLD_H, PROJECTIONS, parseGeoText, polygonFeatures, listFields, guessOwnerField, guessNameField,
  looksLonLat, mainBounds, buildProvinceTopology, buildModel, ownerMesh, projectLayer, layerPaths, parseWorldFile, sourceToWorld
} from './geo.js';
import { idbGet, idbSet } from './store.js';

// ---------------------------------------------------------------------------
// 1. Utilidades
// ---------------------------------------------------------------------------
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const uid = () => Math.random().toString(36).slice(2, 10);
const debounce = (fn, ms) => { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; };
const rgbCache = new Map();
function hexRgb(hex) {
  let v = rgbCache.get(hex);
  if (!v) {
    let h = (hex || '#000000').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16) || 0;
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, v);
  }
  return v;
}
const rgbHex = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const css = (r, g, b, a) => `rgba(${r | 0},${g | 0},${b | 0},${Math.round(a * 1000) / 1000})`;
function lerpHex(a, b, t) { const x = hexRgb(a), y = hexRgb(b); return rgbHex(lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)); }
function hashColor(str) {
  let x = 2166136261; for (const ch of str) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); } x >>>= 0;
  const h = x % 360, s = 0.3 + ((x >>> 9) % 30) / 100, l = 0.36 + ((x >>> 17) % 26) / 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbHex(f(0) * 255, f(8) * 255, f(4) * 255);
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const readText = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(f); });
const readDataURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
const nextTick = () => new Promise(r => setTimeout(r, 30));

function setStatus(msg, ms = 0) {
  $('status').textContent = msg || '';
  if (ms) { clearTimeout(setStatus.h); setStatus.h = setTimeout(() => { if ($('status').textContent === msg) $('status').textContent = ''; }, ms); }
}

// ---------------------------------------------------------------------------
// 2. Proyecto (todo lo que se guarda)
// ---------------------------------------------------------------------------
const DEFAULT_STYLE = {
  fillOpacity: 100, unowned: '#d9d2bf', unownedOp: 100,
  provBorder: '#000000', provBorderW: 0.6, provBorderOp: 40,
  countryBorder: '#121212', countryBorderW: 1.6,
  coast: '#203c58', coastW: 0.9,
  sea: '#7ea6c8', scaleLines: false
};
const FRAME_DEFAULTS = { dur: 3, trans: 0.8, fade: 2, light: 45, spread: 0, camT: 1.5 };

function defaultCountries() {
  const c = {};
  for (const { code, name, color } of COUNTRY_LIST) c[code] = { name, color };
  return c;
}

function emptyProject() {
  return {
    version: 1,
    out: { w: 1920, h: 1080, fps: 30 },
    topo: null, projCfg: null, owner0: [],
    groups: [], nextGroup: 1,
    countries: defaultCountries(),
    style: { ...DEFAULT_STYLE },
    bg: null, layers: [], assets: {},
    frames: []
  };
}

function newFrame(own) {
  return { id: uid(), ...FRAME_DEFAULTS, cam: null, own, col: {}, alp: {}, order: [], items: [] };
}
function cloneFrame(f) {
  return {
    ...f, cam: f.cam ? { ...f.cam } : null, own: f.own.slice(), col: { ...f.col }, alp: { ...f.alp },
    order: f.order.slice(), items: f.items.map(it => ({ ...it }))
  };
}

let P = emptyProject();

// Tiempo de ejecución (no se guarda)
const R = {
  provinces: [], inner: null, coast: null, N: 0, lods: [],
  meshCache: new WeakMap(), thumbs: new WeakMap(), imgs: new Map(), layerPaths: new Map(),
  groupIndex: null, bounds: [0, 0, WORLD_W, WORLD_H]
};

// Estado del editor
const E = {
  cur: 0, tool: 'paint', active: '', view: { x: WORLD_W / 2, y: WORLD_H / 2, z: 1 },
  sel: new Set(), selItem: null, hoverProv: -1,
  flashes: new Map(), drag: null, space: false,
  undo: [], redo: [], cow: new Set(), lastEditKey: '', lastEditTime: 0,
  fillsDirty: true, editRGBA: null, editCss: null, provDirty: new Set(),
  dirty: true, play: null, prevTool: 'paint'
};

const frame = () => P.frames[E.cur];

// ---------------------------------------------------------------------------
// 3. Deshacer / rehacer (copia al escribir de los fotogramas)
// ---------------------------------------------------------------------------
function snapshot() {
  return { frames: P.frames.slice(), countries: structuredClone(P.countries), groups: P.groups.slice(), nextGroup: P.nextGroup, cur: E.cur, layers: P.layers.slice(), bg: P.bg ? { ...P.bg } : null };
}
function beginEdit(key = '') {
  const now = performance.now();
  if (key && key === E.lastEditKey && now - E.lastEditTime < 1200) { E.lastEditTime = now; return; }
  E.undo.push(snapshot());
  if (E.undo.length > 80) E.undo.shift();
  E.redo = [];
  E.cow = new Set();
  E.lastEditKey = key; E.lastEditTime = now;
}
// Devuelve el fotograma i listo para modificar (lo clona una vez por edición)
function mutFrame(i = E.cur) {
  const f = P.frames[i];
  if (!E.cow.has(f)) { const c = cloneFrame(f); P.frames[i] = c; E.cow.add(c); return c; }
  return f;
}
function restore(s) {
  P.frames = s.frames.slice(); P.countries = s.countries; P.groups = s.groups; P.nextGroup = s.nextGroup;
  P.layers = s.layers; P.bg = s.bg;
  E.cur = clamp(s.cur, 0, P.frames.length - 1);
  E.cow = new Set(); E.lastEditKey = '';
  R.groupIndex = null; rebuildLayerPaths();
  if (E.selItem && !frame().items.some(i => i.id === E.selItem)) E.selItem = null;
  changed({ all: true });
}
function undo() { if (!E.undo.length) return; E.redo.push(snapshot()); restore(E.undo.pop()); setStatus('Deshecho', 1200); }
function redo() { if (!E.redo.length) return; E.undo.push(snapshot()); restore(E.redo.pop()); setStatus('Rehecho', 1200); }

// Notifica cambios -> redibujar, refrescar paneles y autoguardar
function changed(what = {}) {
  E.fillsDirty = true; E.dirty = true;
  if (what.all || what.countries) refreshCountries();
  if (what.all || what.frames) refreshFrames();
  if (what.all || what.item) refreshItemPanel();
  if (what.all || what.sel) refreshSelPanel();
  if (what.all || what.layers) refreshLayersUI();
  if (what.all) refreshFrameSettings();
  if (what.all || what.countries || what.colors) R.thumbs = new WeakMap();
  scheduleThumb();
  autosave();
}

// ---------------------------------------------------------------------------
// 4. Construcción del modelo
// ---------------------------------------------------------------------------
function buildRuntime() {
  if (!P.topo) { R.provinces = []; R.N = 0; R.inner = R.coast = null; R.lods = []; R.grid = null; return; }
  const m = buildModel(P.topo);
  R.provinces = m.provinces; R.inner = m.inner; R.coast = m.coast; R.N = m.provinces.length; R.lods = m.lods;
  R.bounds = mainBounds(R.provinces.map(p => p.bbox));
  buildGrid();
  R.meshCache = new WeakMap(); R.thumbs = new WeakMap(); R.groupIndex = null;
  rebuildLayerPaths();
  for (const id of Object.keys(P.assets)) ensureImg(id);
}
// Índice espacial (rejilla) para encontrar rápido la provincia bajo el ratón
function buildGrid() {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of R.provinces) { x0 = Math.min(x0, p.bbox[0]); y0 = Math.min(y0, p.bbox[1]); x1 = Math.max(x1, p.bbox[2]); y1 = Math.max(y1, p.bbox[3]); }
  const n = 128, cw = (x1 - x0) / n || 1, ch = (y1 - y0) / n || 1;
  const cells = Array.from({ length: n * n }, () => []);
  for (const p of R.provinces) {
    const a = clamp(Math.floor((p.bbox[0] - x0) / cw), 0, n - 1), b = clamp(Math.floor((p.bbox[2] - x0) / cw), 0, n - 1);
    const c = clamp(Math.floor((p.bbox[1] - y0) / ch), 0, n - 1), d = clamp(Math.floor((p.bbox[3] - y0) / ch), 0, n - 1);
    for (let j = c; j <= d; j++) for (let i = a; i <= b; i++) cells[j * n + i].push(p.i);
  }
  R.grid = { x0, y0, cw, ch, n, cells };
}
function rebuildLayerPaths() {
  R.layerPaths = new Map();
  for (const l of P.layers) R.layerPaths.set(l.id, layerPaths(l));
}
function ensureImg(id) {
  if (!id || !P.assets[id]) return null;
  let im = R.imgs.get(id);
  if (!im) { im = new Image(); im.onload = () => { E.dirty = true; }; im.src = P.assets[id]; R.imgs.set(id, im); }
  return im;
}

// Grupos
function groupMembers(p) {
  const g = P.groups[p];
  if (!g) return [p];
  if (!R.groupIndex) {
    R.groupIndex = new Map();
    P.groups.forEach((gid, i) => { if (gid) { if (!R.groupIndex.has(gid)) R.groupIndex.set(gid, []); R.groupIndex.get(gid).push(i); } });
  }
  return R.groupIndex.get(g) || [p];
}
const useGroups = ev => !(ev && ev.altKey) && !$('optIgnoreGroups').checked;

// ---------------------------------------------------------------------------
// 5. Colores de provincias
// ---------------------------------------------------------------------------
function provRGBA(f, p, out, o) {
  const own = f.own[p];
  let hex = f.col[p], a = f.alp[p] ?? 1;
  if (!hex && own && P.countries[own]) hex = P.countries[own].color;
  if (!hex) { hex = P.style.unowned; a *= P.style.unownedOp / 100; } else a *= P.style.fillOpacity / 100;
  const c = hexRgb(hex);
  out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = a;
}
function frameRGBA(f) {
  const out = new Float32Array(R.N * 4);
  for (let p = 0; p < R.N; p++) provRGBA(f, p, out, p * 4);
  return out;
}
function rgbaCssArray(rgba) {
  const out = new Array(R.N);
  for (let p = 0, o = 0; p < R.N; p++, o += 4) out[p] = rgba[o + 3] > 0.001 ? css(rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3]) : null;
  return out;
}
const lightOf = (rgba, o, light) => [lerp(rgba[o], 255, light), lerp(rgba[o + 1], 255, light), lerp(rgba[o + 2], 255, light)];

function ownSig(own) {
  let x = 2166136261;
  for (let i = 0; i < own.length; i++) { const s = own[i]; for (let j = 0; j < s.length; j++) { x ^= s.charCodeAt(j); x = Math.imul(x, 16777619); } x ^= 124; x = Math.imul(x, 16777619); }
  return x >>> 0;
}
// Frontera de países para un fotograma (cacheada)
function countryMesh(f, li = 0, allowStale = false) {
  if (!P.topo || !R.lods.length) return null;
  const sig = ownSig(f.own);
  let m = R.meshCache.get(f);
  if (!m) { m = new Map(); R.meshCache.set(f, m); }
  const c = m.get(li);
  if (c && c.sig === sig) return c.path;
  if (allowStale && R.lastMesh) { scheduleMesh(); return R.lastMesh; }
  const path = ownerMesh(R.lods[li].topo, f.own);
  m.set(li, { sig, path });
  R.lastMesh = path;
  return path;
}
// Nivel de detalle adecuado para una escala (píxeles reales por unidad de mundo)
function lodIndex(scale) {
  let li = 0;
  for (let k = 1; k < R.lods.length; k++) if (R.lods[k].minW * scale * scale <= 0.35) li = k;
  return li;
}
const scheduleMesh = debounce(() => { E.dirty = true; E.meshNow = true; }, 150);

// ---------------------------------------------------------------------------
// 6. Cámara
// ---------------------------------------------------------------------------
const DEFAULT_CAM = () => ({ x: WORLD_W / 2, y: WORLD_H / 2, z: Math.min(P.out.w / WORLD_W, P.out.h / WORLD_H) });
function effectiveCam(i) {
  for (let k = Math.min(i, P.frames.length - 1); k >= 0; k--) if (P.frames[k].cam) return { ...P.frames[k].cam };
  return DEFAULT_CAM();
}

// ---------------------------------------------------------------------------
// 7. Dibujo
// ---------------------------------------------------------------------------
const measureCtx = document.createElement('canvas').getContext('2d');
const hitCtx = document.createElement('canvas').getContext('2d');

function fontOf(it) { return `${it.italic ? 'italic ' : ''}${it.bold ? 'bold ' : ''}${it.size}px ${it.font}`; }
function textBox(it) {
  measureCtx.font = fontOf(it);
  try { measureCtx.letterSpacing = (it.spacing || 0) + 'px'; } catch (e) { /* sin soporte */ }
  const lines = String(it.text).split('\n');
  let w = 0;
  for (const l of lines) w = Math.max(w, measureCtx.measureText(l).width);
  const lh = it.size * 1.15;
  return { w: Math.max(w, it.size * 0.5), h: lh * lines.length, lines, lh };
}
function itemHalf(it) {
  if (it.type === 'image') return [it.w / 2, it.h / 2];
  const b = textBox(it); return [b.w / 2, b.h / 2];
}

function drawItem(ctx, it) {
  if (it.opacity <= 0) return;
  ctx.save();
  ctx.translate(it.x, it.y);
  if (it.rot) ctx.rotate(it.rot * Math.PI / 180);
  ctx.globalAlpha = clamp(it.opacity, 0, 1);
  if (it.type === 'image') {
    const im = ensureImg(it.asset);
    if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -it.w / 2, -it.h / 2, it.w, it.h);
  } else {
    const b = textBox(it);
    ctx.font = fontOf(it);
    try { ctx.letterSpacing = (it.spacing || 0) + 'px'; } catch (e) { /* */ }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    b.lines.forEach((l, k) => {
      const y = -b.h / 2 + b.lh * (k + 0.5);
      if (it.strokeW > 0) { ctx.strokeStyle = it.stroke; ctx.lineWidth = it.strokeW * 2; ctx.strokeText(l, 0, y); }
      ctx.fillStyle = it.color; ctx.fillText(l, 0, y);
    });
  }
  ctx.restore();
}

/**
 * Dibuja la escena en coordenadas de salida (P.out.w x P.out.h) escaladas por k0.
 * st = { cam, fills (array css|null), mesh (Path2D), items, editor (bool) }
 */
function drawScene(ctx, k0, st) {
  const W = P.out.w, H = P.out.h, S = P.style, cam = st.cam, z = cam.z;
  ctx.setTransform(k0, 0, 0, k0, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = S.sea; ctx.fillRect(0, 0, W, H);
  const wt = [k0 * z, 0, 0, k0 * z, k0 * (W / 2 - cam.x * z), k0 * (H / 2 - cam.y * z)];
  ctx.setTransform(...wt);
  const vx0 = cam.x - W / 2 / z, vx1 = cam.x + W / 2 / z, vy0 = cam.y - H / 2 / z, vy1 = cam.y + H / 2 / z;
  const lw = px => S.scaleLines ? px : px / z;
  const li = lodIndex(k0 * z), L = R.lods[li] || { paths: [], inner: null, coast: null };
  st.li = li;
  const mesh = st.mesh !== undefined ? st.mesh : st.meshFrame ? countryMesh(st.meshFrame, li, st.staleOk) : null;

  // Fondo
  if (P.bg && P.bg.visible && P.bg.asset) {
    const im = ensureImg(P.bg.asset);
    if (im && im.complete && im.naturalWidth) {
      ctx.globalAlpha = P.bg.opacity / 100;
      ctx.drawImage(im, P.bg.x0, P.bg.y0, P.bg.x1 - P.bg.x0, P.bg.y1 - P.bg.y0);
      ctx.globalAlpha = 1;
    }
  }
  // Provincias
  const fills = st.fills;
  if (fills) {
    for (let p = 0; p < R.N; p++) {
      const c = fills[p]; if (!c) continue;
      const b = R.provinces[p].bbox;
      if (b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1) continue;
      ctx.fillStyle = c; ctx.fill(L.paths[p], 'evenodd');
    }
  }
  // Capas extra
  for (const l of P.layers) {
    if (!l.visible) continue;
    const lp = R.layerPaths.get(l.id); if (!lp) continue;
    if (lp.hasPolys && l.fillOp > 0) { ctx.globalAlpha = l.fillOp / 100; ctx.fillStyle = l.fill; ctx.fill(lp.polys, 'evenodd'); ctx.globalAlpha = 1; }
    if (l.width > 0) {
      ctx.strokeStyle = l.stroke; ctx.lineWidth = lw(l.width); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (lp.hasLines) ctx.stroke(lp.lines);
      if (lp.hasPolys && l.outline) ctx.stroke(lp.polys);
    }
  }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (L.inner && S.provBorderW > 0 && S.provBorderOp > 0 && !st.thumb) {
    ctx.globalAlpha = S.provBorderOp / 100; ctx.strokeStyle = S.provBorder; ctx.lineWidth = lw(S.provBorderW); ctx.stroke(L.inner); ctx.globalAlpha = 1;
  }
  if (mesh && S.countryBorderW > 0) { ctx.strokeStyle = S.countryBorder; ctx.lineWidth = lw(S.countryBorderW); ctx.stroke(mesh); }
  if (L.coast && S.coastW > 0) { ctx.strokeStyle = S.coast; ctx.lineWidth = lw(S.coastW); ctx.stroke(L.coast); }

  if (st.editor) drawEditorProvinceOverlay(ctx, z, L);

  // Textos e imágenes
  for (const it of st.items || []) {
    if (it.screen) ctx.setTransform(k0, 0, 0, k0, 0, 0); else ctx.setTransform(...wt);
    drawItem(ctx, it);
  }
  if (st.editor) drawEditorItemOverlay(ctx, k0, wt, z);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function drawEditorProvinceOverlay(ctx, z, L) {
  // Hover (grupo completo)
  if (E.hoverProv >= 0 && !E.drag && (E.tool === 'paint' || E.tool === 'erase' || E.tool === 'select' || E.tool === 'pick')) {
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5 / z;
    for (const q of (useGroups() ? groupMembers(E.hoverProv) : [E.hoverProv])) ctx.stroke(L.paths[q]);
  }
  if (E.sel.size) {
    ctx.lineWidth = 3.2 / z; ctx.strokeStyle = 'rgba(0,0,0,.8)';
    for (const p of E.sel) ctx.stroke(L.paths[p]);
    ctx.lineWidth = 1.6 / z; ctx.strokeStyle = '#ffe14d';
    for (const p of E.sel) ctx.stroke(L.paths[p]);
  }
  if (E.drag && E.drag.kind === 'rect') {
    const d = E.drag;
    ctx.setLineDash([6 / z, 4 / z]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2 / z;
    ctx.strokeRect(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
    ctx.setLineDash([]);
  }
}

function drawEditorItemOverlay(ctx, k0, wt, z) {
  const it = frame()?.items.find(i => i.id === E.selItem);
  if (!it) return;
  if (it.screen) ctx.setTransform(k0, 0, 0, k0, 0, 0); else ctx.setTransform(...wt);
  const s = it.screen ? 1 : z;
  const [hw, hh] = itemHalf(it);
  ctx.save();
  ctx.translate(it.x, it.y); if (it.rot) ctx.rotate(it.rot * Math.PI / 180);
  ctx.setLineDash([5 / s, 4 / s]); ctx.strokeStyle = '#4da3ff'; ctx.lineWidth = 1.4 / s;
  ctx.strokeRect(-hw - 4 / s, -hh - 4 / s, hw * 2 + 8 / s, hh * 2 + 8 / s);
  ctx.setLineDash([]);
  const hs = 10 / s;
  ctx.fillStyle = '#4da3ff'; ctx.strokeStyle = '#fff';
  ctx.fillRect(hw + 4 / s - hs / 2, hh + 4 / s - hs / 2, hs, hs); ctx.strokeRect(hw + 4 / s - hs / 2, hh + 4 / s - hs / 2, hs, hs);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 8. Lienzo del editor
// ---------------------------------------------------------------------------
const cv = $('cv');
const cx = cv.getContext('2d');
const V = { cssW: 1, cssH: 1, dpr: 1, outScale: 1 };

function layoutCanvas() {
  const wrap = $('viewWrap');
  const W = wrap.clientWidth - 16, H = wrap.clientHeight - 16, a = P.out.w / P.out.h;
  let w = W, h = W / a; if (h > H) { h = H; w = H * a; }
  w = Math.max(50, Math.floor(w)); h = Math.max(30, Math.floor(h));
  V.cssW = w; V.cssH = h; V.dpr = window.devicePixelRatio || 1; V.outScale = w / P.out.w;
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  cv.style.left = Math.floor((wrap.clientWidth - w) / 2) + 'px'; cv.style.top = Math.floor((wrap.clientHeight - h) / 2) + 'px';
  cv.width = Math.round(w * V.dpr); cv.height = Math.round(h * V.dpr);
  E.dirty = true;
}
new ResizeObserver(layoutCanvas).observe($('viewWrap'));

function evToOut(ev) { const r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) / V.outScale, (ev.clientY - r.top) / V.outScale]; }
function outToWorld([ox, oy], cam = E.view) { return [(ox - P.out.w / 2) / cam.z + cam.x, (oy - P.out.h / 2) / cam.z + cam.y]; }

function editorFills() {
  const f = frame();
  if (E.fillsDirty || !E.editRGBA || E.editRGBA.length !== R.N * 4) {
    E.editRGBA = frameRGBA(f); E.editCss = rgbaCssArray(E.editRGBA); E.fillsDirty = false; E.provDirty.clear();
  } else if (E.provDirty.size) {
    const A = E.editRGBA;
    for (const p of E.provDirty) { const o = p * 4; provRGBA(f, p, A, o); E.editCss[p] = A[o + 3] > 0.001 ? css(A[o], A[o + 1], A[o + 2], A[o + 3]) : null; }
    E.provDirty.clear();
  }
  if (!E.flashes.size) return E.editCss;
  const out = E.editCss.slice(), now = performance.now(), fade = Math.max(0.05, f.fade) * 1000, light = f.light / 100;
  for (const [p, t0] of E.flashes) {
    const t = (now - t0) / fade;
    if (t >= 1 || f.fade <= 0) { E.flashes.delete(p); continue; }
    const o = p * 4, A = E.editRGBA, L = lightOf(A, o, light), e = ease(t);
    out[p] = css(lerp(L[0], A[o], e), lerp(L[1], A[o + 1], e), lerp(L[2], A[o + 2], e), A[o + 3]);
  }
  E.dirty = true;
  return out;
}

function renderEditor() {
  const k0 = V.dpr * V.outScale;
  if (E.play) { drawScene(cx, k0, playState(E.play.t)); return; }
  if (!P.frames.length) {
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.fillStyle = P.style.sea; cx.fillRect(0, 0, cv.width, cv.height); return;
  }
  const f = frame();
  const painting = E.drag && (E.drag.kind === 'paint');
  drawScene(cx, k0, { cam: E.view, fills: editorFills(), meshFrame: f, staleOk: painting && !E.meshNow, items: f.items, editor: true });
  E.meshNow = false;
}

function loop() {
  if (E.play) { stepPlay(); E.dirty = true; }
  if (E.dirty) { E.dirty = false; renderEditor(); }
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------------
// 9. Búsqueda (hit test)
// ---------------------------------------------------------------------------
function provAt(x, y) {
  let best = -1, bestA = Infinity;
  const G = R.grid; if (!G) return -1;
  const i = Math.floor((x - G.x0) / G.cw), j = Math.floor((y - G.y0) / G.ch);
  if (i < 0 || j < 0 || i >= G.n || j >= G.n) return -1;
  for (const p of G.cells[j * G.n + i]) {
    const pr = R.provinces[p], b = pr.bbox;
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
    if (hitCtx.isPointInPath(pr.path, x, y, 'evenodd') && pr.area < bestA) { best = p; bestA = pr.area; }
  }
  return best;
}
// Devuelve {it, handle} del elemento bajo el puntero (de arriba abajo)
function itemAt(outPt) {
  const items = frame()?.items || [];
  const z = E.view.z;
  for (let k = items.length - 1; k >= 0; k--) {
    const it = items[k];
    const [px, py] = it.screen ? outPt : outToWorld(outPt);
    const s = it.screen ? 1 : z;
    const a = -(it.rot || 0) * Math.PI / 180;
    const dx = px - it.x, dy = py - it.y;
    const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
    const [hw, hh] = itemHalf(it);
    const m = 4 / s;
    if (it.id === E.selItem && Math.abs(lx - (hw + m)) < 9 / s && Math.abs(ly - (hh + m)) < 9 / s) return { it, handle: true };
    if (Math.abs(lx) <= hw + m && Math.abs(ly) <= hh + m) return { it, handle: false };
  }
  return null;
}

// ---------------------------------------------------------------------------
// 10. Edición de provincias
// ---------------------------------------------------------------------------
function setOwner(f, p, code) {
  if (f.own[p] === code && !f.col[p]) return false;
  const conquered = f.own[p] !== code;
  f.own[p] = code; delete f.col[p];
  if (conquered && code) { if (!f.order.includes(p)) f.order.push(p); E.flashes.set(p, performance.now()); }
  if (!code) { const k = f.order.indexOf(p); if (k >= 0) f.order.splice(k, 1); }
  return true;
}
function paintAt(world, ev) {
  const p = provAt(world[0], world[1]);
  if (p < 0) return;
  const code = E.tool === 'erase' ? '' : E.active;
  if (E.tool === 'paint' && !code) { setStatus('Elige un país en la lista de la derecha', 2500); return; }
  const f = mutFrame();
  let any = false;
  for (const q of (useGroups(ev) ? groupMembers(p) : [p])) if (setOwner(f, q, code)) { any = true; E.provDirty.add(q); }
  if (any) E.dirty = true;
}

function selectionAction(fn, key) {
  if (!E.sel.size) return;
  beginEdit(key);
  const f = mutFrame();
  for (const p of E.sel) fn(f, p);
  changed({ countries: true, sel: true });
}

// ---------------------------------------------------------------------------
// 11. Interacción con el ratón
// ---------------------------------------------------------------------------
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', ev => {
  if (!P.frames.length || E.play) return;
  cv.setPointerCapture(ev.pointerId);
  const out = evToOut(ev), w = outToWorld(out);
  const panning = ev.button === 1 || ev.button === 2 || E.space || E.tool === 'pan';
  if (panning) { E.drag = { kind: 'pan', sx: ev.clientX, sy: ev.clientY, vx: E.view.x, vy: E.view.y }; cv.style.cursor = 'grabbing'; return; }
  if (ev.button !== 0) return;

  switch (E.tool) {
    case 'paint': case 'erase':
      beginEdit('stroke' + uid());
      E.drag = { kind: 'paint', last: w };
      paintAt(w, ev);
      break;
    case 'pick': {
      const p = provAt(w[0], w[1]);
      if (p >= 0) {
        const code = frame().own[p];
        if (code) { setActive(code); setStatus('País activo: ' + countryName(code), 2000); setTool(E.prevTool === 'pick' ? 'paint' : E.prevTool); }
      }
      break;
    }
    case 'text': {
      beginEdit();
      const f = mutFrame();
      const it = {
        id: uid(), type: 'text', x: w[0], y: w[1], text: 'Nombre', size: Math.round(26 / E.view.z * 10) / 10, font: 'Georgia, serif',
        color: '#ffffff', stroke: '#000000', strokeW: 2.5 / E.view.z, bold: true, italic: false, spacing: 0, rot: 0, opacity: 1, screen: false
      };
      f.items.push(it); E.selItem = it.id; E.sel.clear();
      setTool('select');
      changed({ item: true, sel: true });
      setTimeout(() => { $('ipText').focus(); $('ipText').select(); }, 30);
      break;
    }
    case 'bg':
      if (P.bg) { beginEdit('bgmove'); E.drag = { kind: 'bg', w0: w, b: { ...P.bg } }; }
      break;
    case 'select': default: {
      const hit = itemAt(out);
      if (hit) {
        beginEdit('item-' + hit.it.id + uid());
        E.selItem = hit.it.id; E.sel.clear();
        const p0 = hit.it.screen ? out : w;
        E.drag = hit.handle
          ? { kind: 'resize', id: hit.it.id, orig: { ...hit.it }, d0: Math.hypot(p0[0] - hit.it.x, p0[1] - hit.it.y) || 1 }
          : { kind: 'move', id: hit.it.id, orig: { ...hit.it }, p0 };
        changed({ item: true, sel: true });
        return;
      }
      if (E.selItem) { E.selItem = null; refreshItemPanel(); }
      E.drag = { kind: 'rect', x0: w[0], y0: w[1], x1: w[0], y1: w[1], moved: false, shift: ev.shiftKey, ev };
    }
  }
  E.dirty = true;
});

cv.addEventListener('pointermove', ev => {
  if (!P.frames.length || E.play) return;
  const out = evToOut(ev), w = outToWorld(out);
  const d = E.drag;
  if (!d) {
    const p = provAt(w[0], w[1]);
    if (p !== E.hoverProv) {
      E.hoverProv = p; E.dirty = true;
      if (p >= 0) {
        const own = frame().own[p], g = P.groups[p];
        $('hover').textContent = `${R.provinces[p].name} — ${own ? countryName(own) : 'sin dueño'}${g ? ' · grupo ' + g : ''}`;
      } else $('hover').textContent = '';
    }
    cv.style.cursor = E.tool === 'pan' || E.space ? 'grab' : E.tool === 'select' && itemAt(out) ? 'move' : 'crosshair';
    return;
  }
  switch (d.kind) {
    case 'pan':
      E.view.x = d.vx - (ev.clientX - d.sx) / V.outScale / E.view.z;
      E.view.y = d.vy - (ev.clientY - d.sy) / V.outScale / E.view.z;
      break;
    case 'paint': {
      // Interpolar para trazos rápidos
      const dist = Math.hypot(w[0] - d.last[0], w[1] - d.last[1]) * E.view.z;
      const steps = Math.min(40, Math.ceil(dist / 4));
      for (let s = 1; s <= steps; s++) paintAt([lerp(d.last[0], w[0], s / steps), lerp(d.last[1], w[1], s / steps)], ev);
      d.last = w;
      break;
    }
    case 'move': {
      const f = mutFrame(), it = f.items.find(i => i.id === d.id); if (!it) break;
      const p = it.screen ? out : w;
      it.x = d.orig.x + p[0] - d.p0[0]; it.y = d.orig.y + p[1] - d.p0[1];
      break;
    }
    case 'resize': {
      const f = mutFrame(), it = f.items.find(i => i.id === d.id); if (!it) break;
      const p = it.screen ? out : w;
      const k = Math.max(0.05, Math.hypot(p[0] - it.x, p[1] - it.y) / d.d0);
      if (it.type === 'image') { it.w = Math.max(2, d.orig.w * k); it.h = Math.max(2, d.orig.h * k); }
      else { it.size = Math.max(1, d.orig.size * k); it.strokeW = d.orig.strokeW * k; }
      refreshItemPanel();
      break;
    }
    case 'bg': {
      const dx = w[0] - d.w0[0], dy = w[1] - d.w0[1];
      P.bg.x0 = d.b.x0 + dx; P.bg.x1 = d.b.x1 + dx; P.bg.y0 = d.b.y0 + dy; P.bg.y1 = d.b.y1 + dy;
      break;
    }
    case 'rect':
      d.x1 = w[0]; d.y1 = w[1];
      if (Math.abs(d.x1 - d.x0) * E.view.z > 4 || Math.abs(d.y1 - d.y0) * E.view.z > 4) d.moved = true;
      break;
  }
  E.dirty = true;
});

function endDrag(ev) {
  const d = E.drag; if (!d) return;
  E.drag = null; cv.style.cursor = 'crosshair';
  if (d.kind === 'paint') { E.meshNow = true; const keep = E.fillsDirty; changed({ countries: true }); E.fillsDirty = keep; }
  else if (d.kind === 'move' || d.kind === 'resize') changed({ item: true });
  else if (d.kind === 'bg') { refreshLayersUI(); autosave(); }
  else if (d.kind === 'rect') {
    if (!d.moved) {
      const p = provAt(d.x0, d.y0);
      if (p >= 0) {
        const members = useGroups(d.ev) ? groupMembers(p) : [p];
        if (d.shift) { const has = E.sel.has(p); members.forEach(q => has ? E.sel.delete(q) : E.sel.add(q)); }
        else { E.sel = new Set(members); }
      } else if (!d.shift) E.sel.clear();
    } else {
      const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
      if (!d.shift) E.sel.clear();
      for (const pr of R.provinces) if (pr.cx >= x0 && pr.cx <= x1 && pr.cy >= y0 && pr.cy <= y1) E.sel.add(pr.i);
    }
    refreshSelPanel();
  }
  E.dirty = true;
}
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);
cv.addEventListener('pointerleave', () => { if (!E.drag) { E.hoverProv = -1; $('hover').textContent = ''; E.dirty = true; } });

cv.addEventListener('dblclick', ev => {
  if (E.tool !== 'select') return;
  const w = outToWorld(evToOut(ev)), p = provAt(w[0], w[1]);
  if (p < 0) return;
  selectCountryOf(frame().own[p], p);
});
function selectCountryOf(code, fallback) {
  const f = frame();
  E.sel = new Set();
  if (code) f.own.forEach((o, i) => { if (o === code) E.sel.add(i); });
  else if (fallback >= 0) E.sel.add(fallback);
  refreshSelPanel(); E.dirty = true;
}

cv.addEventListener('wheel', ev => {
  ev.preventDefault();
  if (!P.frames.length || E.play) return;
  const out = evToOut(ev);
  // Ctrl + rueda sobre el elemento seleccionado = cambiar tamaño
  if (ev.ctrlKey && E.selItem) {
    const hit = itemAt(out);
    if (hit && hit.it.id === E.selItem) {
      beginEdit('wheel-size');
      const it = mutFrame().items.find(i => i.id === E.selItem), k = ev.deltaY < 0 ? 1.08 : 1 / 1.08;
      if (it.type === 'image') { it.w *= k; it.h *= k; } else { it.size *= k; it.strokeW *= k; }
      changed({ item: true });
      return;
    }
  }
  const before = outToWorld(out);
  const k = Math.exp(-ev.deltaY * (ev.deltaMode ? 0.05 : 0.0015));
  E.view.z = clamp(E.view.z * k, 0.05, 400);
  const after = outToWorld(out);
  E.view.x += before[0] - after[0]; E.view.y += before[1] - after[1];
  E.dirty = true;
}, { passive: false });

// ---------------------------------------------------------------------------
// 12. Herramientas y paneles izquierdos
// ---------------------------------------------------------------------------
const TOOL_HELP = {
  paint: 'Arrastra sobre las provincias para pintarlas con el país activo. Las conquistas aparecen en tono claro y se oscurecen. Alt = ignorar grupos.',
  select: 'Clic: seleccionar provincia/grupo. Mayús: añadir. Arrastrar: rectángulo. Doble clic: país entero. Clic en un texto/imagen para moverlo; esquina azul o Ctrl+rueda para cambiar tamaño.',
  erase: 'Arrastra para dejar provincias sin dueño.',
  pick: 'Clic en una provincia para elegir su país como país activo.',
  text: 'Clic en el mapa para añadir un texto (ciudades, regiones, títulos…).',
  image: 'Elige una imagen (bandera, icono, flecha…). Aparecerá en el centro de la vista.',
  pan: 'Arrastra para mover la vista. Rueda: zoom. También: Espacio + arrastrar o botón derecho.',
  bg: 'Arrastra para mover la imagen de fondo y alinearla con las provincias.'
};
function setTool(t) {
  if (t === 'image') { $('fileImage').click(); return; }
  if (t !== E.tool) E.prevTool = E.tool;
  E.tool = t;
  document.querySelectorAll('#tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  $('toolHelp').textContent = TOOL_HELP[t] || '';
  E.dirty = true;
}
document.querySelectorAll('#tools button').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));

$('fileImage').addEventListener('change', async ev => {
  const file = ev.target.files[0]; ev.target.value = '';
  if (!file || !P.frames.length) return;
  const data = await readDataURL(file);
  const id = 'img_' + uid();
  P.assets[id] = data;
  const im = ensureImg(id);
  await new Promise(r => { if (im.complete) r(); else { im.onload = r; im.onerror = r; } });
  const maxW = 260 / E.view.z, ratio = (im.naturalHeight || 1) / (im.naturalWidth || 1);
  const w = Math.min(maxW, (im.naturalWidth || 200) / E.view.z);
  beginEdit();
  const it = { id: uid(), type: 'image', asset: id, x: E.view.x, y: E.view.y, w, h: w * ratio, rot: 0, opacity: 1, screen: false };
  mutFrame().items.push(it);
  E.selItem = it.id; E.sel.clear();
  setTool('select');
  changed({ item: true, sel: true });
});

// --- Panel de selección ---
function refreshSelPanel() {
  const n = E.sel.size;
  $('selPanel').hidden = n === 0;
  if (!n) return;
  $('selCount').textContent = n;
  const names = [...E.sel].slice(0, 12).map(p => R.provinces[p].name);
  $('selNames').textContent = names.join(', ') + (n > 12 ? '…' : '');
  const f = frame(), first = [...E.sel][0];
  $('selAlpha').value = Math.round((f.alp[first] ?? 1) * 100);
  $('selAlphaVal').textContent = $('selAlpha').value + '%';
}
$('selAssign').onclick = () => { if (!E.active) return setStatus('Elige un país primero', 2000); selectionAction((f, p) => setOwner(f, p, E.active)); E.meshNow = true; };
$('selUnown').onclick = () => { selectionAction((f, p) => setOwner(f, p, '')); E.meshNow = true; };
$('selColorApply').onclick = () => selectionAction((f, p) => { f.col[p] = $('selColor').value; });
$('selColor').addEventListener('input', () => selectionAction((f, p) => { f.col[p] = $('selColor').value; }, 'selcolor'));
$('selColorClear').onclick = () => selectionAction((f, p) => { delete f.col[p]; });
$('selAlpha').addEventListener('input', () => {
  const a = +$('selAlpha').value / 100;
  $('selAlphaVal').textContent = $('selAlpha').value + '%';
  selectionAction((f, p) => { if (a >= 1) delete f.alp[p]; else f.alp[p] = a; }, 'selalpha');
});
function groupSelection() {
  if (E.sel.size < 2) return setStatus('Selecciona al menos 2 provincias para agrupar', 2500);
  beginEdit();
  P.groups = P.groups.slice();
  const g = P.nextGroup++;
  for (const p of E.sel) P.groups[p] = g;
  R.groupIndex = null;
  setStatus(`Grupo ${g} creado (${E.sel.size} provincias)`, 2500);
  changed({ sel: true });
}
function ungroupSelection() {
  if (!E.sel.size) return;
  beginEdit();
  P.groups = P.groups.slice();
  for (const p of E.sel) P.groups[p] = 0;
  R.groupIndex = null;
  setStatus('Provincias desagrupadas', 2000);
  changed({ sel: true });
}
$('selGroup').onclick = groupSelection;
$('selUngroup').onclick = ungroupSelection;
$('selCountry').onclick = () => { const p = [...E.sel][0]; selectCountryOf(frame().own[p], p); };
$('selClear').onclick = () => { E.sel.clear(); refreshSelPanel(); E.dirty = true; };
$('selPropagate').onclick = () => {
  if (!E.sel.size || E.cur >= P.frames.length - 1) return setStatus('No hay fotogramas siguientes', 2000);
  beginEdit();
  const src = frame();
  for (let i = E.cur + 1; i < P.frames.length; i++) {
    const f = mutFrame(i);
    for (const p of E.sel) {
      f.own[p] = src.own[p];
      if (src.col[p]) f.col[p] = src.col[p]; else delete f.col[p];
      if (src.alp[p] != null) f.alp[p] = src.alp[p]; else delete f.alp[p];
    }
  }
  setStatus(`Aplicado a ${P.frames.length - 1 - E.cur} fotogramas`, 2500);
  changed({ frames: true });
};

// --- Panel de elementos (texto / imagen) ---
const selectedItem = () => frame()?.items.find(i => i.id === E.selItem) || null;
function refreshItemPanel() {
  const it = selectedItem();
  $('itemPanel').hidden = !it;
  if (!it) return;
  const isText = it.type === 'text';
  $('itemTitle').textContent = isText ? 'Texto' : 'Imagen';
  $('textProps').hidden = !isText; $('imgProps').hidden = isText;
  const set = (id, v) => { const el = $(id); if (document.activeElement !== el) { if (el.type === 'checkbox') el.checked = !!v; else el.value = v; } };
  if (isText) {
    set('ipText', it.text); set('ipFont', it.font); set('ipSize', Math.round(it.size * 10) / 10); set('ipColor', it.color);
    set('ipStroke', it.stroke); set('ipStrokeW', Math.round(it.strokeW * 10) / 10); set('ipBold', it.bold); set('ipItalic', it.italic); set('ipSpacing', it.spacing || 0);
  } else { set('ipW', Math.round(it.w)); set('ipH', Math.round(it.h)); }
  set('ipRot', it.rot || 0); $('ipRotVal').textContent = Math.round(it.rot || 0) + '°';
  set('ipOpacity', Math.round(it.opacity * 100)); $('ipOpVal').textContent = Math.round(it.opacity * 100) + '%';
  set('ipScreen', it.screen);
}
function itemEdit(fn, key) {
  if (!selectedItem()) return;
  beginEdit(key);
  const it = mutFrame().items.find(i => i.id === E.selItem);
  fn(it);
  changed({ item: true });
}
const bindItem = (id, fn, evt = 'input') => $(id).addEventListener(evt, () => itemEdit(it => fn(it, $(id)), 'ip-' + id + E.selItem));
bindItem('ipText', (it, el) => { it.text = el.value; });
bindItem('ipFont', (it, el) => { it.font = el.value; }, 'change');
bindItem('ipSize', (it, el) => { const v = +el.value; if (v > 0) { it.strokeW *= v / it.size; it.size = v; } });
bindItem('ipColor', (it, el) => { it.color = el.value; });
bindItem('ipStroke', (it, el) => { it.stroke = el.value; });
bindItem('ipStrokeW', (it, el) => { it.strokeW = Math.max(0, +el.value); });
bindItem('ipBold', (it, el) => { it.bold = el.checked; }, 'change');
bindItem('ipItalic', (it, el) => { it.italic = el.checked; }, 'change');
bindItem('ipSpacing', (it, el) => { it.spacing = +el.value; });
bindItem('ipW', (it, el) => { const v = +el.value; if (v > 0) { if ($('ipKeep').checked) it.h *= v / it.w; it.w = v; } });
bindItem('ipH', (it, el) => { const v = +el.value; if (v > 0) { if ($('ipKeep').checked) it.w *= v / it.h; it.h = v; } });
bindItem('ipRot', (it, el) => { it.rot = +el.value; });
bindItem('ipOpacity', (it, el) => { it.opacity = +el.value / 100; });
bindItem('ipScreen', (it, el) => {
  // Convertir posición/tamaño entre mundo y pantalla para que no salte
  const cam = E.view, s = cam.z;
  if (el.checked && !it.screen) {
    it.x = (it.x - cam.x) * s + P.out.w / 2; it.y = (it.y - cam.y) * s + P.out.h / 2;
    if (it.type === 'image') { it.w *= s; it.h *= s; } else { it.size *= s; it.strokeW *= s; }
  } else if (!el.checked && it.screen) {
    [it.x, it.y] = outToWorld([it.x, it.y]);
    if (it.type === 'image') { it.w /= s; it.h /= s; } else { it.size /= s; it.strokeW /= s; }
  }
  it.screen = el.checked;
}, 'change');
$('ipDel').onclick = deleteSelectedItem;
function deleteSelectedItem() {
  if (!selectedItem()) return;
  beginEdit();
  const f = mutFrame(); f.items = f.items.filter(i => i.id !== E.selItem); E.selItem = null;
  changed({ item: true });
}
$('ipDup').onclick = duplicateItem;
function duplicateItem() {
  const it = selectedItem(); if (!it) return;
  beginEdit();
  const c = { ...it, id: uid(), x: it.x + 20 / (it.screen ? 1 : E.view.z), y: it.y + 20 / (it.screen ? 1 : E.view.z) };
  mutFrame().items.push(c); E.selItem = c.id;
  changed({ item: true });
}
$('ipFront').onclick = () => itemEdit(() => { const f = frame(), k = f.items.findIndex(i => i.id === E.selItem); f.items.push(...f.items.splice(k, 1)); });
$('ipBack').onclick = () => itemEdit(() => { const f = frame(), k = f.items.findIndex(i => i.id === E.selItem); f.items.unshift(...f.items.splice(k, 1)); });
$('ipPropagate').onclick = () => {
  const it = selectedItem(); if (!it) return;
  if (E.cur >= P.frames.length - 1) return setStatus('No hay fotogramas siguientes', 2000);
  beginEdit();
  for (let i = E.cur + 1; i < P.frames.length; i++) {
    const f = mutFrame(i), k = f.items.findIndex(x => x.id === it.id);
    if (k >= 0) f.items[k] = { ...it }; else f.items.push({ ...it });
  }
  setStatus('Elemento copiado a los fotogramas siguientes', 2500);
  changed({ frames: true });
};
$('ipRemoveNext').onclick = () => {
  const it = selectedItem(); if (!it) return;
  beginEdit();
  for (let i = E.cur + 1; i < P.frames.length; i++) { const f = mutFrame(i); f.items = f.items.filter(x => x.id !== it.id); }
  setStatus('Quitado de los fotogramas siguientes', 2500);
  changed({ frames: true });
};

// ---------------------------------------------------------------------------
// 13. Países
// ---------------------------------------------------------------------------
const countryName = code => P.countries[code]?.name || code;
function setActive(code) {
  E.active = code;
  const c = P.countries[code];
  $('acSwatch').style.background = c ? c.color : 'transparent';
  $('acName').textContent = c ? c.name : '—';
  document.querySelectorAll('.crow').forEach(r => r.classList.toggle('active', r.dataset.code === code));
}
function ensureCountry(code, name) {
  if (!code || P.countries[code]) return;
  P.countries[code] = { name: name || code, color: hashColor(code), custom: true };
}

const refreshCountries = debounce(renderCountryList, 60);
function renderCountryList() {
  const list = $('cList');
  const q = $('cSearch').value.trim().toLowerCase();
  const only = $('cOnlyMap').checked;
  const counts = new Map();
  if (frame()) for (const o of frame().own) if (o) counts.set(o, (counts.get(o) || 0) + 1);
  const inMap = new Set([...counts.keys(), ...P.owner0]);
  const codes = Object.keys(P.countries)
    .filter(c => !q || P.countries[c].name.toLowerCase().includes(q) || c.toLowerCase().includes(q))
    .filter(c => !only || q || inMap.has(c) || P.countries[c].custom || c === E.active)
    .sort((a, b) => P.countries[a].name.localeCompare(P.countries[b].name, 'es'));
  const frag = document.createDocumentFragment();
  for (const code of codes) {
    const c = P.countries[code];
    const row = document.createElement('div');
    row.className = 'crow' + (code === E.active ? ' active' : '');
    row.dataset.code = code;
    row.title = `${c.name} (${code}) — clic para pintar con este país`;
    const col = document.createElement('input'); col.type = 'color'; col.value = c.color;
    col.addEventListener('click', e => e.stopPropagation());
    col.addEventListener('input', () => {
      beginEdit('ccolor-' + code);
      P.countries = { ...P.countries, [code]: { ...P.countries[code], color: col.value } };
      if (code === E.active) $('acSwatch').style.background = col.value;
      E.fillsDirty = true; E.dirty = true;
      R.thumbs = new WeakMap(); scheduleThumb(); autosave();
    });
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = c.name;
    nm.addEventListener('dblclick', e => {
      e.stopPropagation();
      const v = prompt('Nuevo nombre del país', c.name);
      if (v && v.trim()) { beginEdit(); P.countries = { ...P.countries, [code]: { ...c, name: v.trim() } }; changed({ countries: true }); setActive(E.active); }
    });
    const cnt = document.createElement('span'); cnt.className = 'cnt'; cnt.textContent = counts.get(code) || '';
    const selB = document.createElement('button'); selB.className = 'ib'; selB.textContent = '◎'; selB.title = 'Seleccionar sus provincias';
    selB.addEventListener('click', e => { e.stopPropagation(); setTool('select'); selectCountryOf(code, -1); });
    row.append(col, nm, cnt, selB);
    if (c.custom && !counts.get(code)) {
      const del = document.createElement('button'); del.className = 'ib'; del.textContent = '✕'; del.title = 'Eliminar país personalizado';
      del.addEventListener('click', e => { e.stopPropagation(); beginEdit(); const n = { ...P.countries }; delete n[code]; P.countries = n; if (E.active === code) setActive(''); changed({ countries: true }); });
      row.append(del);
    }
    row.addEventListener('click', () => { setActive(code); if (E.tool !== 'paint') setTool('paint'); });
    frag.append(row);
  }
  list.replaceChildren(frag);
}
$('cSearch').addEventListener('input', renderCountryList);
$('cOnlyMap').addEventListener('change', renderCountryList);
$('cNewAdd').onclick = () => {
  const name = $('cNewName').value.trim(); if (!name) return;
  beginEdit();
  const code = 'X_' + uid().slice(0, 5).toUpperCase();
  P.countries = { ...P.countries, [code]: { name, color: $('cNewColor').value, custom: true } };
  $('cNewName').value = '';
  setActive(code);
  changed({ countries: true });
};
$('cResetColors').onclick = () => {
  if (!confirm('¿Restaurar los colores predefinidos de todos los países?')) return;
  beginEdit();
  const def = defaultCountries(), n = {};
  for (const [k, v] of Object.entries(P.countries)) n[k] = def[k] ? { ...v, color: def[k].color } : v;
  P.countries = n;
  changed({ countries: true, colors: true });
  setActive(E.active);
};

// ---------------------------------------------------------------------------
// 14. Capas, estilo y fondo
// ---------------------------------------------------------------------------
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  $('tab-countries').hidden = b.dataset.tab !== 'countries';
  $('tab-layers').hidden = b.dataset.tab !== 'layers';
}));

const STYLE_BINDS = [
  ['stFillOp', 'fillOpacity', Number], ['stUnowned', 'unowned', String], ['stUnownedOp', 'unownedOp', Number],
  ['stProvBorder', 'provBorder', String], ['stProvBorderW', 'provBorderW', Number], ['stProvBorderOp', 'provBorderOp', Number],
  ['stCountryBorder', 'countryBorder', String], ['stCountryBorderW', 'countryBorderW', Number],
  ['stCoast', 'coast', String], ['stCoastW', 'coastW', Number], ['stSea', 'sea', String], ['stScaleLines', 'scaleLines', Boolean]
];
for (const [id, key, T] of STYLE_BINDS) {
  $(id).addEventListener(T === Boolean ? 'change' : 'input', () => {
    P.style[key] = T === Boolean ? $(id).checked : T($(id).value);
    E.fillsDirty = true; E.dirty = true; R.thumbs = new WeakMap(); scheduleThumb(); autosave();
    $('stFillOpVal').textContent = P.style.fillOpacity + '%';
  });
}
function refreshLayersUI() {
  for (const [id, key, T] of STYLE_BINDS) { if (T === Boolean) $(id).checked = !!P.style[key]; else $(id).value = P.style[key]; }
  $('stFillOpVal').textContent = P.style.fillOpacity + '%';
  const bg = P.bg;
  for (const id of ['bgWorld', 'bgFit', 'bgRemove', 'bgVisible', 'bgOpacity', 'bgX0', 'bgY0', 'bgX1', 'bgY1']) $(id).disabled = !bg;
  if (bg) {
    $('bgVisible').checked = bg.visible; $('bgOpacity').value = bg.opacity;
    for (const k of ['x0', 'y0', 'x1', 'y1']) if (document.activeElement !== $('bg' + k.toUpperCase())) $('bg' + k.toUpperCase()).value = Math.round(bg[k] * 10) / 10;
  }
  $('outW').value = P.out.w; $('outH').value = P.out.h; $('outFps').value = P.out.fps;

  const ll = $('layerList'); ll.replaceChildren();
  P.layers.forEach((l, idx) => {
    const d = document.createElement('div'); d.className = 'lrow';
    d.innerHTML = `
      <div class="row"><input type="checkbox" data-k="visible" ${l.visible ? 'checked' : ''}><span class="ttl"></span>
        <button data-a="up" title="Subir">▲</button><button data-a="del" class="danger" title="Eliminar">✕</button></div>
      <div class="row"><label>Línea <input type="color" data-k="stroke" value="${l.stroke}"></label>
        <label>Grosor <input type="number" data-k="width" min="0" max="30" step="0.1" value="${l.width}"></label></div>
      ${l.polys?.length ? `<div class="row"><label>Relleno <input type="color" data-k="fill" value="${l.fill}"></label>
        <label>Opac. <input type="number" data-k="fillOp" min="0" max="100" step="5" value="${l.fillOp}"></label>
        <label class="chk"><input type="checkbox" data-k="outline" ${l.outline ? 'checked' : ''}> Borde</label></div>` : ''}`;
    d.querySelector('.ttl').textContent = l.name;
    d.querySelectorAll('[data-k]').forEach(inp => inp.addEventListener(inp.type === 'checkbox' ? 'change' : 'input', () => {
      const k = inp.dataset.k;
      P.layers = P.layers.map(x => x.id === l.id ? { ...x, [k]: inp.type === 'checkbox' ? inp.checked : inp.type === 'number' ? +inp.value : inp.value } : x);
      E.dirty = true; autosave();
    }));
    d.querySelector('[data-a=del]').onclick = () => { beginEdit(); P.layers = P.layers.filter(x => x.id !== l.id); rebuildLayerPaths(); changed({ layers: true }); };
    d.querySelector('[data-a=up]').onclick = () => {
      if (idx === 0) return;
      const a = P.layers.slice(); [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; P.layers = a; changed({ layers: true });
    };
    ll.append(d);
  });
}
$('outW').addEventListener('change', () => { P.out.w = clamp(Math.round(+$('outW').value / 2) * 2, 320, 7680); layoutCanvas(); changed({ frames: true }); });
$('outH').addEventListener('change', () => { P.out.h = clamp(Math.round(+$('outH').value / 2) * 2, 240, 4320); layoutCanvas(); changed({ frames: true }); });
$('outFps').addEventListener('change', () => { P.out.fps = clamp(+$('outFps').value || 30, 10, 60); autosave(); });

// Fondo
$('bgLoad').onclick = () => $('fileBg').click();
$('fileBg').addEventListener('change', async ev => {
  const file = ev.target.files[0]; ev.target.value = ''; if (!file) return;
  const id = 'bg_' + uid();
  P.assets[id] = await readDataURL(file);
  const im = ensureImg(id);
  await new Promise(r => { if (im.complete) r(); else { im.onload = r; im.onerror = r; } });
  const old = P.bg;
  if (old && old.asset && old.asset !== id) delete P.assets[old.asset];
  const [x0, y0, x1, y1] = R.bounds;
  P.bg = old ? { ...old, asset: id } : { asset: id, x0, y0, x1, y1, opacity: 100, visible: true };
  if (!old) fitBgAspect();
  setStatus('Fondo cargado. Alinéalo con el world file, «Ajustar» o la herramienta «Mover fondo».', 5000);
  changed({ layers: true });
});
function fitBgAspect() {
  // Ajusta la imagen a la extensión de las provincias conservando su proporción
  const im = R.imgs.get(P.bg.asset); if (!im || !im.naturalWidth) return;
  const [x0, y0, x1, y1] = R.bounds, cxm = (x0 + x1) / 2, cym = (y0 + y1) / 2;
  const r = im.naturalWidth / im.naturalHeight;
  let w = x1 - x0, h = y1 - y0; if (w / h > r) h = w / r; else w = h * r;
  Object.assign(P.bg, { x0: cxm - w / 2, x1: cxm + w / 2, y0: cym - h / 2, y1: cym + h / 2 });
}
$('bgFit').onclick = () => { if (!P.bg) return; beginEdit(); P.bg = { ...P.bg }; fitBgAspect(); changed({ layers: true }); };
$('bgWorld').onclick = () => $('fileWorld').click();
$('fileWorld').addEventListener('change', async ev => {
  const file = ev.target.files[0]; ev.target.value = ''; if (!file || !P.bg) return;
  try {
    const wf = parseWorldFile(await readText(file));
    const im = R.imgs.get(P.bg.asset);
    const W = im.naturalWidth, H = im.naturalHeight;
    const sx0 = wf.C - wf.A / 2, sy0 = wf.F - wf.E / 2, sx1 = sx0 + wf.A * W, sy1 = sy0 + wf.E * H;
    const a = sourceToWorld(P.projCfg, sx0, sy0), b = sourceToWorld(P.projCfg, sx1, sy1);
    beginEdit();
    P.bg = { ...P.bg, x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) };
    if (P.projCfg.type !== 'planar' && P.projCfg.type !== 'equirect') setStatus('Aviso: con esta proyección la imagen solo coincide aproximadamente. Usa «Plana» y exporta todo en el mismo CRS.', 7000);
    else setStatus('Fondo alineado con el world file', 3000);
    changed({ layers: true });
  } catch (e) { alert('No se pudo leer el world file: ' + e.message); }
});
$('bgVisible').addEventListener('change', () => { P.bg.visible = $('bgVisible').checked; E.dirty = true; autosave(); });
$('bgOpacity').addEventListener('input', () => { P.bg.opacity = +$('bgOpacity').value; E.dirty = true; autosave(); });
for (const k of ['x0', 'y0', 'x1', 'y1']) $('bg' + k.toUpperCase()).addEventListener('change', e => { P.bg[k] = +e.target.value; E.dirty = true; autosave(); });
$('bgRemove').onclick = () => { if (!P.bg) return; beginEdit(); P.bg = null; changed({ layers: true }); };

// Capas extra
$('layerAdd').onclick = () => { if (!P.projCfg) return alert('Importa primero las provincias.'); $('fileLayer').click(); };
$('fileLayer').addEventListener('change', async ev => {
  const file = ev.target.files[0]; ev.target.value = ''; if (!file) return;
  try {
    setStatus('Cargando capa…');
    const fc = parseGeoText(await readText(file));
    const { lines, polys } = projectLayer(fc, P.projCfg);
    if (!lines.length && !polys.length) throw new Error('La capa no tiene líneas ni polígonos');
    const name = file.name.replace(/\.(geo|topo)?json$/i, '');
    const isRiver = /river|rio|río|lake|lago/i.test(name), isRoad = /road|carret|rail|ferro/i.test(name), isUrban = /urban|ciudad|city/i.test(name);
    beginEdit();
    P.layers = [...P.layers, {
      id: uid(), name, lines, polys, visible: true,
      stroke: isRiver ? '#3d7fc4' : isRoad ? '#7a5a3a' : '#444444', width: isRiver ? 0.9 : isRoad ? 0.6 : 0.8,
      fill: isUrban ? '#b8a48a' : isRiver ? '#7ea6c8' : '#999999', fillOp: polys.length ? (isUrban ? 60 : 50) : 0, outline: false
    }];
    rebuildLayerPaths();
    setStatus(`Capa «${name}» añadida`, 3000);
    changed({ layers: true });
  } catch (e) { setStatus(''); alert('Error al cargar la capa: ' + e.message); }
});

// ---------------------------------------------------------------------------
// 15. Fotogramas (línea de tiempo)
// ---------------------------------------------------------------------------
function selectFrame(i, moveCam = true) {
  if (!P.frames.length) return;
  E.cur = clamp(i, 0, P.frames.length - 1);
  if (moveCam) E.view = effectiveCam(E.cur);
  if (E.selItem && !frame().items.some(x => x.id === E.selItem)) E.selItem = null;
  E.flashes.clear(); E.lastEditKey = '';
  changed({ frames: true, item: true, sel: true, countries: true });
  refreshFrameSettings();
}
function refreshFrames() {
  const box = $('frames');
  box.replaceChildren();
  let t = 0;
  P.frames.forEach((f, i) => {
    const d = document.createElement('div');
    d.className = 'frame' + (i === E.cur ? ' sel' : '');
    const th = R.thumbs.get(f);
    if (th) d.style.backgroundImage = `url(${th})`;
    d.innerHTML = `<span class="n">${i + 1}</span><span class="d">${t.toFixed(1)}s · ${f.dur}s</span>${f.cam ? '<span class="cam">📷</span>' : ''}`;
    d.title = `Fotograma ${i + 1} — empieza en ${t.toFixed(1)} s`;
    d.addEventListener('click', () => selectFrame(i));
    box.append(d);
    t += f.dur;
  });
  const sel = box.children[E.cur]; if (sel) sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  $('tlTime').textContent = `Total: ${t.toFixed(1)} s`;
}
const FSET = [['fDur', 'dur'], ['fTrans', 'trans'], ['fFade', 'fade'], ['fLight', 'light'], ['fSpread', 'spread'], ['fCamT', 'camT']];
function refreshFrameSettings() {
  const f = frame(); if (!f) return;
  for (const [id, k] of FSET) if (document.activeElement !== $(id)) $(id).value = f[k];
}
for (const [id, k] of FSET) $(id).addEventListener('input', () => {
  const v = +$(id).value; if (!isFinite(v) || v < 0) return;
  beginEdit('fset' + id);
  mutFrame()[k] = k === 'dur' ? Math.max(0.1, v) : v;
  refreshFrames(); autosave();
});
$('fApplyAll').onclick = () => {
  beginEdit();
  const src = frame();
  P.frames.forEach((_, i) => { if (i !== E.cur) { const f = mutFrame(i); for (const [, k] of FSET) f[k] = src[k]; } });
  setStatus('Tiempos aplicados a todos los fotogramas', 2000);
  changed({ frames: true });
};
$('fClearOrder').onclick = () => { beginEdit(); mutFrame().order = []; setStatus('Orden de pintura borrado', 1500); autosave(); };

function addFrame(insertAfter = false) {
  if (!P.frames.length) return;
  beginEdit();
  const c = cloneFrame(frame());
  c.id = uid(); c.order = []; c.cam = null;
  // los elementos conservan su id para animarse entre fotogramas
  const at = insertAfter ? E.cur + 1 : P.frames.length;
  P.frames.splice(at, 0, c);
  selectFrame(at, false);
  setStatus(`Fotograma ${at + 1} creado. Pinta los cambios de este momento.`, 3000);
}
$('tlAdd').onclick = () => addFrame(false);
$('tlDup').onclick = () => addFrame(true);
$('tlDel').onclick = () => {
  if (P.frames.length <= 1) return setStatus('Tiene que quedar al menos un fotograma', 2000);
  beginEdit();
  P.frames.splice(E.cur, 1);
  selectFrame(Math.min(E.cur, P.frames.length - 1));
};
function moveFrame(dir) {
  const j = E.cur + dir; if (j < 0 || j >= P.frames.length) return;
  beginEdit();
  [P.frames[E.cur], P.frames[j]] = [P.frames[j], P.frames[E.cur]];
  selectFrame(j, false);
}
$('tlLeft').onclick = () => moveFrame(-1);
$('tlRight').onclick = () => moveFrame(1);
$('camSave').onclick = () => { beginEdit(); mutFrame().cam = { ...E.view }; setStatus('Cámara guardada en el fotograma ' + (E.cur + 1), 2000); changed({ frames: true }); };
$('camGo').onclick = () => { E.view = effectiveCam(E.cur); E.dirty = true; };
$('camClear').onclick = () => { beginEdit(); mutFrame().cam = null; changed({ frames: true }); };

// Miniaturas
const thumbCanvas = document.createElement('canvas');
const scheduleThumb = debounce(makeThumbs, 500);
function makeThumbs() {
  if (!P.frames.length) return;
  if (E.play) { scheduleThumb(); return; }
  const tw = 184, th = Math.round(tw * P.out.h / P.out.w);
  thumbCanvas.width = tw; thumbCanvas.height = th;
  const tctx = thumbCanvas.getContext('2d');
  const start = performance.now();
  let made = false;
  // primero el actual, luego los que falten (en tandas)
  const order = [E.cur, ...P.frames.map((_, i) => i).filter(i => i !== E.cur)];
  for (const i of order) {
    const f = P.frames[i];
    if (R.thumbs.has(f)) continue;
    drawScene(tctx, tw / P.out.w, { cam: effectiveCam(i), fills: rgbaCssArray(frameRGBA(f)), meshFrame: f, items: f.items, thumb: true });
    R.thumbs.set(f, thumbCanvas.toDataURL('image/jpeg', 0.7));
    made = true;
    if (performance.now() - start > 60) { setTimeout(makeThumbs, 50); break; }
  }
  if (made) refreshFrames();
}

// ---------------------------------------------------------------------------
// 16. Reproducción y vídeo
// ---------------------------------------------------------------------------
function prepPlayback() {
  const starts = [], data = [];
  let t = 0;
  P.frames.forEach((f, i) => {
    starts.push(t); t += Math.max(0.1, f.dur);
    const rgba = frameRGBA(f);
    const cam = effectiveCam(i), pz = i > 0 ? Math.max(cam.z, effectiveCam(i - 1).z) : cam.z;
    const d = { rgba, css: rgbaCssArray(rgba), mesh: countryMesh(f, lodIndex(pz)), cam, changed: [], offs: null };
    if (i > 0) {
      const A = data[i - 1].rgba, pf = P.frames[i - 1];
      for (let p = 0, o = 0; p < R.N; p++, o += 4) {
        if (pf.own[p] !== f.own[p] || A[o] !== rgba[o] || A[o + 1] !== rgba[o + 1] || A[o + 2] !== rgba[o + 2] || Math.abs(A[o + 3] - rgba[o + 3]) > 1e-4) d.changed.push(p);
      }
      if (f.spread > 0 && f.order.length) {
        d.offs = new Float32Array(R.N);
        const n = f.order.length;
        f.order.forEach((p, k) => { d.offs[p] = n > 1 ? f.spread * k / (n - 1) : 0; });
      }
    }
    data.push(d);
  });
  return { starts, data, total: t };
}

function lerpItem(a, b, e) {
  const o = { ...b };
  for (const k of ['x', 'y', 'size', 'w', 'h', 'rot', 'opacity', 'strokeW', 'spacing']) if (typeof a[k] === 'number' && typeof b[k] === 'number') o[k] = lerp(a[k], b[k], e);
  if (a.color && b.color && a.color !== b.color) o.color = lerpHex(a.color, b.color, e);
  if (a.stroke && b.stroke && a.stroke !== b.stroke) o.stroke = lerpHex(a.stroke, b.stroke, e);
  return o;
}
function lerpCam(a, b, e) {
  if (e >= 1) return b;
  const z = Math.exp(lerp(Math.log(a.z), Math.log(b.z), e));
  return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), z };
}

// Estado de la animación en el segundo t
function playState(t) {
  const PD = E.play.pd;
  let i = PD.starts.length - 1;
  while (i > 0 && PD.starts[i] > t) i--;
  const u = t - PD.starts[i], f = P.frames[i], D = PD.data[i];
  E.play.frame = i;
  if (i === 0) return { cam: D.cam, fills: D.css, mesh: D.mesh, items: f.items };
  const Dp = PD.data[i - 1], fp = P.frames[i - 1];
  // Provincias
  let fills = D.css;
  if (D.changed.length) {
    fills = D.css.slice();
    const A = Dp.rgba, B = D.rgba, tr = f.trans, fade = f.fade, light = f.light / 100;
    for (const p of D.changed) {
      const o = p * 4, v = u - (D.offs ? D.offs[p] : 0);
      const conquest = fade > 0 && f.own[p] && fp.own[p] !== f.own[p];
      if (v < 0) { fills[p] = Dp.css[p]; continue; }
      let r, g, b, a;
      if (v < tr) {
        const e = ease(v / tr), T = conquest ? lightOf(B, o, light) : [B[o], B[o + 1], B[o + 2]];
        r = lerp(A[o], T[0], e); g = lerp(A[o + 1], T[1], e); b = lerp(A[o + 2], T[2], e);
        a = A[o + 3] < 0.001 ? B[o + 3] * e : lerp(A[o + 3], B[o + 3], e);
        if (A[o + 3] < 0.001) { r = T[0]; g = T[1]; b = T[2]; }
      } else if (conquest && v < tr + fade) {
        const e = ease((v - tr) / fade), L = lightOf(B, o, light);
        r = lerp(L[0], B[o], e); g = lerp(L[1], B[o + 1], e); b = lerp(L[2], B[o + 2], e); a = B[o + 3];
      } else { continue; }
      fills[p] = a > 0.001 ? css(r, g, b, a) : null;
    }
  }
  // Elementos
  const ei = ease(f.trans > 0 ? u / f.trans : 1);
  let items = f.items;
  if (ei < 1) {
    const prev = new Map(fp.items.map(x => [x.id, x]));
    items = [];
    for (const it of f.items) {
      const a = prev.get(it.id);
      items.push(a ? lerpItem(a, it, ei) : { ...it, opacity: it.opacity * ei });
      prev.delete(it.id);
    }
    for (const a of prev.values()) items.push({ ...a, opacity: a.opacity * (1 - ei) });
  }
  // Cámara
  const ec = ease(f.camT > 0 ? u / f.camT : 1);
  const cam = lerpCam(Dp.cam, D.cam, ec);
  return { cam, fills, mesh: D.mesh, items };
}

function startPlay(fromFrame = 0, toFrame = P.frames.length - 1, rec = null) {
  if (!P.frames.length) return;
  stopPlay(true);
  setStatus('Preparando animación…');
  const pd = prepPlayback();
  const t0 = pd.starts[fromFrame], t1 = pd.starts[toFrame] + Math.max(0.1, P.frames[toFrame].dur);
  E.play = { pd, t0, t1, t: t0, wall: performance.now(), rec, frame: fromFrame };
  E.sel.clear(); E.selItem = null; refreshSelPanel(); refreshItemPanel();
  setStatus(rec ? '● Grabando vídeo… no cambies de pestaña' : '▶ Reproduciendo');
}
function stepPlay() {
  const pl = E.play;
  pl.t = pl.t0 + (performance.now() - pl.wall) / 1000;
  $('tlTime').textContent = `${pl.t.toFixed(1)} s / ${pl.t1.toFixed(1)} s`;
  document.querySelectorAll('.frame').forEach((d, i) => d.classList.toggle('playing', i === pl.frame));
  if (pl.t >= pl.t1) { pl.t = pl.t1 - 1e-3; if (!pl.rec) stopPlay(); }
}
function stopPlay(silent = false) {
  if (!E.play) return;
  const rec = E.play.rec;
  E.play = null;
  if (rec) rec.stop();
  document.querySelectorAll('.frame.playing').forEach(d => d.classList.remove('playing'));
  if (!silent) setStatus(rec ? '' : 'Reproducción detenida', 1500);
  refreshFrames(); scheduleThumb(); E.dirty = true;
}
$('tlPlay').onclick = () => startPlay(0);
$('tlPlayHere').onclick = () => startPlay(E.cur);
$('tlStop').onclick = () => stopPlay();

// Vídeo
const MIME_CANDIDATES = [
  ['video/mp4;codecs=avc1.640028', 'MP4 (H.264) — recomendado para YouTube', 'mp4'],
  ['video/mp4;codecs=avc1', 'MP4 (H.264)', 'mp4'],
  ['video/mp4', 'MP4', 'mp4'],
  ['video/webm;codecs=vp9', 'WebM (VP9)', 'webm'],
  ['video/webm;codecs=vp8', 'WebM (VP8)', 'webm'],
  ['video/webm', 'WebM', 'webm']
];
$('btnVideo').onclick = () => {
  if (!P.frames.length) return alert('Importa un mapa primero.');
  if (typeof MediaRecorder === 'undefined') return alert('Tu navegador no permite grabar vídeo. Usa Chrome, Edge o Firefox actualizados.');
  const sel = $('vFormat'); sel.replaceChildren();
  for (const [m, label] of MIME_CANDIDATES) if (MediaRecorder.isTypeSupported(m)) sel.append(new Option(label, m));
  if (!sel.options.length) return alert('No hay formatos de vídeo disponibles en este navegador.');
  $('vFrom').max = $('vTo').max = P.frames.length;
  $('vFrom').value = 1; $('vTo').value = P.frames.length;
  $('videoDlg').showModal();
};
$('videoDlg').addEventListener('close', () => { if ($('videoDlg').returnValue === 'ok') recordVideo(); });

function recordVideo() {
  const from = clamp((+$('vFrom').value || 1) - 1, 0, P.frames.length - 1);
  const to = clamp((+$('vTo').value || P.frames.length) - 1, from, P.frames.length - 1);
  const mime = $('vFormat').value, ext = MIME_CANDIDATES.find(m => m[0] === mime)?.[2] || 'webm';
  const out = document.createElement('canvas'); out.width = P.out.w; out.height = P.out.h;
  const octx = out.getContext('2d');
  const fps = P.out.fps;
  const stream = out.captureStream(fps);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: (+$('vBitrate').value || 16) * 1e6 });
  const chunks = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  let timer = null;
  rec.onstop = () => {
    clearInterval(timer);
    download(new Blob(chunks, { type: mime.split(';')[0] }), `mapa-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${ext}`);
    setStatus('✅ Vídeo exportado', 4000);
  };
  startPlay(from, to, rec);
  // primer fotograma antes de empezar a grabar
  drawScene(octx, 1, playState(E.play.t));
  rec.start(1000);
  E.play.wall = performance.now();
  timer = setInterval(() => {
    if (!E.play || E.play.rec !== rec) { clearInterval(timer); return; }
    const t = E.play.t0 + (performance.now() - E.play.wall) / 1000;
    drawScene(octx, 1, playState(Math.min(t, E.play.t1 - 1e-3)));
    if (t >= E.play.t1 + 0.3) stopPlay();
  }, 1000 / fps);
}

$('btnPng').onclick = () => {
  if (!P.frames.length) return;
  const c = document.createElement('canvas'); c.width = P.out.w; c.height = P.out.h;
  const f = frame();
  drawScene(c.getContext('2d'), 1, { cam: E.view, fills: rgbaCssArray(frameRGBA(f)), meshFrame: f, items: f.items });
  c.toBlob(b => download(b, `mapa-fotograma-${E.cur + 1}.png`), 'image/png');
};

// ---------------------------------------------------------------------------
// 17. Importar provincias
// ---------------------------------------------------------------------------
let pendingImport = null;
$('btnImport').onclick = $('emptyImport').onclick = () => $('fileGeo').click();
$('fileGeo').addEventListener('change', async ev => {
  const file = ev.target.files[0]; ev.target.value = ''; if (!file) return;
  try {
    setStatus('Leyendo ' + file.name + '…'); await nextTick();
    const fc = parseGeoText(await readText(file));
    openImportDialog(fc, file.name);
  } catch (e) { setStatus(''); alert('No se pudo leer el archivo: ' + e.message); }
});
function openImportDialog(fc, name, preset = {}) {
  const feats = polygonFeatures(fc);
  if (!feats.length) { setStatus(''); return alert('El archivo no contiene polígonos (provincias).'); }
  const fields = listFields(feats);
  const fill = (sel, val) => { sel.replaceChildren(new Option('(ninguno)', '')); fields.forEach(f => sel.append(new Option(f, f))); sel.value = val; };
  fill($('impOwner'), preset.owner ?? guessOwnerField(fields));
  fill($('impName'), preset.name ?? guessNameField(fields));
  const lonlat = looksLonLat(fc);
  const ps = $('impProj'); ps.replaceChildren();
  for (const [k, v] of Object.entries(PROJECTIONS)) if (lonlat || k === 'planar') ps.append(new Option(v, k));
  ps.value = preset.proj || (!lonlat ? 'planar' : worldWide(feats) ? 'natural' : 'lcc');
  $('impSimp').value = preset.simp ?? (feats.length > 3000 ? 30 : 0);
  $('impSimpVal').textContent = $('impSimp').value + '%';
  $('impKeep').checked = false; $('impKeep').parentElement.hidden = !P.frames.length;
  $('impInfo').textContent = `${name}: ${feats.length} provincias · coordenadas ${lonlat ? 'en grados (EPSG:4326)' : 'proyectadas (planas)'}`;
  pendingImport = fc;
  setStatus('');
  $('importDlg').showModal();
}
function worldWide(feats) {
  let x0 = Infinity, x1 = -Infinity;
  for (const f of feats.slice(0, 6000)) { const c = f.geometry.coordinates.flat(3); for (let k = 0; k < c.length; k += 40) { if (c[k] < x0) x0 = c[k]; if (c[k] > x1) x1 = c[k]; } }
  return x1 - x0 > 150;
}
$('impSimp').addEventListener('input', () => { $('impSimpVal').textContent = $('impSimp').value + '%'; });
$('importDlg').addEventListener('close', async () => {
  if ($('importDlg').returnValue !== 'ok' || !pendingImport) return;
  const fc = pendingImport; pendingImport = null;
  await doImport(fc, { ownerField: $('impOwner').value, nameField: $('impName').value, projType: $('impProj').value, simplify: +$('impSimp').value / 100 }, $('impKeep').checked);
});

async function doImport(fc, opts, keep) {
  try {
    setStatus('Importando provincias…'); await nextTick();
    const { topo, projCfg } = buildProvinceTopology(fc, opts, m => setStatus(m));
    await nextTick();
    const old = P;
    P = emptyProject();
    if (keep) { P.countries = old.countries; P.style = old.style; P.out = old.out; P.assets = old.assets; P.layers = []; }
    P.topo = topo; P.projCfg = projCfg;
    setStatus('Construyendo provincias…'); await nextTick();
    buildRuntime();
    P.owner0 = R.provinces.map(p => p.owner0);
    for (const p of R.provinces) {
      if (p.owner0 && !P.countries[p.owner0]) {
        // ¿coincide por nombre con algún país de la lista?
        const byName = Object.entries(P.countries).find(([, c]) => c.name.toLowerCase() === p.owner0.toLowerCase());
        if (byName) p.owner0 = byName[0]; else ensureCountry(p.owner0, p.ownerName || p.owner0);
      }
    }
    P.owner0 = R.provinces.map(p => p.owner0);
    P.groups = new Array(R.N).fill(0);
    if (keep && old.frames.length) {
      P.frames = old.frames.map(f => ({ ...cloneFrame(f), own: P.owner0.slice(), col: {}, alp: {}, order: [] }));
    } else P.frames = [newFrame(P.owner0.slice())];
    E.undo = []; E.redo = []; E.sel.clear(); E.selItem = null; E.cur = 0;
    E.view = DEFAULT_CAM();
    afterProjectLoaded();
    setStatus(`✅ ${R.N} provincias importadas`, 4000);
  } catch (e) {
    console.error(e); setStatus(''); alert('Error al importar: ' + e.message);
  }
}

async function loadSample() {
  try {
    setStatus('Descargando mapa de ejemplo…');
    const res = await fetch('sample/europe_provinces.topojson');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const fc = parseGeoText(await res.text());
    await doImport(fc, { ownerField: 'adm0_a3', nameField: 'name', projType: 'lcc', simplify: 0 }, false);
  } catch (e) { setStatus(''); alert('No se pudo cargar el ejemplo: ' + e.message); }
}
$('btnSample').onclick = $('emptySample').onclick = () => {
  if (P.frames.length && !confirm('Esto reemplaza el proyecto actual. ¿Continuar? (Guarda antes si lo necesitas)')) return;
  loadSample();
};

// ---------------------------------------------------------------------------
// 18. Guardar / abrir / autoguardado
// ---------------------------------------------------------------------------
const autosave = debounce(async () => {
  if (E.play) return autosave();
  try { await idbSet('project', P); } catch (e) { console.warn('Autoguardado falló', e); setStatus('⚠ No se pudo autoguardar (¿espacio lleno?)', 4000); }
}, 1500);

$('btnSave').onclick = saveProjectFile;
function saveProjectFile() {
  if (!P.topo) return;
  // limpiar recursos no usados
  const used = new Set();
  if (P.bg?.asset) used.add(P.bg.asset);
  for (const f of P.frames) for (const it of f.items) if (it.asset) used.add(it.asset);
  for (const k of Object.keys(P.assets)) if (!used.has(k)) delete P.assets[k];
  download(new Blob([JSON.stringify(P)], { type: 'application/json' }), 'proyecto-mapa.json');
  setStatus('Proyecto guardado', 2000);
}
$('btnOpen').onclick = () => $('fileProject').click();
$('fileProject').addEventListener('change', async ev => {
  const file = ev.target.files[0]; ev.target.value = ''; if (!file) return;
  try {
    setStatus('Abriendo proyecto…'); await nextTick();
    const data = JSON.parse(await readText(file));
    if (!data.topo || !data.frames) throw new Error('No es un proyecto de este editor');
    loadProjectData(data);
    setStatus('Proyecto abierto', 2500);
  } catch (e) { setStatus(''); alert('No se pudo abrir: ' + e.message); }
});
function loadProjectData(data) {
  P = { ...emptyProject(), ...data, style: { ...DEFAULT_STYLE, ...(data.style || {}) }, out: { ...emptyProject().out, ...(data.out || {}) } };
  P.frames = P.frames.map(f => ({ ...FRAME_DEFAULTS, ...f, col: f.col || {}, alp: f.alp || {}, order: f.order || [], items: f.items || [] }));
  R.imgs = new Map();
  buildRuntime();
  E.undo = []; E.redo = []; E.sel.clear(); E.selItem = null; E.cur = 0;
  E.view = effectiveCam(0);
  afterProjectLoaded();
}
$('btnNew').onclick = () => {
  if (P.frames.length && !confirm('¿Empezar un proyecto nuevo? Se perderá el actual si no lo has guardado.')) return;
  P = emptyProject(); R.imgs = new Map(); buildRuntime();
  E.undo = []; E.redo = []; E.sel.clear(); E.selItem = null; E.cur = 0;
  afterProjectLoaded();
};

function afterProjectLoaded() {
  $('empty').hidden = !!P.frames.length;
  layoutCanvas();
  if (!P.countries[E.active]) {
    // país activo: el más frecuente
    const cnt = new Map(); (P.frames[0]?.own || []).forEach(o => o && cnt.set(o, (cnt.get(o) || 0) + 1));
    E.active = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  }
  setActive(E.active);
  changed({ all: true });
  renderCountryList();
}

// ---------------------------------------------------------------------------
// 19. Teclado y botones generales
// ---------------------------------------------------------------------------
$('btnUndo').onclick = undo;
$('btnRedo').onclick = redo;
$('btnHelp').onclick = () => $('helpDlg').showModal();

window.addEventListener('keydown', ev => {
  const tag = (ev.target.tagName || '').toLowerCase();
  const typing = tag === 'textarea' || tag === 'select' || (tag === 'input' && ['text', 'number', 'search'].includes(ev.target.type));
  if (typing || document.querySelector('dialog[open]')) return;
  const k = ev.key.toLowerCase(), ctrl = ev.ctrlKey || ev.metaKey;
  if (ctrl && k === 'z' && !ev.shiftKey) { ev.preventDefault(); undo(); return; }
  if (ctrl && (k === 'y' || (k === 'z' && ev.shiftKey))) { ev.preventDefault(); redo(); return; }
  if (ctrl && k === 'g') { ev.preventDefault(); ev.shiftKey ? ungroupSelection() : groupSelection(); return; }
  if (ctrl && k === 's') { ev.preventDefault(); saveProjectFile(); return; }
  if (ctrl && k === 'd') { ev.preventDefault(); duplicateItem(); return; }
  if (ctrl) return;
  if (k === ' ') { E.space = true; cv.style.cursor = 'grab'; ev.preventDefault(); return; }
  if (k === 'delete' || k === 'backspace') { deleteSelectedItem(); return; }
  if (k === 'escape') { E.sel.clear(); E.selItem = null; refreshSelPanel(); refreshItemPanel(); stopPlay(); E.dirty = true; return; }
  const tools = { b: 'paint', v: 'select', e: 'erase', i: 'pick', t: 'text', h: 'pan' };
  if (tools[k]) { setTool(tools[k]); return; }
  if (k === 'n') { addFrame(false); return; }
  if (k === 'arrowleft') { selectFrame(E.cur - 1); return; }
  if (k === 'arrowright') { selectFrame(E.cur + 1); return; }
});
window.addEventListener('keyup', ev => { if (ev.key === ' ') { E.space = false; cv.style.cursor = 'crosshair'; } });
window.addEventListener('beforeunload', () => { idbSet('project', P).catch(() => {}); });

// ---------------------------------------------------------------------------
// 20. Inicio
// ---------------------------------------------------------------------------
(async function init() {
  setTool('paint');
  layoutCanvas();
  requestAnimationFrame(loop);
  try {
    const saved = await idbGet('project');
    if (saved && saved.topo && saved.frames?.length) {
      setStatus('Recuperando el último proyecto…'); await nextTick();
      loadProjectData(saved);
      setStatus('Proyecto recuperado', 2000);
      return;
    }
  } catch (e) { console.warn(e); }
  afterProjectLoaded();
  try { if (!localStorage.getItem('mms-help')) { localStorage.setItem('mms-help', '1'); $('helpDlg').showModal(); } } catch (e) { /* */ }
})();
