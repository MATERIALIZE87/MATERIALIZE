(() => {
'use strict';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hex2rgb = h => { 
  const n = parseInt(h.slice(1), 16); 
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; 
};
const mkCanvas = () => document.createElement('canvas');

const view = $('view');
const stage = $('stage');
const cv = $('main');
const ctx = cv.getContext('2d');
const ctxMenu = $('ctxMenu');

const MAXW = 2400;
const DEFAULT_MAP_PATH = 'balkan image_2.jpg';

// ==========================================
// 1. BASE DE DATOS DE PAÍSES (Ordenada)
// ==========================================
const countryDatabase = {
  "Europa": {
    "Albania": { hex: "#86190d", colorName: "Grubby Red" },
    "Austria": { hex: "#DCDBDB", colorName: "White" },
    "Belarus": { hex: "#64D46C", colorName: "Snow Pea" },
    "Belgium": { hex: "#af8212", colorName: "Brazen" },
    "Bosnia": { hex: "#4727ab", colorName: "Blue Violet" }, 
    "Bulgaria": { hex: "#19721f", colorName: "Bogey Green" },
    "Croatia": { hex: "#845392", colorName: "Purple Tanzanite" },
    "Cyprus": { hex: "#cfa667", colorName: "Muted Copper" },
    "Czechia": { hex: "#2e4ea1", colorName: "Dazzling Blue" },
    "Denmark": { hex: "#986849", colorName: "Toasted Bagel" },
    "Estonia": { hex: "#4466a9", colorName: "Bright Greek" },
    "Finland": { hex: "#c0d6e4", colorName: "Pale Blue" },
    "France": { hex: "#4c7aa9", colorName: "Blossom Blue" },
    "Germany": { hex: "#464037", colorName: "Dark Gray" },
    "Greece": { hex: "#4094a9", colorName: "Rainy Mood" }, 
    "Hungary": { hex: "#d79665", colorName: "Caramel Bar" },
    "Iceland": { hex: "#4f6170", colorName: "Dark Slate" },
    "Ireland": { hex: "#19801e", colorName: "Asian Spice" },
    "Italy": { hex: "#155d2c", colorName: "Crusoe Green" },
    "Kosovo": { hex: "#b4513a", colorName: "Crimson" },
    "Latvia": { hex: "#b9818c", colorName: "Lavanda" },
    "Lithuania": { hex: "#be9722", colorName: "Gold Nugget" },
    "Luxembourg": { hex: "#00bfa9", colorName: "Verditer" },
    "Moldavia": { hex: "#D3893D", colorName: "Autumn" },
    "Montenegro": { hex: "#bc685b", colorName: "Tapestry Red" },
    "Netherlands": { hex: "#d17e39", colorName: "Phoenix" },
    "North Macedonia": { hex: "#b27c5e", colorName: "Tan" },
    "Norway": { hex: "#6b2120", colorName: "Dark Burgundy" },
    "Poland": { hex: "#c36381", colorName: "Silk Ribbon" },
    "Portugal": { hex: "#05640a", colorName: "Rock Mold Green" },
    "Romania": { hex: "#d3a73d", colorName: "Cremini" },
    "Russia": { hex: "#369746", colorName: "Forest" },
    "Serbia": { hex: "#646aab", colorName: "Purple Night" },
    "Slovakia": { hex: "#768788", colorName: "Shadow Effect" },
    "Slovenia": { hex: "#4b1069", colorName: "Obsidian Shell" },
    "Spain": { hex: "#cd882a", colorName: "Dusk" },
    "Sweden": { hex: "#2a2ca8", colorName: "Depths of Night" },
    "Switzerland": { hex: "#a10b0a", colorName: "Christmas Red" },
    "Ukraine": { hex: "#1c5c9b", colorName: "Lapis Lazuli" },
    "United Kingdom": { hex: "#cb2e48", colorName: "Raspberry" }
  },
  "América": {
    "Argentina": { hex: "#5a8eaa", colorName: "Dull Sky Blue" },
    "Bolivia": { hex: "#b1855a", colorName: "Earth Brown" },
    "Brasil": { hex: "#467b46", colorName: "Jungle Green" },
    "Canadá": { hex: "#b45f5e", colorName: "Rosewood" },
    "Chile": { hex: "#9b4541", colorName: "Faded Crimson" },
    "Colombia": { hex: "#c4a34b", colorName: "Muted Gold" },
    "Costa Rica": { hex: "#8c3b3b", colorName: "Faded Crimson" },
    "Cuba": { hex: "#4a7979", colorName: "Faded Teal" },
    "Ecuador": { hex: "#c4a962", colorName: "Dusty Yellow" },
    "El Salvador": { hex: "#415a75", colorName: "Deep Slate" },
    "Estados Unidos": { hex: "#1c3c5e", colorName: "Navy Blue" },
    "Guatemala": { hex: "#638a8c", colorName: "Faded Cyan" },
    "Haití": { hex: "#3f4c6b", colorName: "Dull Indigo" },
    "Honduras": { hex: "#3e6475", colorName: "Steel Blue" },
    "Jamaica": { hex: "#6a7343", colorName: "Olive" },
    "México": { hex: "#1e5425", colorName: "Pine Green" },
    "Nicaragua": { hex: "#51758a", colorName: "Muted Azure" },
    "Panamá": { hex: "#8a5849", colorName: "Dusty Rust" },
    "Paraguay": { hex: "#576b5d", colorName: "Muted Green" },
    "Perú": { hex: "#a13f3d", colorName: "Brick Red" },
    "República Dominicana": { hex: "#624d73", colorName: "Muted Purple" },
    "Uruguay": { hex: "#a39965", colorName: "Khaki Yellow" },
    "Venezuela": { hex: "#c89b43", colorName: "Bronze Yellow" }
  },
  "Asia": {
    "Afganistán": { hex: "#5c755e", colorName: "Dusty Pine" },
    "Arabia Saudita": { hex: "#2d5e2e", colorName: "Hunter Green" },
    "Bangladesh": { hex: "#3a6142", colorName: "Jungle Green" },
    "China": { hex: "#c68d46", colorName: "Ochre" },
    "Corea del Norte": { hex: "#7a3131", colorName: "Faded Maroon" },
    "Corea del Sur": { hex: "#355a7a", colorName: "Steel Blue" },
    "Emiratos Árabes": { hex: "#b5a278", colorName: "Dull Gold" },
    "Filipinas": { hex: "#48688a", colorName: "Pacific Blue" },
    "India": { hex: "#b85f5f", colorName: "Raj Pink" },
    "Indonesia": { hex: "#a14f4f", colorName: "Dull Ruby" },
    "Irak": { hex: "#9b7241", colorName: "Camel Brown" },
    "Irán": { hex: "#456336", colorName: "Olive Drab" },
    "Israel": { hex: "#537491", colorName: "Muted Sapphire" },
    "Japón": { hex: "#a33632", colorName: "Crimson Red" },
    "Jordania": { hex: "#7a5c5c", colorName: "Muted Rose" },
    "Kazajistán": { hex: "#5f8f9e", colorName: "Steppe Blue" },
    "Líbano": { hex: "#5c7a65", colorName: "Faded Cedar" },
    "Malasia": { hex: "#a3863c", colorName: "Antique Brass" },
    "Mongolia": { hex: "#8c704b", colorName: "Nomad Brown" },
    "Myanmar": { hex: "#9e844a", colorName: "Brass" },
    "Omán": { hex: "#a68863", colorName: "Sandstone" },
    "Pakistán": { hex: "#2b5c38", colorName: "Deep Islamic Green" },
    "Siria": { hex: "#8a6650", colorName: "Desert Rust" },
    "Tailandia": { hex: "#b2a868", colorName: "Desert Sand" },
    "Taiwán": { hex: "#4c6680", colorName: "Slate Blue" },
    "Turquía": { hex: "#5e694b", colorName: "Khaki Green" },
    "Uzbekistán": { hex: "#487a6b", colorName: "Teal Green" },
    "Vietnam": { hex: "#c44b33", colorName: "Terracotta" },
    "Yemen": { hex: "#8a4545", colorName: "Faded Oxblood" }
  },
  "África": {
    "Angola": { hex: "#8c3b3b", colorName: "Oxblood" },
    "Argelia": { hex: "#426b42", colorName: "Dusty Green" },
    "Egipto": { hex: "#c7a56a", colorName: "Sand" },
    "Etiopía": { hex: "#3b633b", colorName: "Dark Fern" },
    "Ghana": { hex: "#a68846", colorName: "Ash Gold" },
    "Kenia": { hex: "#7a4a35", colorName: "Earth Red" },
    "Liberia": { hex: "#223555", colorName: "Deep Indigo" },
    "Libia": { hex: "#6c8052", colorName: "Olive Sand" },
    "Madagascar": { hex: "#a3544d", colorName: "Brick Rust" },
    "Malí": { hex: "#ad9c64", colorName: "Sahara Yellow" },
    "Marruecos": { hex: "#a54545", colorName: "Muted Red" },
    "Mozambique": { hex: "#4f7560", colorName: "Teal Drab" },
    "Nigeria": { hex: "#386b44", colorName: "Forest Green" },
    "República Democrática del Congo": { hex: "#45668a", colorName: "Basin Blue" },
    "Senegal": { hex: "#63875a", colorName: "Faded Green" },
    "Somalia": { hex: "#628da6", colorName: "Muted Azure" },
    "Sudáfrica": { hex: "#bb7b4e", colorName: "Rust Orange" },
    "Sudán": { hex: "#947c5d", colorName: "Desert Brown" },
    "Tanzania": { hex: "#587a41", colorName: "Savanna Green" },
    "Túnez": { hex: "#a15959", colorName: "Faded Carmine" },
    "Zimbabue": { hex: "#7d6b38", colorName: "Khaki" }
  },
  "Oceanía": {
    "Australia": { hex: "#9b6a4a", colorName: "Outback Brown" },
    "Fiyi": { hex: "#5f8599", colorName: "Reef Blue" },
    "Nueva Zelanda": { hex: "#4f5e4d", colorName: "Fern Drab" },
    "Papúa Nueva Guinea": { hex: "#8c4436", colorName: "Clay Red" },
    "Salomón": { hex: "#5e7345", colorName: "Isle Green" }
  }
};

const PALETTE = ['#c0392b', '#2e86c1', '#27ae60', '#f1c40f', '#8e44ad', '#e67e22', '#16a085', '#7f8c8d'];

const S = {
  w: 0, h: 0, base: null, labels: null, n: 0, 
  owners: null, groups: null, locked: null, centroids: null,
  countries: [], nextId: 1, active: 1,
  overlay: mkCanvas(), octx: null, ovData: null,
  lines: mkCanvas(),
  items: [],
  groupAnchor: 0,
  lasso: null,
  pendingImgPos: null,
  tool: 'fill', zoom: 1, panX: 0, panY: 0,
  keyframes: [], sel: -1, undo: [], redo: [],
  caption: '', playing: false, drag: null, space: false
};

// ==========================================
// 2. ESTADÍSTICAS Y ESTADO
// ==========================================
function updateStats(msg) {
  if (!S.owners || !S.n) {
    $('status').textContent = msg || '';
    return;
  }
  let colored = 0;
  for (let i = 1; i <= S.n; i++) {
    if (S.owners[i] > 0) colored++;
  }
  const baseText = `${S.n} provincias detectadas | ${colored} provincias coloreadas`;
  $('status').textContent = msg ? `${msg} — (${baseText})` : baseText;
}

// ==========================================
// 3. BASE DE DATOS DE PAÍSES UI
// ==========================================
function initCountryDatabase() {
  const continentSel = $('continentSelect');
  const countrySel = $('countrySelect');

  for (const continent in countryDatabase) {
    const opt = document.createElement('option');
    opt.value = continent; opt.textContent = continent;
    continentSel.appendChild(opt);
  }

  continentSel.addEventListener('change', () => {
    countrySel.innerHTML = '';
    const countries = countryDatabase[continentSel.value];
    for (const countryName in countries) {
      const opt = document.createElement('option');
      opt.value = countryName;
      opt.textContent = `${countryName} (${countries[countryName].colorName})`; 
      countrySel.appendChild(opt);
    }
  });

  continentSel.dispatchEvent(new Event('change'));

  $('addDbCountryBtn').addEventListener('click', () => {
    const continent = continentSel.value;
    const countryName = countrySel.value;
    const countryData = countryDatabase[continent][countryName];
    const existing = S.countries.find(c => c.name === countryName);
    if (existing) {
      setActive(existing.id);
      return;
    }
    const newCountry = addCountry(countryName, countryData.hex);
    renderCountries(); setActive(newCountry.id);
  });
}

// ==========================================
// 4. CARGA Y DETECCIÓN INTELIGENTE (Con soporte para Lagos)
// ==========================================
function loadDefaultBalkanMap() {
  const img = new Image();
  img.onload = () => {
    setMap(img);
    resetCountries();
    renderCountries();
  };
  img.onerror = () => {
    demoMap();
    resetCountries();
    renderCountries();
    updateStats('No se encontró "' + DEFAULT_MAP_PATH + '" en la carpeta, se cargó mapa demo.');
  };
  img.src = encodeURI(DEFAULT_MAP_PATH);
}

function setMap(src) {
  let w = src.width || src.naturalWidth;
  let h = src.height || src.naturalHeight;
  const sc = Math.min(1, MAXW / w);
  w = Math.round(w * sc); h = Math.round(h * sc);
  
  S.w = w; S.h = h;
  S.base = mkCanvas(); S.base.width = w; S.base.height = h;
  S.base.getContext('2d').drawImage(src, 0, 0, w, h);
  
  for (const c of [S.overlay, S.lines, cv]) { c.width = w; c.height = h; }
  
  S.octx = S.overlay.getContext('2d');
  S.ovData = S.octx.createImageData(w, h);
  stage.style.width = w + 'px'; stage.style.height = h + 'px';
  
  detectProvinces();
  
  S.owners = new Int32Array(S.n + 1);
  S.groups = new Int32Array(S.n + 1);
  S.locked = new Uint8Array(S.n + 1);
  for(let i = 1; i <= S.n; i++) S.groups[i] = i;
  
  S.items = [];
  S.keyframes = []; S.sel = -1; S.undo = []; S.redo = [];
  
  renderKeyframes(); fitView(); redraw();
}

function detectProvinces(preserveLines = false) {
  const { w, h } = S;
  const N = w * h;
  const isLine = new Uint8Array(N);
  
  if (!preserveLines) {
    const thr = +$('thr').value;
    const img = S.base.getContext('2d').getImageData(0, 0, w, h).data;
    const lineImg = S.lines.getContext('2d').createImageData(w, h);
    const ld = lineImg.data;
    
    for (let i = 0; i < N; i++) {
      const o = i * 4;
      const r = img[o], g = img[o + 1], b = img[o + 2], a = img[o + 3] / 255;
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) * a + 255 * (1 - a);
      
      // 1. Detectar si el píxel es agua azul (como el lago de Hungría o de los Balcanes)
      // Si el canal azul supera claramente al rojo, NO es línea de frontera, es un lago rellenable.
      const isWaterLake = (b > r + 25) && (b > 95);
      
      // 2. Diferenciar fronteras oscuras de las sombras cálidas de las montañas
      // Las sombras del relieve tienen un tono tierra/marrón más cálido (r > b + 20) y no son tan oscuras como el trazo negro.
      const isMountainShadow = (lum > 92) && (r > b + 22);

      if (!isWaterLake && !isMountainShadow && lum < thr) {
        isLine[i] = 1;
      }
      
      // Construir la capa de líneas limpias para el modo "Plano Simple"
      let al = 0;
      if (isLine[i]) {
        al = 255;
      } else if (!isWaterLake && !isMountainShadow && lum < thr + 18) {
        al = Math.round(255 * (1 - (lum - thr) / 18));
      }
      ld[o] = 28; ld[o + 1] = 28; ld[o + 2] = 28; ld[o + 3] = al;
    }
    S.lines.getContext('2d').putImageData(lineImg, 0, 0);
  } else {
    const ld = S.lines.getContext('2d').getImageData(0,0,w,h).data;
    for (let i = 0; i < N; i++) {
      if (ld[i*4+3] > 128) isLine[i] = 1; 
    }
  }

  let labels = new Int32Array(N);
  const stack = new Int32Array(N);
  let n = 0;
  
  for (let i = 0; i < N; i++) {
    if (isLine[i] || labels[i]) continue;
    n++; labels[i] = n;
    let sp = 0; stack[sp++] = i;
    
    while (sp) {
      const p = stack[--sp], x = p % w;
      if (x > 0 && !isLine[p - 1] && !labels[p - 1]) { labels[p - 1] = n; stack[sp++] = p - 1; }
      if (x < w - 1 && !isLine[p + 1] && !labels[p + 1]) { labels[p + 1] = n; stack[sp++] = p + 1; }
      if (p >= w && !isLine[p - w] && !labels[p - w]) { labels[p - w] = n; stack[sp++] = p - w; }
      if (p < N - w && !isLine[p + w] && !labels[p + w]) { labels[p + w] = n; stack[sp++] = p + w; }
    }
  }
  
  for (let pass = 0; pass < 5; pass++) {
    const next = labels.slice();
    for (let i = 0; i < N; i++) {
      if (labels[i]) continue;
      const x = i % w; let l = 0;
      if (x > 0) l = labels[i - 1];
      if (!l && x < w - 1) l = labels[i + 1];
      if (!l && i >= w) l = labels[i - w];
      if (!l && i < N - w) l = labels[i + w];
      if (l) next[i] = l;
    }
    labels = next;
  }
  S.labels = labels; S.n = n;
  computeCentroids();
}

function computeCentroids() {
  const { w, h, n, labels } = S;
  const sx = new Float64Array(n + 1);
  const sy = new Float64Array(n + 1);
  const cnt = new Int32Array(n + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const r = labels[row + x];
      if (r) { sx[r] += x; sy[r] += y; cnt[r]++; }
    }
  }
  S.centroids = new Array(n + 1);
  for (let i = 1; i <= n; i++) {
    S.centroids[i] = cnt[i] ? { x: sx[i] / cnt[i], y: sy[i] / cnt[i] } : { x: -1, y: -1 };
  }
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
  for (let i = 0; i < w * h; i++) { d[i * 4] = 222; d[i * 4 + 1] = 205; d[i * 4 + 2] = 181; d[i * 4 + 3] = 255; }
  const dark = i => { d[i * 4] = 40; d[i * 4 + 1] = 40; d[i * 4 + 2] = 40; };
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const i = y * w + x;
    if (cell[i] !== cell[i + 1]) { dark(i); dark(i + 1); }
    if (cell[i] !== cell[i + w]) { dark(i); dark(i + w); }
  }
  cx.putImageData(id, 0, 0);
  setMap(c);
}

// ==========================================
// 5. GESTIÓN DE PAÍSES Y MEMORIA DE COLORES
// ==========================================
function addCountry(name, color) {
  const chosenColor = color || PALETTE[(S.nextId - 2) % PALETTE.length];
  const c = { 
    id: S.nextId++, 
    name: name || ('País ' + S.nextId), 
    color: chosenColor,
    origColor: chosenColor // Guarda el color original para poder restaurarlo tras una Guerra Rápida
  };
  S.countries.push(c); 
  return c;
}

function resetCountries() {
  S.countries = [];
  // Incluye la herramienta de color de Mar/Lago lista para usar
  addCountry('🌊 Mar / Lago', '#0e79b2');
  addCountry('Serbia', '#646aab');
  addCountry('Croatia', '#845392');
  addCountry('Bosnia', '#4727ab');
  addCountry('Hungary', '#d79665');
  addCountry('Austria', '#DCDBDB');
  S.active = S.countries[1].id;
}

function renderCountries() {
  const el = $('countries'); el.innerHTML = '';
  const rows = [{ id: 0, name: 'Sin Dueño', color: null }, ...S.countries];
  
  rows.forEach((c, idx) => {
    const row = document.createElement('div'); row.className = 'crow'; row.dataset.id = c.id;
    if (c.color) {
      const col = document.createElement('input'); col.type = 'color'; col.value = c.color;
      col.addEventListener('input', () => { 
        c.color = col.value; 
        c.origColor = col.value; // Si el usuario cambia el color a mano, actualiza su color original
        redraw(); 
      });
      row.appendChild(col);
    } else {
      const sp = document.createElement('span'); sp.className = 'nosw'; row.appendChild(sp);
    }
    
    const nm = document.createElement('input'); nm.type = 'text'; nm.className = 'nm'; nm.value = c.name;
    if (!c.color) nm.disabled = true;
    nm.addEventListener('input', () => { c.name = nm.value; updateWarSelects(); });
    row.appendChild(nm);
    
    if (c.color) {
      const x = document.createElement('button'); x.className = 'x'; x.textContent = '×'; x.title = 'Eliminar país';
      x.addEventListener('click', ev => { ev.stopPropagation(); deleteCountry(c.id); });
      row.appendChild(x);
    }
    const k = document.createElement('span'); k.className = 'key'; k.textContent = idx < 10 ? idx : '';
    row.appendChild(k); row.addEventListener('click', () => setActive(c.id)); el.appendChild(row);
  });
  markActive(); updateWarSelects();
}

function markActive() { document.querySelectorAll('.crow').forEach(r => { r.classList.toggle('active', +r.dataset.id === S.active); }); }
function setActive(id) { S.active = id; markActive(); }
function deleteCountry(id) { 
  pushUndo(); 
  for (let i = 1; i <= S.n; i++) { if (S.owners[i] === id && !S.locked[i]) S.owners[i] = 0; } 
  S.countries = S.countries.filter(c => c.id !== id); 
  if (S.active === id) S.active = S.countries.length ? S.countries[0].id : 0; 
  renderCountries(); redraw(); 
}

function updateWarSelects() {
  for (const id of ['warA', 'warB']) {
    const sel = $(id); const prev = +sel.value; sel.innerHTML = '';
    S.countries.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; sel.appendChild(o); });
    if (S.countries.some(c => c.id === prev)) sel.value = prev;
  }
  if ($('warA').value === $('warB').value && S.countries.length > 1) { $('warB').selectedIndex = 1; }
}

function getOriginalColor(country) {
  if (country.origColor) return country.origColor;
  for (const cont in countryDatabase) {
    if (countryDatabase[cont][country.name]) return countryDatabase[cont][country.name].hex;
  }
  return country.color;
}

// ==========================================
// 6. MOTOR DE RENDERIZADO (2 Modos: Con Relieve vs Plano Simple)
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
    const aa = a >>> 24, ba = b >>> 24; let r, g, bl;
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

function drawItems(items) {
  if (!items) return;
  for (const it of items) {
    if (it.type === 'text') {
      const sz = it.size || 22;
      ctx.font = `bold ${sz}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, sz / 6);
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(it.text, it.x, it.y);
      ctx.fillStyle = it.color || '#ffffff';
      ctx.fillText(it.text, it.x, it.y);
    } else if (it.type === 'image' && it.img) {
      ctx.drawImage(it.img, it.x - it.w / 2, it.y - it.h / 2, it.w, it.h);
    }
  }
}

function drawCaption(text) {
  if (!text) return;
  const size = +$('capSize').value || 56;
  ctx.font = 'bold ' + size + 'px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const x = size * 0.6;
  const y = $('capPos').value === 'top' ? size * 1.3 : S.h - size * 0.6;
  ctx.lineJoin = 'round'; ctx.lineWidth = size / 5;
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.strokeText(text, x, y);
  ctx.fillStyle = '#111'; ctx.fillText(text, x, y);
}

function compose(items, caption) {
  const opacity = +$('opacity').value / 100;
  ctx.globalCompositeOperation = 'source-over'; 
  ctx.globalAlpha = 1;
  
  if ($('mode').value === 'relief') {
    // MODO 1: CON RELIEVE (Tinte suave sin manchas oscuras + soporte para colores blancos)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, S.w, S.h);
    ctx.globalAlpha = opacity;
    ctx.drawImage(S.overlay, 0, 0);
    
    // Multiplicar con la imagen base para que aparezcan las montañas suavemente
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(S.base, 0, 0);
    
    // Pequeño refuerzo de color encima para que países blancos (como Austria) se vean blancos y no beige
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = opacity * 0.28;
    ctx.drawImage(S.overlay, 0, 0);
    
    // Líneas de frontera nítidas
    ctx.globalAlpha = 0.65;
    ctx.drawImage(S.lines, 0, 0);
  } else {
    // MODO 2: PLANO SIMPLE (Oculta el relieve de las montañas por completo y deja colores 100% planos)
    ctx.fillStyle = '#d8c8b0'; // Color tierra neutro plano para provincias sin dueño
    ctx.fillRect(0, 0, S.w, S.h);
    
    ctx.globalAlpha = opacity;
    ctx.drawImage(S.overlay, 0, 0);
    
    ctx.globalAlpha = 1;
    ctx.drawImage(S.lines, 0, 0);
  }
  
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  drawItems(items);
  drawCaption(caption);

  if (S.lasso && S.lasso.length > 1) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(S.lasso[0].fx, S.lasso[0].fy);
    for (let i = 1; i < S.lasso.length; i++) ctx.lineTo(S.lasso[i].fx, S.lasso[i].fy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(241, 196, 15, 0.22)';
    ctx.fill();
    ctx.lineWidth = 2 / S.zoom;
    ctx.strokeStyle = '#f1c40f';
    ctx.setLineDash([6 / S.zoom, 4 / S.zoom]);
    ctx.stroke();
    ctx.restore();
  }
}

function redraw(msg) { 
  if (!S.labels || S.playing) return; 
  renderOverlay(colorTable(S.owners, S.countries)); 
  compose(S.items, S.caption); 
  updateStats(msg);
}
function recompose() { 
  if (S.labels && !S.playing) compose(S.items, S.caption); 
}

// ==========================================
// 7. DESHACER / REHACER
// ==========================================
function cloneItems(items) {
  return items.map(it => ({ ...it }));
}
function snap() {
  return {
    owners: S.owners.slice(), 
    groups: S.groups.slice(),
    locked: S.locked.slice(),
    countries: S.countries.map(c => ({ ...c })),
    items: cloneItems(S.items)
  };
}
function pushUndo() { S.undo.push(snap()); if (S.undo.length > 25) S.undo.shift(); S.redo.length = 0; }
function restore(e) {
  S.owners = e.owners.slice(); 
  S.groups = e.groups.slice(); 
  S.locked = e.locked.slice();
  S.countries = e.countries.map(c => ({ ...c }));
  S.items = cloneItems(e.items);
  renderCountries(); redraw();
}
function undo() { const e = S.undo.pop(); if (!e) return; S.redo.push(snap()); restore(e); }
function redo() { const e = S.redo.pop(); if (!e) return; S.undo.push(snap()); restore(e); }

// ==========================================
// 8. INTERACCIÓN, LAZO, ELEMENTOS Y MENÚ CLIC DERECHO
// ==========================================
function applyView() { stage.style.transform = `translate(${S.panX}px,${S.panY}px) scale(${S.zoom})`; }
function fitView() {
  const vw = view.clientWidth, vh = view.clientHeight;
  S.zoom = Math.min(vw / S.w, vh / S.h) * 0.98;
  S.panX = (vw - S.w * S.zoom) / 2; S.panY = (vh - S.h * S.zoom) / 2; applyView();
}

view.addEventListener('wheel', e => {
  e.preventDefault(); hideCtxMenu();
  const r = view.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  const nz = clamp(S.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.05, 20);
  S.panX = mx - (mx - S.panX) * (nz / S.zoom); S.panY = my - (my - S.panY) * (nz / S.zoom);
  S.zoom = nz; applyView();
}, { passive: false });
window.addEventListener('resize', () => { if (S.labels) fitView(); });

function toMap(e) {
  const r = cv.getBoundingClientRect();
  const fx = (e.clientX - r.left) / r.width * S.w; const fy = (e.clientY - r.top) / r.height * S.h;
  return { fx, fy, x: clamp(Math.floor(fx), 0, S.w - 1), y: clamp(Math.floor(fy), 0, S.h - 1) };
}

const regionAt = p => S.labels[p.y * S.w + p.x];

function isGroupLocked(targetGroup) {
  for (let i = 1; i <= S.n; i++) {
    if (S.groups[i] === targetGroup && S.locked[i]) return true;
  }
  return false;
}

function setGroupLock(targetGroup, lockVal) {
  for (let i = 1; i <= S.n; i++) {
    if (S.groups[i] === targetGroup) S.locked[i] = lockVal ? 1 : 0;
  }
}

function assignRegion(r, id) {
  if (!r) return;
  const targetGroup = S.groups[r];
  if (isGroupLocked(targetGroup)) {
    updateStats('🔒 Esta provincia está bloqueada.');
    return;
  }
  let changed = false;
  for (let i = 1; i <= S.n; i++) {
    if (S.groups[i] === targetGroup && !S.locked[i]) {
      if (S.owners[i] !== id) { S.owners[i] = id; changed = true; }
    }
  }
  if (changed) redraw();
}

function assign(p, id) { assignRegion(regionAt(p), id); }

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].fx, yi = poly[i].fy;
    const xj = poly[j].fx, yj = poly[j].fy;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function applyLassoGroup(poly) {
  const insideRegions = [];
  for (let i = 1; i <= S.n; i++) {
    const c = S.centroids[i];
    if (c && c.x >= 0 && pointInPoly(c.x, c.y, poly)) insideRegions.push(i);
  }
  if (!insideRegions.length) return updateStats('Ninguna provincia dentro del lazo.');
  
  pushUndo();
  const baseR = (S.groupAnchor && S.groups[S.groupAnchor]) ? S.groupAnchor : insideRegions[0];
  const targetG = S.groups[baseR];
  const owner = S.owners[baseR];
  S.groupAnchor = baseR;

  const groupsToMerge = new Set(insideRegions.map(r => S.groups[r]));
  for (let i = 1; i <= S.n; i++) {
    if (groupsToMerge.has(S.groups[i]) && !S.locked[i]) {
      S.groups[i] = targetG;
      S.owners[i] = owner;
    }
  }
  redraw(`🔗 ${insideRegions.length} provincias agrupadas con éxito.`);
}

function itemAt(p) {
  for (let i = S.items.length - 1; i >= 0; i--) {
    const it = S.items[i];
    if (it.type === 'text') {
      const w = Math.max(40, it.text.length * it.size * 0.55);
      const h = it.size * 1.2;
      if (Math.abs(p.fx - it.x) <= w / 2 && Math.abs(p.fy - it.y) <= h / 2) return i;
    } else if (it.type === 'image') {
      if (Math.abs(p.fx - it.x) <= it.w / 2 && Math.abs(p.fy - it.y) <= it.h / 2) return i;
    }
  }
  return -1;
}

function addTextAt(p, customText) {
  const txt = customText !== undefined ? customText : ($('mapTextInput').value.trim() || prompt('Texto a añadir en el mapa:'));
  if (!txt) return;
  pushUndo();
  S.items.push({
    type: 'text',
    x: p.fx, y: p.fy,
    text: txt,
    size: +$('itemSize').value || 22,
    color: $('itemColor').value || '#ffffff'
  });
  redraw('Texto añadido');
}

function triggerImageAt(p) {
  S.pendingImgPos = p;
  $('itemImgFile').click();
}

$('itemImgFile').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f || !S.pendingImgPos) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const src = ev.target.result;
    const img = new Image();
    img.onload = () => {
      pushUndo();
      const baseSize = (+$('itemSize').value || 22) * 3;
      const ratio = img.width / img.height;
      const w = ratio >= 1 ? baseSize : baseSize * ratio;
      const h = ratio >= 1 ? baseSize / ratio : baseSize;
      S.items.push({ type: 'image', x: S.pendingImgPos.fx, y: S.pendingImgPos.fy, w, h, src, img });
      redraw('Imagen añadida');
    };
    img.src = src;
  };
  reader.readAsDataURL(f);
  e.target.value = '';
});

function strokeSplit(a, b) {
  [S.lines.getContext('2d'), S.base.getContext('2d')].forEach(c => {
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = c.fillStyle = '#141414';
    c.lineWidth = 2.2; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(a.fx, a.fy); c.lineTo(b.fx, b.fy); c.stroke();
  });
}

function applySplit() {
  updateStats('Calculando nuevas fronteras...');
  setTimeout(() => {
    const oldLabels = S.labels, oldOwners = S.owners, oldGroups = S.groups, oldLocked = S.locked;
    detectProvinces(true);
    const newOwners = new Int32Array(S.n + 1), newGroups = new Int32Array(S.n + 1), newLocked = new Uint8Array(S.n + 1);
    const tallies = Array.from({length: S.n + 1}, () => new Map());
    
    for (let i = 0; i < S.w * S.h; i++) {
      const nL = S.labels[i], oL = oldLabels[i];
      if (nL && oL) { const t = tallies[nL]; t.set(oL, (t.get(oL) || 0) + 1); }
    }
    for (let i = 1; i <= S.n; i++) {
      let bestOld = 0, max = 0;
      for (const [oL, count] of tallies[i].entries()) {
        if (count > max) { max = count; bestOld = oL; }
      }
      if (bestOld) {
        newOwners[i] = oldOwners[bestOld];
        newGroups[i] = oldGroups ? oldGroups[bestOld] : bestOld;
        newLocked[i] = oldLocked ? oldLocked[bestOld] : 0;
      } else {
        newGroups[i] = i;
      }
    }
    S.owners = newOwners; S.groups = newGroups; S.locked = newLocked;
    S.undo = []; S.redo = [];
    redraw('Frontera creada');
  }, 10);
}

// ==========================================
// 9. MENÚ CONTEXTUAL (CLIC DERECHO)
// ==========================================
function hideCtxMenu() { ctxMenu.hidden = true; }
window.addEventListener('click', e => { if (!ctxMenu.contains(e.target)) hideCtxMenu(); });

view.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (!S.labels || S.playing) return;
  const p = toMap(e);
  const r = regionAt(p);
  const hitItemIdx = itemAt(p);
  
  ctxMenu.innerHTML = '';
  const addHeader = txt => {
    const h = document.createElement('div'); h.className = 'ctx-head'; h.textContent = txt; ctxMenu.appendChild(h);
  };
  const addItem = (label, fn) => {
    const div = document.createElement('div'); div.className = 'ctx-item'; div.textContent = label;
    div.onclick = () => { hideCtxMenu(); fn(); };
    ctxMenu.appendChild(div);
  };
  const addSep = () => {
    const s = document.createElement('div'); s.className = 'ctx-sep'; ctxMenu.appendChild(s);
  };

  if (r) {
    const g = S.groups[r];
    const locked = isGroupLocked(g);
    const ownerObj = S.countries.find(c => c.id === S.owners[r]);
    addHeader(`Provincia #${r} (${ownerObj ? ownerObj.name : 'Sin Dueño'})`);
    
    addItem(locked ? '🔓 Desbloquear provincia' : '🔒 Bloquear provincia (No editable)', () => {
      pushUndo();
      setGroupLock(g, !locked);
      redraw(!locked ? '🔒 Provincia bloqueada' : '🔓 Provincia desbloqueada');
    });

    if (!locked) {
      const actCountry = S.countries.find(c => c.id === S.active);
      if (actCountry) {
        addItem(`🏳️ Asignar a ${actCountry.name}`, () => { pushUndo(); assignRegion(r, S.active); });
      }
      const seaCountry = S.countries.find(c => c.name.includes('Mar') || c.color === '#0e79b2');
      if (seaCountry) {
        addItem('🌊 Pintar como Mar / Lago', () => { pushUndo(); assignRegion(r, seaCountry.id); });
      }
      addItem('🏳️ Desasignar (Sin Dueño)', () => { pushUndo(); assignRegion(r, 0); });
      addSep();
      addItem('🔗 Fijar como base de grupo', () => { S.groupAnchor = r; updateStats(`Provincia #${r} fijada como base de grupo.`); });
      if (S.groupAnchor && S.groupAnchor !== r) {
        addItem(`🔗 Unir al grupo de #${S.groupAnchor}`, () => {
          pushUndo();
          const targetG = S.groups[S.groupAnchor];
          const targetOwner = S.owners[S.groupAnchor];
          for (let i = 1; i <= S.n; i++) if (S.groups[i] === g) { S.groups[i] = targetG; S.owners[i] = targetOwner; }
          redraw('🔗 Provincias agrupadas');
        });
      }
      addItem('✂️ Desagrupar esta provincia', () => { pushUndo(); S.groups[r] = r; redraw('Provincia desagrupada'); });
    }
    addSep();
  }

  addItem('🔤 Añadir etiqueta de texto aquí...', () => {
    const t = prompt('Escribe el texto (ej. Capital, País, Alianza):', $('mapTextInput').value || '');
    if (t) addTextAt(p, t);
  });
  addItem('🖼️ Añadir imagen aquí...', () => triggerImageAt(p));

  if (hitItemIdx >= 0) {
    addSep();
    const hit = S.items[hitItemIdx];
    if (hit.type === 'text') {
      addItem(`✏️ Editar texto "${hit.text}"`, () => {
        const nt = prompt('Nuevo texto:', hit.text);
        if (nt !== null && nt.trim()) { pushUndo(); hit.text = nt.trim(); redraw(); }
      });
    }
    addItem('🗑️ Eliminar este elemento', () => { pushUndo(); S.items.splice(hitItemIdx, 1); redraw('Elemento eliminado'); });
  }

  ctxMenu.hidden = false;
  const mw = 230, mh = ctxMenu.offsetHeight || 260;
  ctxMenu.style.left = Math.min(e.clientX, window.innerWidth - mw - 10) + 'px';
  ctxMenu.style.top = Math.min(e.clientY, window.innerHeight - mh - 10) + 'px';
});

// ==========================================
// 10. EVENTOS DEL PUNTERO EN EL MAPA
// ==========================================
view.addEventListener('pointerdown', e => {
  if (S.playing || !S.labels) return;
  if (e.button === 2) return;
  hideCtxMenu();
  view.setPointerCapture(e.pointerId);
  
  if (e.button === 1 || S.space || S.tool === 'pan') {
    S.drag = { type: 'pan', x: e.clientX, y: e.clientY, px: S.panX, py: S.panY }; 
    return;
  }
  if (e.button !== 0) return;
  const p = toMap(e);
  
  switch (S.tool) {
    case 'fill': pushUndo(); S.drag = { type: 'fill' }; assign(p, S.active); break;
    case 'unown': pushUndo(); S.drag = { type: 'unown' }; assign(p, 0); break;
    case 'group':
      S.drag = { type: 'group', startP: p, isLasso: false };
      S.lasso = [p];
      break;
    case 'ungroup':
      pushUndo(); S.drag = { type: 'ungroup' }; 
      const ru = regionAt(p); if (ru && !S.locked[ru]) { S.groups[ru] = ru; redraw(); }
      break;
    case 'pick': 
      const rp = regionAt(p); if (rp) setActive(S.owners[rp]); break;
    case 'split': 
      S.drag = { type: 'split', last: p, moved: false }; strokeSplit(p, p); recompose(); break;
    case 'text':
      addTextAt(p); break;
    case 'image':
      triggerImageAt(p); break;
    case 'moveItem':
      const idx = itemAt(p);
      if (idx >= 0) {
        pushUndo();
        S.drag = { type: 'moveItem', idx, ox: S.items[idx].x - p.fx, oy: S.items[idx].y - p.fy };
      }
      break;
  }
});

view.addEventListener('pointermove', e => {
  const d = S.drag; if (!d) return;
  if (d.type === 'pan') { S.panX = d.px + e.clientX - d.x; S.panY = d.py + e.clientY - d.y; applyView(); return; }
  const p = toMap(e);
  
  if (d.type === 'fill') assign(p, S.active);
  else if (d.type === 'unown') assign(p, 0);
  else if (d.type === 'group') {
    const dist = Math.hypot(p.fx - d.startP.fx, p.fy - d.startP.fy);
    if (dist > 6) d.isLasso = true;
    if (d.isLasso) {
      S.lasso.push(p);
      recompose();
    }
  }
  else if (d.type === 'ungroup') {
    const r = regionAt(p); if (r && !S.locked[r] && S.groups[r] !== r) { S.groups[r] = r; redraw(); }
  }
  else if (d.type === 'split') { d.moved = true; strokeSplit(d.last, p); d.last = p; recompose(); }
  else if (d.type === 'moveItem') {
    const it = S.items[d.idx];
    it.x = p.fx + d.ox; it.y = p.fy + d.oy;
    recompose();
  }
});

const endDrag = e => {
  const d = S.drag; if (!d) return;
  if (d.type === 'group') {
    if (d.isLasso && S.lasso.length > 2) {
      applyLassoGroup(S.lasso);
    } else {
      const r = regionAt(d.startP);
      if (r && !S.locked[r]) {
        if (!S.groupAnchor || !S.groups[S.groupAnchor]) {
          S.groupAnchor = r;
          updateStats(`🔗 Provincia #${r} seleccionada como base. Haz clic en otras o usa el lazo para unirlas.`);
        } else if (r === S.groupAnchor) {
          S.groupAnchor = 0;
          updateStats('Selección de grupo reiniciada.');
        } else {
          pushUndo();
          const targetG = S.groups[S.groupAnchor];
          const owner = S.owners[S.groupAnchor];
          const oldG = S.groups[r];
          for (let i = 1; i <= S.n; i++) {
            if (S.groups[i] === oldG && !S.locked[i]) { S.groups[i] = targetG; S.owners[i] = owner; }
          }
          redraw(`🔗 Provincia #${r} unida al grupo #${S.groupAnchor}`);
        }
      }
    }
    S.lasso = null; recompose();
  } else if (d.type === 'split' && d.moved) {
    applySplit();
  }
  S.drag = null;
};
view.addEventListener('pointerup', endDrag); 
view.addEventListener('pointercancel', endDrag);

// ==========================================
// 11. ANIMACIÓN (KEYFRAMES) Y PROYECTO
// ==========================================
function makeKeyframe() {
  return { 
    owners: S.owners.slice(), 
    groups: S.groups.slice(), 
    locked: S.locked.slice(),
    countries: S.countries.map(c => ({ ...c })), 
    items: cloneItems(S.items),
    caption: S.caption, 
    hold: +$('hold').value || 0, 
    trans: +$('trans').value || 0 
  };
}

function renderKeyframes() {
  const el = $('kfList'); el.innerHTML = '';
  S.keyframes.forEach((k, i) => {
    const b = document.createElement('div'); b.className = 'kf' + (i === S.sel ? ' sel' : '');
    b.textContent = (i + 1) + (k.caption ? ' · ' + k.caption : '');
    const s = document.createElement('small'); s.textContent = k.hold + 's'; b.appendChild(s);
    b.addEventListener('click', () => selectKeyframe(i)); el.appendChild(b);
  });
  if (!S.keyframes.length) el.textContent = 'Sin fotogramas — Colorea el mapa y presiona "+ Fotograma".';
}

function selectKeyframe(i) {
  const k = S.keyframes[i]; if (!k) return;
  S.sel = i; 
  S.owners = k.owners.slice(); 
  S.groups = k.groups ? k.groups.slice() : new Int32Array(S.n+1).map((_,idx)=>idx);
  S.locked = k.locked ? k.locked.slice() : new Uint8Array(S.n+1);
  S.countries = k.countries.map(c => ({ ...c }));
  S.items = cloneItems(k.items || []);
  S.caption = k.caption; $('caption').value = k.caption; 
  $('hold').value = k.hold; $('trans').value = k.trans;
  S.undo = []; S.redo = []; renderCountries(); renderKeyframes(); redraw();
}

$('kfAdd').onclick = () => { const at = S.sel >= 0 ? S.sel + 1 : S.keyframes.length; S.keyframes.splice(at, 0, makeKeyframe()); S.sel = at; renderKeyframes(); };
$('kfUpdate').onclick = () => { if (S.sel < 0) return; S.keyframes[S.sel] = makeKeyframe(); renderKeyframes(); updateStats('Fotograma actualizado'); };$('kfDel').onclick = () => { if (S.sel < 0) return; S.keyframes.splice(S.sel, 1); S.sel = Math.min(S.sel, S.keyframes.length - 1); renderKeyframes(); };

function moveKf(d) {
  const i = S.sel, j = i + d;
  if (i < 0 || j < 0 || j >= S.keyframes.length) return;
  [S.keyframes[i], S.keyframes[j]] = [S.keyframes[j], S.keyframes[i]]; S.sel = j; renderKeyframes();
}
$('kfLeft').onclick = () => moveKf(-1);$('kfRight').onclick = () => moveKf(1);
$('hold').addEventListener('change', () => { if (S.sel >= 0) { S.keyframes[S.sel].hold = +$('hold').value || 0; renderKeyframes(); } });
$('trans').addEventListener('change', () => { if (S.sel >= 0) S.keyframes[S.sel].trans = +$('trans').value || 0; });
$('caption').addEventListener('input', () => { S.caption =$('caption').value; recompose(); });
for (const id of ['capSize', 'capPos', 'mode', 'opacity']) $(id).addEventListener('input', recompose);

function pickMime() {
  if (!window.MediaRecorder) return null;
  return ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || null;
}

function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function play(record) {
  if (S.playing) return;
  const kfs = S.keyframes;
  if (!kfs.length) return updateStats('Agrega al menos un fotograma primero.');
  let mime = null;
  if (record) { mime = pickMime(); if (!mime) return updateStats('Navegador no compatible con grabación.'); }

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
      compose(kfs[seg.a].items, kfs[seg.a].caption);
    } else {
      const p = clamp((el - seg.s) / seg.d, 0, 1), e = p * p * (3 - 2 * p);
      renderOverlay(lerpTable(tables[seg.a], tables[seg.b], e, scratch));
      const activeK = p < 0.5 ? kfs[seg.a] : kfs[seg.b];
      compose(activeK.items, activeK.caption);
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
  updateStats(record ? 'Grabando…' : 'Reproduciendo…');
  const t0 = performance.now();
  
  const finish = () => {
    S.playing = false;
    const done = () => { redraw(record ? 'Video guardado en descargas.' : ''); };
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

$('playBtn').onclick = () => play(false);$('recBtn').onclick = () => play(true);
$('stopBtn').onclick = () => { S.playing = false; };$('exportPng').onclick = () => cv.toBlob(b => download(b, 'map-frame.png'));

function serializeItems(items) {
  return items.map(it => {
    const copy = { ...it };
    delete copy.img;
    return copy;
  });
}

async function deserializeItems(rawItems) {
  if (!rawItems) return [];
  const out = [];
  for (const it of rawItems) {
    if (it.type === 'image' && it.src) {
      const img = await loadImg(it.src);
      out.push({ ...it, img });
    } else {
      out.push({ ...it });
    }
  }
  return out;
}

$('savePrj').onclick = () => {
  const data = {
    v: 3, w: S.w, h: S.h, n: S.n, thr: +$('thr').value, nextId: S.nextId,
    countries: S.countries, owners: Array.from(S.owners), groups: Array.from(S.groups), locked: Array.from(S.locked),
    items: serializeItems(S.items), caption: S.caption,
    keyframes: S.keyframes.map(k => ({
      countries: k.countries, owners: Array.from(k.owners), groups: Array.from(k.groups), locked: Array.from(k.locked || []),
      items: serializeItems(k.items || []), caption: k.caption, hold: k.hold, trans: k.trans
    }))
  };
  download(new Blob([JSON.stringify(data)], { type: 'application/json' }), 'map-project.json');
};

const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

$('loadPrj').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (d.w !== S.w || d.n !== S.n) return updateStats('Carga primero el mapa correspondiente (Umbral ' + d.thr + ').');
    S.nextId = Math.max(S.nextId, d.nextId || 1);
    S.owners = Int32Array.from(d.owners); 
    S.groups = d.groups ? Int32Array.from(d.groups) : new Int32Array(S.n + 1).map((_,i)=>i);
    S.locked = d.locked ? Uint8Array.from(d.locked) : new Uint8Array(S.n + 1);
    S.countries = d.countries; S.caption = d.caption || ''; $('caption').value = S.caption;
    S.items = await deserializeItems(d.items);
    S.keyframes = [];
    for (const k of d.keyframes) {
      S.keyframes.push({
        countries: k.countries,
        owners: Int32Array.from(k.owners),
        groups: k.groups ? Int32Array.from(k.groups) : new Int32Array(S.n + 1).map((_,i)=>i),
        locked: k.locked ? Uint8Array.from(k.locked) : new Uint8Array(S.n + 1),
        items: await deserializeItems(k.items),
        caption: k.caption, hold: k.hold, trans: k.trans
      });
    }
    S.sel = -1; renderCountries(); renderKeyframes(); redraw('Proyecto cargado');
  } catch (err) {
    updateStats('Error al cargar proyecto: ' + err.message);
  }
  e.target.value = '';
});

// ==========================================
// 12. EVENTOS DE UI, GUERRA RÁPIDA Y ATAJOS
// ==========================================
$('mapFile').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; const img = new Image(); img.onload = () => { setMap(img); resetCountries(); renderCountries(); }; img.src = URL.createObjectURL(f); e.target.value = ''; });$('demoBtn').onclick = () => loadDefaultBalkanMap();
$('thr').addEventListener('input', () => {$('thrVal').textContent = $('thr').value; });$('redetect').onclick = () => { 
  if (!S.base) return;
  if (confirm('Re-detectar provincias reiniciará las asignaciones actuales. ¿Continuar?')) { 
    const keep = S.countries, act = S.active; 
    setMap(S.base); S.countries = keep; S.active = act; 
    renderCountries(); redraw(); 
  } 
};

$('addCountry').onclick = () => { const c = addCountry(); renderCountries(); setActive(c.id); };

// Aplicar Rojo vs Azul guardando antes el color original
$('warApply').onclick = () => {
  const a = S.countries.find(c => c.id === +$('warA').value);
  const b = S.countries.find(c => c.id === +$('warB').value);
  if (!a || !b || a === b) return updateStats('Elige dos países diferentes.');
  pushUndo();
  if (a.color !== '#d62728' && a.color !== '#1f77b4') a.origColor = a.color;
  if (b.color !== '#d62728' && b.color !== '#1f77b4') b.origColor = b.color;
  a.color = '#d62728'; 
  b.color = '#1f77b4'; 
  renderCountries(); 
  redraw('⚔️ Colores de guerra aplicados');
};

$('warSwap').onclick = () => { 
  const A = $('warA'), B =$('warB'), t = A.value; 
  A.value = B.value; B.value = t; 
};

// Restaurar los colores originales de los dos países seleccionados en Guerra Rápida
$('warRestore').onclick = () => {
  const a = S.countries.find(c => c.id === +$('warA').value);
  const b = S.countries.find(c => c.id === +$('warB').value);
  if (!a && !b) return;
  pushUndo();
  if (a) a.color = getOriginalColor(a);
  if (b) b.color = getOriginalColor(b);
  renderCountries();
  redraw('↺ Colores originales restaurados');
};

$('undoBtn').onclick = undo;
$('redoBtn').onclick = redo;

document.querySelectorAll('#tools button').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
function setTool(t) { 
  S.tool = t; 
  document.querySelectorAll('#tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); 
  view.style.cursor = t === 'pan' ? 'grab' : (t === 'moveItem' ? 'move' : 'crosshair'); 
}

window.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && e.target.type !== 'range') return;
  if (e.ctrlKey || e.metaKey) {
    if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    return;
  }
  if (e.code === 'Space') { S.space = true; e.preventDefault(); return; }
  const map = { f: 'fill', u: 'unown', g: 'group', h: 'ungroup', s: 'split', p: 'pick', t: 'text', i: 'image', v: 'moveItem' };
  if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
});
window.addEventListener('keyup', e => { if (e.code === 'Space') S.space = false; });

initCountryDatabase();
loadDefaultBalkanMap();

})();
