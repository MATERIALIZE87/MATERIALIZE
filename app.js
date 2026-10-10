(() => {
'use strict';

// Funciones utilitarias básicas
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hex2rgb = h => { 
  const n = parseInt(h.slice(1), 16); 
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; 
};
const mkCanvas = () => document.createElement('canvas');

// Referencias al DOM (HTML)
const view = $('view');
const stage = $('stage');
const cv = $('main');
const ctx = cv.getContext('2d');

const MAXW = 2400; // Ancho máximo de la imagen para que no colapse la memoria

// ==========================================
// 1. BASE DE DATOS DE PAÍSES Y COLORES
// ==========================================
// Formato fácil de editar: "Nombre del País": { hex: "Código RGB", colorName: "Nombre descriptivo" }
const countryDatabase = {
  "Europa": {
    "Alemania": { hex: "#737373", colorName: "Gris Oscuro" },
    "Francia": { hex: "#2167cc", colorName: "Azul Rey" },
    "Reino Unido": { hex: "#bf2a51", colorName: "Rojo Oscuro" },
    "Italia": { hex: "#197a42", colorName: "Verde Esmeralda" },
    "España": { hex: "#de9c29", colorName: "Amarillo" },
    "Rusia": { hex: "#3c8c35", colorName: "Morado" },
    "Ucrania": { hex: "#1174f2", colorName: "Naranja" },
    "Polonia": { hex: "#cc7bad", colorName: "Rojo Claro" },
    "Serbia": { hex: "#646aab", colorName: "Naranja Oscuro" },
    "Croacia": { hex: "#55b6f7", colorName: "Azul Claro" },
    "Bosnia": { hex: "#034987", colorName: "Amarillo" },
    "Grecia": { hex: "#09ade3", colorName: "Celeste Fuerte" }
  },
  "América": {
    "Argentina": { hex: "#74b9ff", colorName: "Celeste" },
    "Brasil": { hex: "#00b894", colorName: "Verde Brillante" },
    "Estados Unidos": { hex: "#0984e3", colorName: "Azul Fuerte" },
    "México": { hex: "#009432", colorName: "Verde Oscuro" },
    "Chile": { hex: "#d63031", colorName: "Rojo" },
    "Colombia": { hex: "#fdcb6e", colorName: "Amarillo Mostaza" }
  },
  "Asia": {
    "China": { hex: "#e84118", colorName: "Rojo Intenso" },
    "Japón": { hex: "#c23616", colorName: "Rojo Oscuro" },
    "India": { hex: "#e1b12c", colorName: "Mostaza" },
    "Irán": { hex: "#4cd137", colorName: "Verde Claro" },
    "Turquía": { hex: "#c0392b", colorName: "Rojo Oscuro" }
  },
  "África": {
    "Egipto": { hex: "#d35400", colorName: "Naranja Oscuro" },
    "Sudáfrica": { hex: "#009432", colorName: "Verde" }
  }
};

const PALETTE = ['#c0392b', '#2e86c1', '#27ae60', '#f1c40f', '#8e44ad', '#e67e22', '#16a085', '#7f8c8d'];

// Estado global de la aplicación (State)
const S = {
  w: 0, h: 0, base: null, labels: null, n: 0, owners: null,
  countries: [], nextId: 1, active: 1,
  overlay: mkCanvas(), octx: null, ovData: null,
  paint: mkCanvas(), pctx: null, lines: mkCanvas(),
  tool: 'fill', zoom: 1, panX: 0, panY: 0,
  keyframes: [], sel: -1, undo: [], redo: [],
  caption: '', playing: false, drag: null, space: false, scratch: null
};

// ==========================================
// 2. INICIALIZACIÓN DE LA BASE DE DATOS UI
// ==========================================
function initCountryDatabase() {
  const continentSel = $('continentSelect');
  const countrySel = $('countrySelect');

  // Llenar la lista de continentes
  for (const continent in countryDatabase) {
    const opt = document.createElement('option');
    opt.value = continent;
    opt.textContent = continent;
    continentSel.appendChild(opt);
  }

  // Cuando cambie el continente, actualizar los países
  continentSel.addEventListener('change', () => {
    countrySel.innerHTML = '';
    const selectedContinent = continentSel.value;
    const countries = countryDatabase[selectedContinent];

    for (const countryName in countries) {
      const opt = document.createElement('option');
      opt.value = countryName;
      // Muestra: Nombre País (Nombre del Color)
      opt.textContent = `${countryName} (${countries[countryName].colorName})`; 
      countrySel.appendChild(opt);
    }
  });

  // Disparar evento para llenar países por defecto al cargar
  continentSel.dispatchEvent(new Event('change'));

  // Botón para añadir país de la base de datos al mapa
  $('addDbCountryBtn').addEventListener('click', () => {
    const continent = continentSel.value;
    const countryName = countrySel.value;
    const countryData = countryDatabase[continent][countryName];
    
    // Agrega el país con sus datos exactos
    const newCountry = addCountry(countryName, countryData.hex);
    renderCountries();
    setActive(newCountry.id);
  });
}

function setStatus(t) { 
  $('status').textContent = t || ''; 
}

// ==========================================
// 3. CARGA Y DETECCIÓN DEL MAPA
// ==========================================
function setMap(src) {
  let w = src.width || src.naturalWidth;
  let h = src.height || src.naturalHeight;
  
  // Escalar si es muy grande
  const sc = Math.min(1, MAXW / w);
  w = Math.round(w * sc); 
  h = Math.round(h * sc);
  
  S.w = w; S.h = h;
  S.base = mkCanvas(); 
  S.base.width = w; 
  S.base.height = h;
  S.base.getContext('2d').drawImage(src, 0, 0, w, h);
  
  for (const c of [S.overlay, S.paint, S.lines, cv]) { 
    c.width = w; 
    c.height = h; 
  }
  
  S.octx = S.overlay.getContext('2d');
  S.pctx = S.paint.getContext('2d');
  S.ovData = S.octx.createImageData(w, h);
  stage.style.width = w + 'px'; 
  stage.style.height = h + 'px';
  
  detectProvinces();
  
  S.owners = new Int32Array(S.n + 1);
  S.keyframes = []; S.sel = -1; S.undo = []; S.redo = [];
  
  renderKeyframes();
  fitView();
  redraw();
  setStatus(S.n + ' provincias detectadas');
}

function detectProvinces() {
  const { w, h } = S;
  const thr = +$('thr').value;
  const img = S.base.getContext('2d').getImageData(0, 0, w, h).data;
  const N = w * h;
  const isLine = new Uint8Array(N);
  const lineImg = S.lines.getContext('2d').createImageData(w, h);
  const ld = lineImg.data;
  
  // Detectar líneas oscuras basadas en el umbral
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    const a = img[o + 3] / 255;
    const lum = (0.299 * img[o] + 0.587 * img[o + 1] + 0.114 * img[o + 2]) * a + 255 * (1 - a);
    
    if (lum < thr) isLine[i] = 1;
    
    let al = 0;
    if (lum < thr) {
      al = 255;
    } else if (lum < thr + 60) {
      al = 255 * (1 - (lum - thr) / 60);
    }
    ld[o] = 25; ld[o + 1] = 25; ld[o + 2] = 25; ld[o + 3] = al;
  }
  S.lines.getContext('2d').putImageData(lineImg, 0, 0);

  // Algoritmo Flood-fill para encontrar provincias cerradas
  let labels = new Int32Array(N);
  const stack = new Int32Array(N);
  let n = 0;
  
  for (let i = 0; i < N; i++) {
    if (isLine[i] || labels[i]) continue;
    n++;
    labels[i] = n;
    let sp = 0; 
    stack[sp++] = i;
    
    while (sp) {
      const p = stack[--sp];
      const x = p % w;
      if (x > 0 && !isLine[p - 1] && !labels[p - 1]) { labels[p - 1] = n; stack[sp++] = p - 1; }
      if (x < w - 1 && !isLine[p + 1] && !labels[p + 1]) { labels[p + 1] = n; stack[sp++] = p + 1; }
      if (p >= w && !isLine[p - w] && !labels[p - w]) { labels[p - w] = n; stack[sp++] = p - w; }
      if (p < N - w && !isLine[p + w] && !labels[p + w]) { labels[p + w] = n; stack[sp++] = p + w; }
    }
  }
  
  // Expandir etiquetas para que los bordes pertenezcan a la provincia
  for (let pass = 0; pass < 6; pass++) {
    const next = labels.slice();
    for (let i = 0; i < N; i++) {
      if (labels[i]) continue;
      const x = i % w;
      let l = 0;
      if (x > 0) l = labels[i - 1];
      if (!l && x < w - 1) l = labels[i + 1];
      if (!l && i >= w) l = labels[i - w];
      if (!l && i < N - w) l = labels[i + w];
      if (l) next[i] = l;
    }
    labels = next;
  }
  S.labels = labels; 
  S.n = n;
}

function demoMap() {
  const w = 1200, h = 700, seeds = 70;
  const sx = [], sy = [];
  for (let i = 0; i < seeds; i++) { sx.push(Math.random() * w); sy.push(Math.random() * h); }
  const cell = new Uint16Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let best = 0, bd = 1e12;
    for (let k = 0; k < seeds; k++) {
      const dx = x - sx[k], dy = y - sy[k], d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = k; }
    }
    cell[y * w + x] = best;
  }
  const c = mkCanvas(); c.width = w; c.height = h;
  const cx = c.getContext('2d');
  const id = cx.createImageData(w, h); const d = id.data;
  for (let i = 0; i < w * h; i++) { d[i * 4] = 244; d[i * 4 + 1] = 241; d[i * 4 + 2] = 232; d[i * 4 + 3] = 255; }
  const dark = i => { d[i * 4] = 40; d[i * 4 + 1] = 40; d[i * 4 + 2] = 40; };
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const i = y * w + x;
    if (cell[i] !== cell[i + 1]) { dark(i); dark(i + 1); }
    if (cell[i] !== cell[i + w]) { dark(i); dark(i + w); }
  }
  for (let x = 0; x < w; x++) { dark(x); dark(w + x); dark((h - 1) * w + x); dark((h - 2) * w + x); }
  for (let y = 0; y < h; y++) { dark(y * w); dark(y * w + 1); dark(y * w + w - 1); dark(y * w + w - 2); }
  cx.putImageData(id, 0, 0);
  setMap(c);
}

// ==========================================
// 4. GESTIÓN DE PAÍSES
// ==========================================
function addCountry(name, color) {
  const c = { 
    id: S.nextId++, 
    name: name || ('País ' + S.nextId), 
    color: color || PALETTE[(S.nextId - 2) % PALETTE.length] 
  };
  S.countries.push(c);
  return c;
}

function resetCountries() {
  S.countries = [];
  addCountry('Alemania', '#2c3e50');
  addCountry('Francia', '#2980b9');
  S.active = S.countries[0].id;
}

function renderCountries() {
  const el = $('countries'); 
  el.innerHTML = '';
  
  const rows = [{ id: 0, name: 'Sin Dueño', color: null }, ...S.countries];
  
  rows.forEach((c, idx) => {
    const row = document.createElement('div');
    row.className = 'crow'; 
    row.dataset.id = c.id;
    
    if (c.color) {
      const col = document.createElement('input'); 
      col.type = 'color'; 
      col.value = c.color;
      col.addEventListener('input', () => {
        c.color = col.value; 
        redraw();
        if (S.active === c.id) $('brushColor').value = c.color;
      });
      row.appendChild(col);
    } else {
      const sp = document.createElement('span'); 
      sp.className = 'nosw'; 
      row.appendChild(sp);
    }
    
    const nm = document.createElement('input'); 
    nm.type = 'text'; 
    nm.className = 'nm'; 
    nm.value = c.name;
    if (!c.color) nm.disabled = true;
    nm.addEventListener('input', () => { 
      c.name = nm.value; 
      updateWarSelects(); 
    });
    row.appendChild(nm);
    
    if (c.color) {
      const x = document.createElement('button'); 
      x.className = 'x'; 
      x.textContent = '×'; 
      x.title = 'Eliminar país';
      x.addEventListener('click', ev => { 
        ev.stopPropagation(); 
        deleteCountry(c.id); 
      });
      row.appendChild(x);
    }
    
    const k = document.createElement('span'); 
    k.className = 'key'; 
    k.textContent = idx < 10 ? idx : '';
    row.appendChild(k);
    
    row.addEventListener('click', () => setActive(c.id));
    el.appendChild(row);
  });
  markActive(); 
  updateWarSelects();
}

function markActive() {
  document.querySelectorAll('.crow').forEach(r => {
    r.classList.toggle('active', +r.dataset.id === S.active);
  });
}

function setActive(id) {
  S.active = id;
  const c = S.countries.find(c => c.id === id);
  if (c) $('brushColor').value = c.color;
  markActive();
}

function deleteCountry(id) {
  pushUndo(false);
  for (let i = 1; i <= S.n; i++) {
    if (S.owners[i] === id) S.owners[i] = 0;
  }
  S.countries = S.countries.filter(c => c.id !== id);
  if (S.active === id) S.active = S.countries.length ? S.countries[0].id : 0;
  renderCountries(); 
  redraw();
}

function updateWarSelects() {
  for (const id of ['warA', 'warB']) {
    const sel = $(id);
    const prev = +sel.value;
    sel.innerHTML = '';
    S.countries.forEach(c => {
      const o = document.createElement('option'); 
      o.value = c.id; 
      o.textContent = c.name; 
      sel.appendChild(o);
    });
    if (S.countries.some(c => c.id === prev)) sel.value = prev;
  }
  if ($('warA').value === $('warB').value && S.countries.length > 1) {
    $('warB').selectedIndex = 1;
  }
}

// ==========================================
// 5. REDIBUJADO DE LA PANTALLA
// ==========================================
function colorTable(owners, countries) {
  const t = new Uint32Array(S.n + 1);
  const m = new Map(countries.map(c => [c.id, hex2rgb(c.color)]));
  for (let i = 1; i <= S.n; i++) {
    const c = m.get(owners[i]);
    t[i] = c ? (((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0) : 0;
  }
  return t;
}

function lerpTable(A, B, e, out) {
  for (let i = 0; i < A.length; i++) {
    const a = A[i], b = B[i];
    if (a === b) { out[i] = a; continue; }
    const aa = a >>> 24, ba = b >>> 24;
    let r, g, bl;
    if (!aa) { r = b & 255; g = (b >> 8) & 255; bl = (b >> 16) & 255; }
    else if (!ba) { r = a & 255; g = (a >> 8) & 255; bl = (a >> 16) & 255; }
    else {
      r = (a & 255) + ((b & 255) - (a & 255)) * e;
      g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * e;
      bl = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * e;
    }
    const al = Math.round(aa + (ba - aa) * e);
    out[i] = ((al << 24) | ((bl | 0) << 16) | ((g | 0) << 8) | (r | 0)) >>> 0;
  }
  return out;
}

function renderOverlay(table) {
  const u = new Uint32Array(S.ovData.data.buffer);
  const L = S.labels;
  for (let i = 0; i < L.length; i++) u[i] = table[L[i]];
  S.octx.putImageData(S.ovData, 0, 0);
}

function drawCaption(text) {
  if (!text) return;
  const size = +$('capSize').value || 56;
  ctx.font = 'bold ' + size + 'px system-ui, sans-serif';
  ctx.textBaseline = 'alphabetic';
  const x = size * 0.6;
  const y = $('capPos').value === 'top' ? size * 1.3 : S.h - size * 0.6;
  ctx.lineJoin = 'round'; 
  ctx.lineWidth = size / 5;
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; 
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#111'; 
  ctx.fillText(text, x, y);
}

function compose(paints, caption) {
  const opacity = +$('opacity').value / 100;
  ctx.globalCompositeOperation = 'source-over'; 
  ctx.globalAlpha = 1;
  
  if ($('mode').value === 'multiply') {
    ctx.fillStyle = '#fff'; 
    ctx.fillRect(0, 0, S.w, S.h);
    ctx.globalAlpha = opacity; 
    ctx.drawImage(S.overlay, 0, 0);
    
    for (const [c, a] of paints) { 
      ctx.globalAlpha = a; 
      ctx.drawImage(c, 0, 0); 
    }
    
    ctx.globalAlpha = 1; 
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(S.base, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  } else {
    ctx.drawImage(S.base, 0, 0);
    ctx.globalAlpha = opacity; 
    ctx.drawImage(S.overlay, 0, 0);
    for (const [c, a] of paints) { 
      ctx.globalAlpha = a; 
      ctx.drawImage(c, 0, 0); 
    }
    ctx.globalAlpha = 1; 
    ctx.drawImage(S.lines, 0, 0);
  }
  ctx.globalAlpha = 1;
  drawCaption(caption);
}

function redraw() {
  if (!S.labels || S.playing) return;
  renderOverlay(colorTable(S.owners, S.countries));
  compose([[S.paint, 1]], S.caption);
}

function recompose() { 
  if (S.labels && !S.playing) compose([[S.paint, 1]], S.caption); 
}

// ==========================================
// 6. DESHACER / REHACER (UNDO / REDO)
// ==========================================
function snap(withPaint) {
  return {
    owners: S.owners.slice(), 
    countries: S.countries.map(c => ({ ...c })),
    paint: withPaint ? S.pctx.getImageData(0, 0, S.w, S.h) : null
  };
}
function pushUndo(withPaint) {
  S.undo.push(snap(withPaint)); 
  if (S.undo.length > 20) S.undo.shift(); 
  S.redo.length = 0;
}
function restore(e) {
  S.owners = e.owners.slice(); 
  S.countries = e.countries.map(c => ({ ...c }));
  if (e.paint) S.pctx.putImageData(e.paint, 0, 0);
  renderCountries(); 
  redraw();
}
function undo() { 
  const e = S.undo.pop(); 
  if (!e) return; 
  S.redo.push(snap(!!e.paint)); 
  restore(e); 
}
function redo() { 
  const e = S.redo.pop(); 
  if (!e) return; 
  S.undo.push(snap(!!e.paint)); 
  restore(e); 
}

// ==========================================
// 7. VISTA (ZOOM Y PANEO)
// ==========================================
function applyView() { 
  stage.style.transform = `translate(${S.panX}px,${S.panY}px) scale(${S.zoom})`; 
}
function fitView() {
  const vw = view.clientWidth, vh = view.clientHeight;
  S.zoom = Math.min(vw / S.w, vh / S.h) * 0.98;
  S.panX = (vw - S.w * S.zoom) / 2; 
  S.panY = (vh - S.h * S.zoom) / 2;
  applyView();
}
view.addEventListener('wheel', e => {
  e.preventDefault();
  const r = view.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  const nz = clamp(S.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.05, 20);
  S.panX = mx - (mx - S.panX) * (nz / S.zoom);
  S.panY = my - (my - S.panY) * (nz / S.zoom);
  S.zoom = nz; 
  applyView();
}, { passive: false });
view.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('resize', () => { if (S.labels) fitView(); });

// ==========================================
// 8. EDICIÓN DEL MAPA EN VIVO
// ==========================================
function toMap(e) {
  const r = cv.getBoundingClientRect();
  const fx = (e.clientX - r.left) / r.width * S.w;
  const fy = (e.clientY - r.top) / r.height * S.h;
  return { fx, fy, x: clamp(Math.floor(fx), 0, S.w - 1), y: clamp(Math.floor(fy), 0, S.h - 1) };
}

const regionAt = p => S.labels[p.y * S.w + p.x];

function assign(p, id) {
  const r = regionAt(p);
  if (!r || S.owners[r] === id) return;
  S.owners[r] = id; 
  redraw();
}

function brushColor() { return $('brushColor').value; }
function brushSize() { return +$('brushSize').value; }

function strokeSeg(a, b) {
  const c = S.pctx;
  c.globalCompositeOperation = S.tool === 'eraser' ? 'destination-out' : 'source-over';
  c.strokeStyle = c.fillStyle = brushColor();
  c.lineWidth = brushSize(); 
  c.lineCap = 'round'; 
  c.lineJoin = 'round';
  c.beginPath(); 
  c.moveTo(a.fx, a.fy); 
  c.lineTo(b.fx, b.fy); 
  c.stroke();
  if (a.fx === b.fx && a.fy === b.fy) { 
    c.beginPath(); 
    c.arc(a.fx, a.fy, brushSize() / 2, 0, 7); 
    c.fill(); 
  }
  c.globalCompositeOperation = 'source-over';
}

function lockedDab(fx, fy, region) {
  const r = brushSize() / 2;
  const x0 = Math.max(0, Math.floor(fx - r)), y0 = Math.max(0, Math.floor(fy - r));
  const x1 = Math.min(S.w, Math.ceil(fx + r)), y1 = Math.min(S.h, Math.ceil(fy + r));
  const ww = x1 - x0, hh = y1 - y0;
  if (ww <= 0 || hh <= 0) return;
  
  const id = S.pctx.getImageData(x0, y0, ww, hh), d = id.data;
  const erase = S.tool === 'eraser';
  const rgb = hex2rgb(brushColor());
  const r2 = r * r;
  
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const dx = x + 0.5 - fx, dy = y + 0.5 - fy;
      if (dx * dx + dy * dy > r2 || S.labels[y * S.w + x] !== region) continue;
      const o = ((y - y0) * ww + (x - x0)) * 4;
      if (erase) {
        d[o + 3] = 0; 
      } else { 
        d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255; 
      }
    }
  }
  S.pctx.putImageData(id, x0, y0);
}

function brushMove(a, b) {
  if ($('lockBrush').checked && S.drag.region) {
    const dist = Math.hypot(b.fx - a.fx, b.fy - a.fy);
    const step = Math.max(1, brushSize() / 6);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i <= n; i++) {
      lockedDab(a.fx + (b.fx - a.fx) * i / n, a.fy + (b.fy - a.fy) * i / n, S.drag.region);
    }
  } else {
    strokeSeg(a, b);
  }
  recompose();
}

view.addEventListener('pointerdown', e => {
  if (S.playing || !S.labels) return;
  view.setPointerCapture(e.pointerId);
  if (e.button === 1 || e.button === 2 || S.space || S.tool === 'pan') {
    S.drag = { type: 'pan', x: e.clientX, y: e.clientY, px: S.panX, py: S.panY }; 
    return;
  }
  if (e.button !== 0) return;
  const p = toMap(e);
  switch (S.tool) {
    case 'fill': 
      pushUndo(false); S.drag = { type: 'fill' }; assign(p, S.active); break;
    case 'unown': 
      pushUndo(false); S.drag = { type: 'unown' }; assign(p, 0); break;
    case 'pick': 
      const r = regionAt(p); if (r) setActive(S.owners[r]); break;
    case 'brush': case 'eraser':
      pushUndo(true);
      S.drag = { type: 'brush', last: p, region: regionAt(p) };
      if ($('lockBrush').checked) lockedDab(p.fx, p.fy, S.drag.region); else strokeSeg(p, p);
      recompose();
      break;
  }
});
view.addEventListener('pointermove', e => {
  const d = S.drag; if (!d) return;
  if (d.type === 'pan') { 
    S.panX = d.px + e.clientX - d.x; 
    S.panY = d.py + e.clientY - d.y; 
    applyView(); 
    return; 
  }
  const p = toMap(e);
  if (d.type === 'fill') assign(p, S.active);
  else if (d.type === 'unown') assign(p, 0);
  else if (d.type === 'brush') { brushMove(d.last, p); d.last = p; }
});
const endDrag = () => { S.drag = null; };
view.addEventListener('pointerup', endDrag);
view.addEventListener('pointercancel', endDrag);

// ==========================================
// 9. ANIMACIÓN (KEYFRAMES)
// ==========================================
function cloneCanvas(c) { 
  const n = mkCanvas(); 
  n.width = c.width; 
  n.height = c.height; 
  n.getContext('2d').drawImage(c, 0, 0); 
  return n; 
}

function makeKeyframe() {
  return {
    owners: S.owners.slice(), 
    countries: S.countries.map(c => ({ ...c })), 
    paint: cloneCanvas(S.paint),
    caption: S.caption, 
    hold: +$('hold').value || 0, 
    trans: +$('trans').value || 0
  };
}

function renderKeyframes() {
  const el = $('kfList'); 
  el.innerHTML = '';
  S.keyframes.forEach((k, i) => {
    const b = document.createElement('div');
    b.className = 'kf' + (i === S.sel ? ' sel' : '');
    b.innerHTML = '';
    b.textContent = (i + 1) + (k.caption ? ' · ' + k.caption : '');
    const s = document.createElement('small'); 
    s.textContent = k.hold + 's'; 
    b.appendChild(s);
    b.addEventListener('click', () => selectKeyframe(i));
    el.appendChild(b);
  });
  if (!S.keyframes.length) el.textContent = 'Sin fotogramas — Crea el mapa y presiona "+ Fotograma".';
}

function selectKeyframe(i) {
  const k = S.keyframes[i]; if (!k) return;
  S.sel = i;
  S.owners = k.owners.slice(); 
  S.countries = k.countries.map(c => ({ ...c }));
  S.pctx.clearRect(0, 0, S.w, S.h); 
  S.pctx.drawImage(k.paint, 0, 0);
  S.caption = k.caption; 
  $('caption').value = k.caption;
  $('hold').value = k.hold; 
  $('trans').value = k.trans;
  if (!S.countries.some(c => c.id === S.active)) {
    S.active = S.countries.length ? S.countries[0].id : 0;
  }
  S.undo = []; S.redo = [];
  renderCountries(); 
  renderKeyframes(); 
  redraw();
}

$('kfAdd').onclick = () => {
  const at = S.sel >= 0 ? S.sel + 1 : S.keyframes.length;
  S.keyframes.splice(at, 0, makeKeyframe()); 
  S.sel = at; 
  renderKeyframes();
};
$('kfUpdate').onclick = () => {   if (S.sel < 0) return setStatus('Selecciona un fotograma primero.');   S.keyframes[S.sel] = makeKeyframe();    renderKeyframes();    setStatus('Fotograma actualizado'); };$('kfDel').onclick = () => {
  if (S.sel < 0) return;
  S.keyframes.splice(S.sel, 1); 
  S.sel = Math.min(S.sel, S.keyframes.length - 1); 
  renderKeyframes();
};
function moveKf(d) {
  const i = S.sel, j = i + d;
  if (i < 0 || j < 0 || j >= S.keyframes.length) return;
  [S.keyframes[i], S.keyframes[j]] = [S.keyframes[j], S.keyframes[i]]; 
  S.sel = j; 
  renderKeyframes();
}
$('kfLeft').onclick = () => moveKf(-1);$('kfRight').onclick = () => moveKf(1);
$('hold').addEventListener('change', () => { if (S.sel >= 0) { S.keyframes[S.sel].hold = +$('hold').value || 0; renderKeyframes(); } });
$('trans').addEventListener('change', () => { if (S.sel >= 0) S.keyframes[S.sel].trans = +$('trans').value || 0; });
$('caption').addEventListener('input', () => { S.caption =$('caption').value; recompose(); });
for (const id of ['capSize', 'capPos', 'mode', 'opacity']) $(id).addEventListener('input', recompose);

// ==========================================
// 10. REPRODUCCIÓN Y GRABACIÓN DE VIDEO
// ==========================================
function pickMime() {
  if (!window.MediaRecorder) return null;
  return ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || null;
}

function download(blob, name) {
  const a = document.createElement('a'); 
  a.href = URL.createObjectURL(blob); 
  a.download = name;
  document.body.appendChild(a); 
  a.click(); 
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function play(record) {
  if (S.playing) return;
  const kfs = S.keyframes;
  if (!kfs.length) return setStatus('Agrega al menos un fotograma primero.');
  let mime = null;
  if (record) { 
    mime = pickMime(); 
    if (!mime) return setStatus('Este navegador no puede grabar video (intenta con Chrome o Edge).'); 
  }

  const tables = kfs.map(k => colorTable(k.owners, k.countries));
  const scratch = new Uint32Array(S.n + 1);
  const segs = []; let T = 0;
  
  kfs.forEach((k, i) => {
    if (i > 0 && k.trans > 0) { segs.push({ tr: true, a: i - 1, b: i, s: T, d: k.trans }); T += k.trans; }
    const d = (k.hold > 0 || i === kfs.length - 1) ? Math.max(k.hold, 0.1) : 0;
    if (d) { segs.push({ tr: false, a: i, s: T, d }); T += d; }
  });

  const draw = (seg, el) => {
    if (!seg.tr) {
      renderOverlay(tables[seg.a]);
      compose([[kfs[seg.a].paint, 1]], kfs[seg.a].caption);
    } else {
      const p = clamp((el - seg.s) / seg.d, 0, 1), e = p * p * (3 - 2 * p);
      renderOverlay(lerpTable(tables[seg.a], tables[seg.b], e, scratch));
      compose([[kfs[seg.a].paint, 1 - e], [kfs[seg.b].paint, e]], p < 0.5 ? kfs[seg.a].caption : kfs[seg.b].caption);
    }
  };

  let rec = null; const chunks = [];
  if (record) {
    rec = new MediaRecorder(cv.captureStream(30), { mimeType: mime, videoBitsPerSecond: 16e6 });
    rec.ondataavailable = ev => { if (ev.data.size) chunks.push(ev.data); };
    rec.onstop = () => download(new Blob(chunks, { type: mime }), 'map-video.' + (mime.includes('mp4') ? 'mp4' : 'webm'));
    rec.start();
  }
  S.playing = true;
  setStatus(record ? 'Grabando…' : 'Reproduciendo…');
  const t0 = performance.now();
  
  const finish = () => {
    S.playing = false;
    const done = () => { redraw(); setStatus(record ? 'Video guardado en descargas.' : ''); };
    if (rec) setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); done(); }, 350); else done();
  };
  
  const step = now => {
    if (!S.playing) { finish(); return; }
    const el = (now - t0) / 1000;
    if (el >= T) { draw(segs[segs.length - 1], T); finish(); return; }
    let seg = segs[0];
    for (const s of segs) if (el >= s.s) seg = s;
    draw(seg, el);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

$('playBtn').onclick = () => play(false);
$('recBtn').onclick = () => play(true);$('stopBtn').onclick = () => { S.playing = false; };

// ==========================================
// 11. GUARDAR Y CARGAR PROYECTOS
// ==========================================
$('exportPng').onclick = () => cv.toBlob(b => download(b, 'map-frame.png'));

$('savePrj').onclick = () => {
  const data = {
    v: 1, w: S.w, h: S.h, n: S.n, thr: +$('thr').value, nextId: S.nextId,
    countries: S.countries, owners: Array.from(S.owners), caption: S.caption,
    paint: S.paint.toDataURL(),
    keyframes: S.keyframes.map(k => ({
      countries: k.countries, owners: Array.from(k.owners), paint: k.paint.toDataURL(),
      caption: k.caption, hold: k.hold, trans: k.trans
    }))
  };
  download(new Blob([JSON.stringify(data)], { type: 'application/json' }), 'map-project.json');
};

const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

$('loadPrj').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (d.w !== S.w || d.h !== S.h || d.n !== S.n) {
      setStatus('El proyecto no coincide con el mapa cargado. Carga primero la misma imagen (con el umbral ' + d.thr + ').');
      return;
    }
    S.nextId = Math.max(S.nextId, d.nextId);
    S.countries = d.countries; S.owners = Int32Array.from(d.owners);
    S.caption = d.caption || ''; $('caption').value = S.caption;
    S.pctx.clearRect(0, 0, S.w, S.h); 
    S.pctx.drawImage(await loadImg(d.paint), 0, 0);
    S.keyframes = [];
    
    for (const k of d.keyframes) {
      const pc = mkCanvas(); pc.width = S.w; pc.height = S.h;
      pc.getContext('2d').drawImage(await loadImg(k.paint), 0, 0);
      S.keyframes.push({ countries: k.countries, owners: Int32Array.from(k.owners), paint: pc, caption: k.caption, hold: k.hold, trans: k.trans });
    }
    S.sel = -1; S.undo = []; S.redo = [];
    S.active = S.countries.length ? S.countries[0].id : 0;
    renderCountries(); renderKeyframes(); redraw(); setStatus('Proyecto cargado');
  } catch (err) { 
    setStatus('No se pudo cargar el proyecto: ' + err.message); 
  }
  e.target.value = '';
});

// ==========================================
// 12. EVENTOS DE UI (BOTONES, MENÚS)
// ==========================================
$('mapFile').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const img = new Image();
  img.onload = () => { 
    setMap(img); 
    resetCountries(); 
    renderCountries(); 
    URL.revokeObjectURL(img.src); 
  };
  img.src = URL.createObjectURL(f);
  e.target.value = '';
});

$('demoBtn').onclick = () => { demoMap(); resetCountries(); renderCountries(); };

$('thr').addEventListener('input', () => { $('thrVal').textContent =$('thr').value; });

$('redetect').onclick = () => {
  if (!S.base) return;
  if (!confirm('Re-detectar las provincias borrará a los dueños, pintura y fotogramas. ¿Continuar?')) return;
  S.pctx.clearRect(0, 0, S.w, S.h);
  const keep = S.countries.map(c => ({ ...c })), act = S.active;
  setMap(S.base);
  S.countries = keep; S.active = act; 
  renderCountries(); 
  redraw();
};

$('addCountry').onclick = () => { 
  const c = addCountry(); 
  renderCountries(); 
  setActive(c.id); 
};

$('warApply').onclick = () => {
  const a = S.countries.find(c => c.id === +$('warA').value);
  const b = S.countries.find(c => c.id === +$('warB').value);
  if (!a || !b || a === b) return setStatus('Elige dos países diferentes.');
  pushUndo(false); 
  a.color = '#d62728'; // Rojo para atacante
  b.color = '#1f77b4'; // Azul para defensor
  renderCountries(); 
  redraw();
};
$('warSwap').onclick = () => {
  const A = $('warA'), B =$('warB'), t = A.value; 
  A.value = B.value; B.value = t;
};

$('undoBtn').onclick = undo;
$('redoBtn').onclick = redo;

document.querySelectorAll('#tools button').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));

function setTool(t) {
  S.tool = t;
  document.querySelectorAll('#tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  view.style.cursor = t === 'pan' ? 'grab' : 'crosshair';
}

window.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    return;
  }
  if (e.code === 'Space') { S.space = true; e.preventDefault(); return; }
  const map = { f: 'fill', u: 'unown', p: 'pick', b: 'brush', e: 'eraser' };
  if (map[e.key]) setTool(map[e.key]);
  else if (/^[0-9]$/.test(e.key)) {
    const i = +e.key;
    if (i === 0) setActive(0); else if (S.countries[i - 1]) setActive(S.countries[i - 1].id);
  }
});
window.addEventListener('keyup', e => { if (e.code === 'Space') S.space = false; });

// ==========================================
// INICIAR APLICACIÓN
// ==========================================
initCountryDatabase(); // Inicia nuestro nuevo selector de continentes/países
resetCountries();
demoMap();
renderCountries();
renderKeyframes();

})();
