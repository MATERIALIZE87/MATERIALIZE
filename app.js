(() => {
'use strict';

// ============================================================================
// MÓDULO 1: UTILIDADES Y CONSTANTES
// ============================================================================
const $ = id => document.getElementById(id);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const mkCanvas = (w = 1, h = 1) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};
const hex2rgb = hex => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const MAX_WIDTH = 2400;
const DEFAULT_MAP_FILE = 'balkan image_2.jpg';
const DEFAULT_PALETTE = ['#c0392b', '#2e86c1', '#27ae60', '#f1c40f', '#8e44ad', '#e67e22', '#16a085', '#7f8c8d'];

// ============================================================================
// MÓDULO 2: BASE DE DATOS DE PAÍSES (Estilo HOI4 - Ordenada Alfabéticamente)
// ============================================================================
const COUNTRY_DB = {
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

// ============================================================================
// MÓDULO 3: ESTADO GLOBAL DE LA APLICACIÓN
// ============================================================================
const view = $('view');
const stage = $('stage');
const cv = $('mainCanvas');
const ctx = cv.getContext('2d');
const ctxMenu = $('ctxMenu');

const State = {
  w: 0,
  h: 0,
  baseCanvas: mkCanvas(),       // Imagen original del mapa
  overlayCanvas: mkCanvas(),    // Colores sólidos de las provincias
  overlayCtx: null,
  overlayImgData: null,
  linesCanvas: mkCanvas(),      // Fronteras extraídas para dibujarse encima
  customBorders: null,          // Uint8Array(w*h): Fronteras dibujadas por el usuario
  
  n: 0,                         // Total de provincias detectadas
  labels: null,                 // Int32Array(w*h): ID de provincia para cada píxel
  owners: null,                 // Int32Array(n+1): ID del país dueño de cada provincia
  groups: null,                 // Int32Array(n+1): ID de grupo (0 = sin agrupar, >0 = agrupada)
  nextGroupId: 1,               // Contador de grupos creados por el usuario
  locked: null,                 // Uint8Array(n+1): 1 si la provincia está bloqueada
  centroids: null,              // Array de coordenadas {x, y} por provincia
  
  countries: [],                // Lista de países activos: {id, name, color, origColor}
  nextCountryId: 1,
  activeCountryId: 1,
  groupAnchor: 0,               // Provincia base seleccionada para agrupar por clic
  
  items: [],                    // Textos e imágenes sobre el mapa
  nextItemId: 1,
  pendingImagePos: null,
  
  tool: 'fill',
  zoom: 1,
  panX: 0,
  panY: 0,
  spacePressed: false,
  drag: null,                   // Estado de arrastre activo
  lassoPoints: null,            // Puntos del polígono de lazo
  splitPoints: null,            // Puntos del trazo de nueva frontera
  
  keyframes: [],
  selectedKf: -1,
  caption: '',
  playing: false,
  
  undoStack: [],
  redoStack: []
};

// ============================================================================
// MÓDULO 4: CONTADOR DE ESTADÍSTICAS Y BARRA DE ESTADO
// ============================================================================
function updateStatus(customMsg = '') {
  if (!State.owners || !State.n) {
    $('status').textContent = customMsg;
    return;
  }
  let coloredCount = 0;
  for (let i = 1; i <= State.n; i++) {
    if (State.owners[i] > 0) coloredCount++;
  }
  const stats = `${State.n} provincias detectadas | ${coloredCount} provincias coloreadas`;
  $('status').textContent = customMsg ? `${customMsg} — (${stats})` : stats;
}

// ============================================================================
// MÓDULO 5: MOTOR DE DETECCIÓN Y DIVISIÓN DE PROVINCIAS
// ============================================================================
function initMapFromImage(imgElement) {
  let w = imgElement.width || imgElement.naturalWidth;
  let h = imgElement.height || imgElement.naturalHeight;
  const scale = Math.min(1, MAX_WIDTH / w);
  w = Math.round(w * scale);
  h = Math.round(h * scale);

  State.w = w;
  State.h = h;

  for (const c of [State.baseCanvas, State.overlayCanvas, State.linesCanvas, cv]) {
    c.width = w;
    c.height = h;
  }

  State.baseCanvas.getContext('2d').drawImage(imgElement, 0, 0, w, h);
  State.overlayCtx = State.overlayCanvas.getContext('2d');
  State.overlayImgData = State.overlayCtx.createImageData(w, h);
  State.customBorders = new Uint8Array(w * h);

  stage.style.width = w + 'px';
  stage.style.height = h + 'px';

  runProvinceDetection();

  State.owners = new Int32Array(State.n + 1);
  State.groups = new Int32Array(State.n + 1); // 0 = provincia independiente
  State.locked = new Uint8Array(State.n + 1);
  State.nextGroupId = 1;
  State.groupAnchor = 0;
  State.items = [];
  State.keyframes = [];
  State.selectedKf = -1;
  State.undoStack = [];
  State.redoStack = [];

  renderKeyframesUI();
  fitMapToViewport();
  renderScene();
}

function runProvinceDetection() {
  const { w, h, customBorders } = State;
  const N = w * h;
  const thr = +$('thr').value;
  const baseData = State.baseCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const lineImgData = State.linesCanvas.getContext('2d').createImageData(w, h);
  const ld = lineImgData.data;
  const isLine = new Uint8Array(N);

  // 1. Detectar píxeles de frontera por umbral + fronteras dibujadas por el usuario
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    const alpha = baseData[o + 3] / 255;
    const lum = (0.299 * baseData[o] + 0.587 * baseData[o + 1] + 0.114 * baseData[o + 2]) * alpha + 255 * (1 - alpha);

    if (customBorders[i] || lum < thr) {
      isLine[i] = 1;
    }

    let lineAlpha = 0;
    if (customBorders[i] || lum < thr) {
      lineAlpha = 255;
    } else if (lum < thr + 45) {
      lineAlpha = Math.round(255 * (1 - (lum - thr) / 45));
    }
    ld[o] = 22;
    ld[o + 1] = 22;
    ld[o + 2] = 22;
    ld[o + 3] = lineAlpha;
  }
  State.linesCanvas.getContext('2d').putImageData(lineImgData, 0, 0);

  // 2. Flood-Fill de 4 direcciones para etiquetar cada provincia cerrada
  let labels = new Int32Array(N);
  const stack = new Int32Array(N);
  let provinceCount = 0;

  for (let i = 0; i < N; i++) {
    if (isLine[i] || labels[i]) continue;
    provinceCount++;
    labels[i] = provinceCount;
    let sp = 0;
    stack[sp++] = i;

    while (sp > 0) {
      const p = stack[--sp];
      const x = p % w;
      if (x > 0 && !isLine[p - 1] && !labels[p - 1]) { labels[p - 1] = provinceCount; stack[sp++] = p - 1; }
      if (x < w - 1 && !isLine[p + 1] && !labels[p + 1]) { labels[p + 1] = provinceCount; stack[sp++] = p + 1; }
      if (p >= w && !isLine[p - w] && !labels[p - w]) { labels[p - w] = provinceCount; stack[sp++] = p - w; }
      if (p < N - w && !isLine[p + w] && !labels[p + w]) { labels[p + w] = provinceCount; stack[sp++] = p + w; }
    }
  }

  // 3. Dilatación suave de etiquetas bajo los bordes para evitar halos sin pintar
  for (let pass = 0; pass < 5; pass++) {
    const next = labels.slice();
    for (let i = 0; i < N; i++) {
      if (labels[i]) continue;
      const x = i % w;
      let neighborLabel = 0;
      if (x > 0) neighborLabel = labels[i - 1];
      if (!neighborLabel && x < w - 1) neighborLabel = labels[i + 1];
      if (!neighborLabel && i >= w) neighborLabel = labels[i - w];
      if (!neighborLabel && i < N - w) neighborLabel = labels[i + w];
      if (neighborLabel) next[i] = neighborLabel;
    }
    labels = next;
  }

  State.labels = labels;
  State.n = provinceCount;
  computeProvinceCentroids();
}

function computeProvinceCentroids() {
  const { w, h, n, labels } = State;
  const sumX = new Float64Array(n + 1);
  const sumY = new Float64Array(n + 1);
  const count = new Int32Array(n + 1);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const r = labels[row + x];
      if (r) {
        sumX[r] += x;
        sumY[r] += y;
        count[r]++;
      }
    }
  }

  State.centroids = new Array(n + 1);
  for (let i = 1; i <= n; i++) {
    State.centroids[i] = count[i]
      ? { x: sumX[i] / count[i], y: sumY[i] / count[i] }
      : { x: -1, y: -1 };
  }
}

// Graba un trazo de frontera en customBorders y recalcula las provincias conservando dueños
function commitSplitBorder(points) {
  if (!points || points.length < 2) return;
  pushUndoState();

  const { w, h } = State;
  const tempCanvas = mkCanvas(w, h);
  const tctx = tempCanvas.getContext('2d');
  tctx.strokeStyle = '#ffffff';
  tctx.lineWidth = 3.5; // Grosor sólido que garantiza cierre sin fugas de 1px
  tctx.lineCap = 'round';
  tctx.lineJoin = 'round';
  tctx.beginPath();
  tctx.moveTo(points[0].fx, points[0].fy);
  for (let i = 1; i < points.length; i++) {
    tctx.lineTo(points[i].fx, points[i].fy);
  }
  tctx.stroke();

  const maskData = tctx.getImageData(0, 0, w, h).data;
  for (let i = 0; i < w * h; i++) {
    if (maskData[i * 4 + 3] > 60) {
      State.customBorders[i] = 1;
    }
  }

  const oldLabels = State.labels;
  const oldOwners = State.owners;
  const oldGroups = State.groups;
  const oldLocked = State.locked;

  runProvinceDetection();

  // Mapear cada nueva provincia a su provincia madre original
  const newOwners = new Int32Array(State.n + 1);
  const newGroups = new Int32Array(State.n + 1);
  const newLocked = new Uint8Array(State.n + 1);
  const parentOfNew = new Int32Array(State.n + 1);
  const childrenCountOfOld = new Int32Array(oldOwners.length);

  for (let i = 0; i < w * h; i++) {
    const nL = State.labels[i];
    if (nL && !parentOfNew[nL] && oldLabels[i]) {
      parentOfNew[nL] = oldLabels[i];
    }
  }

  for (let i = 1; i <= State.n; i++) {
    const oldId = parentOfNew[i];
    if (oldId) childrenCountOfOld[oldId]++;
  }

  for (let i = 1; i <= State.n; i++) {
    const oldId = parentOfNew[i];
    if (oldId) {
      newOwners[i] = oldOwners[oldId];
      newLocked[i] = oldLocked[oldId];
      // Si la provincia fue partida en 2 o más pedazos, desagrupar los pedazos para que sean independientes
      if (childrenCountOfOld[oldId] > 1) {
        newGroups[i] = 0;
      } else {
        newGroups[i] = oldGroups[oldId];
      }
    }
  }

  State.owners = newOwners;
  State.groups = newGroups;
  State.locked = newLocked;
  renderScene('✂️ Nueva frontera aplicada y provincias divididas');
}

// ============================================================================
// MÓDULO 6: MOTOR DE RENDERIZADO (Sin Tintes, Soporte Blanco Puro)
// ============================================================================
function buildColorLookupTable(owners, countries) {
  const table = new Uint32Array(State.n + 1);
  const rgbMap = new Map(countries.map(c => [c.id, hex2rgb(c.color)]));
  for (let i = 1; i <= State.n; i++) {
    const rgb = rgbMap.get(owners[i]);
    if (rgb) {
      table[i] = ((255 << 24) | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0]) >>> 0;
    }
  }
  return table;
}

function paintOverlayBuffer(colorTable) {
  const buf32 = new Uint32Array(State.overlayImgData.data.buffer);
  const labels = State.labels;
  for (let i = 0; i < labels.length; i++) {
    buf32[i] = colorTable[labels[i]];
  }
  State.overlayCtx.putImageData(State.overlayImgData, 0, 0);
}

function composeCanvasFrame(items, captionText) {
  const { w, h } = State;
  const opacity = +$('opacity').value / 100;

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  // 1. Imagen del mapa base
  ctx.drawImage(State.baseCanvas, 0, 0);

  // 2. Colores de provincias directos (el blanco se ve blanco, sin tintes)
  ctx.globalAlpha = opacity;
  ctx.drawImage(State.overlayCanvas, 0, 0);

  // 3. Líneas de frontera encima para máxima nitidez
  ctx.globalAlpha = 1;
  ctx.drawImage(State.linesCanvas, 0, 0);

  // 4. Elementos del mapa (Textos e Imágenes)
  if (items && items.length) {
    for (const it of items) {
      if (it.type === 'text') {
        const sz = it.size || 22;
        ctx.font = `bold ${sz}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(2.5, sz / 5.5);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.strokeText(it.text, it.x, it.y);
        ctx.fillStyle = it.color || '#ffffff';
        ctx.fillText(it.text, it.x, it.y);
      } else if (it.type === 'image' && it.img) {
        ctx.drawImage(it.img, it.x - it.w / 2, it.y - it.h / 2, it.w, it.h);
      }
    }
  }

  // 5. Título / Fecha de la línea de tiempo
  if (captionText) {
    const capSize = +$('capSizeInput').value || 56;
    ctx.font = `bold ${capSize}px      system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const x = capSize * 0.6;
    const y = $('capPosSelect').value === 'top' ? capSize * 1.3 : h - capSize * 0.6;
    ctx.lineJoin = 'round';
    ctx.lineWidth = capSize / 5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.strokeText(captionText, x, y);
    ctx.fillStyle = '#111111';
    ctx.fillText(captionText, x, y);
  }

  // 6. Previsualización de Lazo de Agrupación
  if (State.lassoPoints && State.lassoPoints.length > 1) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(State.lassoPoints[0].fx, State.lassoPoints[0].fy);
    for (let i = 1; i < State.lassoPoints.length; i++) {
      ctx.lineTo(State.lassoPoints[i].fx, State.lassoPoints[i].fy);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(241, 196, 15, 0.22)';
    ctx.fill();
    ctx.lineWidth = 2 / State.zoom;
    ctx.strokeStyle = '#f1c40f';
    ctx.setLineDash([6 / State.zoom, 4 / State.zoom]);
    ctx.stroke();
    ctx.restore();
  }

  // 7. Previsualización de Nueva Frontera en vivo
  if (State.splitPoints && State.splitPoints.length > 1) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(State.splitPoints[0].fx, State.splitPoints[0].fy);
    for (let i = 1; i < State.splitPoints.length; i++) {
      ctx.lineTo(State.splitPoints[i].fx, State.splitPoints[i].fy);
    }
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#141414';
    ctx.stroke();
    ctx.restore();
  }
}

function renderScene(statusMsg = '') {
  if (!State.labels || State.playing) return;
  paintOverlayBuffer(buildColorLookupTable(State.owners, State.countries));
  composeCanvasFrame(State.items, State.caption);
  updateStatus(statusMsg);
}

function recomposeOnly() {
  if (State.labels && !State.playing) {
    composeCanvasFrame(State.items, State.caption);
  }
}

// ============================================================================
// MÓDULO 7: GESTIÓN DE PROVINCIAS, GRUPOS Y BLOQUEOS
// ============================================================================
function getProvinceMembers(provId) {
  if (!provId) return [];
  const gid = State.groups[provId];
  if (!gid) return [provId];
  const members = [];
  for (let i = 1; i <= State.n; i++) {
    if (State.groups[i] === gid) members.push(i);
  }
  return members;
}

function isProvinceLocked(provId) {
  const members = getProvinceMembers(provId);
  return members.some(m => State.locked[m] === 1);
}

function setProvinceLock(provId, lockFlag) {
  const members = getProvinceMembers(provId);
  for (const m of members) {
    State.locked[m] = lockFlag ? 1 : 0;
  }
}

function assignProvinceOwner(provId, countryId) {
  if (!provId) return false;
  if (isProvinceLocked(provId)) {
    updateStatus(`🔒 La provincia #${provId} está bloqueada.`);
    return false;
  }
  const members = getProvinceMembers(provId);
  let changed = false;
  for (const m of members) {
    if (!State.locked[m] && State.owners[m] !== countryId) {
      State.owners[m] = countryId;
      changed = true;
    }
  }
  if (changed) renderScene();
  return changed;
}

function mergeProvincesIntoGroup(provList, anchorProvId = 0) {
  const unlockedProvs = provList.filter(r => r > 0 && !State.locked[r]);
  if (!unlockedProvs.length) {
    updateStatus('Ninguna provincia desbloqueada seleccionada para agrupar.');
    return;
  }

  pushUndoState();
  const baseProv = (anchorProvId && !State.locked[anchorProvId]) ? anchorProvId : unlockedProvs[0];
  let targetGroupId = State.groups[baseProv];
  if (!targetGroupId) {
    targetGroupId = State.nextGroupId++;
    State.groups[baseProv] = targetGroupId;
  }
  const targetOwner = State.owners[baseProv];

  // Recolectar todos los grupos existentes de las provincias seleccionadas
  const existingGroups = new Set();
  for (const r of unlockedProvs) {
    if (State.groups[r] > 0) existingGroups.add(State.groups[r]);
    State.groups[r] = targetGroupId;
    State.owners[r] = targetOwner;
  }

  for (let i = 1; i <= State.n; i++) {
    if (existingGroups.has(State.groups[i]) && !State.locked[i]) {
      State.groups[i] = targetGroupId;
      State.owners[i] = targetOwner;
    }
  }

  State.groupAnchor = baseProv;
  renderScene(`🔗 ${unlockedProvs.length} provincias agrupadas.`);
}

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].fx, yi = poly[i].fy;
    const xj = poly[j].fx, yj = poly[j].fy;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function findProvincesInLasso(poly) {
  const found = new Set();
  const { w, h, labels, centroids, n } = State;

  // 1. Verificar centroides
  for (let i = 1; i <= n; i++) {
    const c = centroids[i];
    if (c && c.x >= 0 && pointInPolygon(c.x, c.y, poly)) {
      found.add(i);
    }
  }

  // 2. Muestreo cada 3px dentro de la caja delimitadora para capturar islas pequeñas
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  minX = clamp(minX, 0, w - 1); minY = clamp(minY, 0, h - 1);
  maxX = clamp(maxX, 0, w - 1); maxY = clamp(maxY, 0, h - 1);

  for (let y = minY; y <= maxY; y += 3) {
    const row = y * w;
    for (let x = minX; x <= maxX; x += 3) {
      const r = labels[row + x];
      if (r && !found.has(r) && pointInPolygon(x, y, poly)) {
        found.add(r);
      }
    }
  }
  return Array.from(found);
}

// ============================================================================
// MÓDULO 8: TEXTOS E IMÁGENES EN EL MAPA
// ============================================================================
function cloneItemsList(items) {
  return items.map(it => ({ ...it }));
}

function findItemAtPoint(p) {
  for (let i = State.items.length - 1; i >= 0; i--) {
    const it = State.items[i];
    if (it.type === 'text') {
      const sz = it.size || 22;
      ctx.font = `bold ${sz}px system-ui, sans-serif`;
      const textW = Math.max(40, ctx.measureText(it.text).width + 16);
      const textH = sz * 1.4;
      if (Math.abs(p.fx - it.x) <= textW / 2 && Math.abs(p.fy - it.y) <= textH / 2) {
        return i;
      }
    } else if (it.type === 'image') {
      const iw = (it.w || 40) + 10;
      const ih = (it.h || 40) + 10;
      if (Math.abs(p.fx - it.x) <= iw / 2 && Math.abs(p.fy - it.y) <= ih / 2) {
        return i;
      }
    }
  }
  return -1;
}

function createTextItemAt(p, explicitText) {
  const defaultTxt = $('mapTextInput').value.trim();
  const txt = explicitText !== undefined ? explicitText : (defaultTxt || prompt('Texto a colocar en el mapa:'));
  if (!txt || !txt.trim()) return;

  pushUndoState();
  State.items.push({
    id: State.nextItemId++,
    type: 'text',
    x: p.fx,
    y: p.fy,
    text: txt.trim(),
    size: +$('itemSize').value || 22,
    color: $('itemColor').value || '#ffffff'
  });
  renderScene('🔤 Texto añadido al mapa');
}

function requestImageItemAt(p) {
  State.pendingImagePos = { fx: p.fx, fy: p.fy };
  $('itemImgFile').value = '';
  $('itemImgFile').click();
}

$('itemImgFile').addEventListener('change', e => {
  const file = e.target.files[0];
  const pos = State.pendingImagePos;
  State.pendingImagePos = null;
  if (!file || !pos) return;

  const reader = new FileReader();
  reader.onload = ev => {
    const dataUrl = ev.target.result;
    const img = new Image();
    img.onload = () => {
      pushUndoState();
      const targetSize = (+$('itemSize').value || 22) * 3;
      const ratio = img.width / img.height;
      const w = ratio >= 1 ? targetSize : targetSize * ratio;
      const h = ratio >= 1 ? targetSize / ratio : targetSize;
      State.items.push({
        id: State.nextItemId++,
        type: 'image',
        x: pos.fx,
        y: pos.fy,
        w,
        h,
        src: dataUrl,
        img
      });
      renderScene('🖼️ Imagen añadida al mapa');
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
});

// ============================================================================
// MÓDULO 9: GESTIÓN DE PAÍSES Y GUERRA RÁPIDA
// ============================================================================
function addCountryToState(name, hexColor) {
  const color = hexColor || DEFAULT_PALETTE[(State.nextCountryId - 1) % DEFAULT_PALETTE.length];
  const country = {
    id: State.nextCountryId++,
    name: name || `País ${State.nextCountryId - 1}`,
    color,
    origColor: color
  };
  State.countries.push(country);
  return country;
}

function setupDefaultCountries() {
  State.countries = [];
  State.nextCountryId = 1;
  addCountryToState('🌊 Mar / Lago', '#0e79b2');
  addCountryToState('Serbia', '#646aab');
  addCountryToState('Croatia', '#845392');
  addCountryToState('Bosnia', '#4727ab');
  addCountryToState('Hungary', '#d79665');
  addCountryToState('Austria', '#DCDBDB');
  State.activeCountryId = State.countries[1].id;
}

function renderCountriesUI() {
  const container = $('countries');
  container.innerHTML = '';
  const allRows = [{ id: 0, name: 'Sin Dueño', color: null }, ...State.countries];

  allRows.forEach((c, idx) => {
    const row = document.createElement('div');
    row.className = 'crow' + (c.id === State.activeCountryId ? ' active' : '');
    row.dataset.id = c.id;

    if (c.color) {
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = c.color;
      colorInput.addEventListener('input', () => {
        c.color = colorInput.value;
        c.origColor = colorInput.value;
        renderScene();
      });
      colorInput.addEventListener('click', ev => ev.stopPropagation());
      row.appendChild(colorInput);
    } else {
      const emptySwatch = document.createElement('span');
      emptySwatch.className = 'nosw';
      row.appendChild(emptySwatch);
    }

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'nm';
    nameInput.value = c.name;
    if (!c.color) nameInput.disabled = true;
    nameInput.addEventListener('input', () => {
      c.name = nameInput.value;
      syncWarSelectors();
    });
    row.appendChild(nameInput);

    if (c.color) {
      const delBtn = document.createElement('button');
      delBtn.className = 'x';
      delBtn.textContent = '×';
      delBtn.title = 'Eliminar país';
      delBtn.addEventListener('click', ev => {
        ev.stopPropagation();
        removeCountry(c.id);
      });
      row.appendChild(delBtn);
    }

    const shortcutSpan = document.createElement('span');
    shortcutSpan.className = 'key';
    shortcutSpan.textContent = idx < 10 ? idx : '';
    row.appendChild(shortcutSpan);

    row.addEventListener('click', () => setActiveCountry(c.id));
    container.appendChild(row);
  });

  syncWarSelectors();
}

function setActiveCountry(id) {
  State.activeCountryId = id;
  document.querySelectorAll('.crow').forEach(r => {
    r.classList.toggle('active', +r.dataset.id === id);
  });
}

function removeCountry(id) {
  pushUndoState();
  for (let i = 1; i <= State.n; i++) {
    if (State.owners[i] === id && !State.locked[i]) {
      State.owners[i] = 0;
    }
  }
  State.countries = State.countries.filter(c => c.id !== id);
  if (State.activeCountryId === id) {
    State.activeCountryId = State.countries.length ? State.countries[0].id : 0;
  }
  renderCountriesUI();
  renderScene('País eliminado');
}

function syncWarSelectors() {
  for (const selId of ['warA', 'warB']) {
    const sel = $(selId);
    const prevVal = +sel.value;
    sel.innerHTML = '';
    State.countries.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      sel.appendChild(opt);
    });
    if (State.countries.some(c => c.id === prevVal)) {
      sel.value = prevVal;
    }
  }
  if ($('warA').value === $('warB').value && State.countries.length > 1) {
    $('warB').selectedIndex = 1;
  }
}

function initDatabaseSelectors() {
  const contSel = $('continentSelect');
  const countrySel = $('countrySelect');

  for (const continent in COUNTRY_DB) {
    const opt = document.createElement('option');
    opt.value = continent;
    opt.textContent = continent;
    contSel.appendChild(opt);
  }

  contSel.addEventListener('change', () => {
    countrySel.innerHTML = '';
    const list = COUNTRY_DB[contSel.value];
    for (const cName in list) {
      const opt = document.createElement('option');
      opt.value = cName;
      opt.textContent = `${cName} (${list[cName].colorName})`;
      countrySel.appendChild(opt);
    }
  });

  contSel.dispatchEvent(new Event('change'));

  $('addDbCountryBtn').addEventListener('click', () => {
    const cName = countrySel.value;
    const data = COUNTRY_DB[contSel.value][cName];
    const existing = State.countries.find(c => c.name === cName);
    if (existing) {
      setActiveCountry(existing.id);
      return;
    }
    const created = addCountryToState(cName, data.hex);
    renderCountriesUI();
    setActiveCountry(created.id);
  });
}

// ============================================================================
// MÓDULO 10: HISTORIAL (DESHACER / REHACER)
// ============================================================================
function createSnapshot() {
  return {
    n: State.n,
    labels: State.labels.slice(),
    customBorders: State.customBorders.slice(),
    linesData: State.linesCanvas.getContext('2d').getImageData(0, 0, State.w, State.h),
    owners: State.owners.slice(),
    groups: State.groups.slice(),
    locked: State.locked.slice(),
    countries: State.countries.map(c => ({ ...c })),
    items: cloneItemsList(State.items)
  };
}

function pushUndoState() {
  if (!State.labels) return;
  State.undoStack.push(createSnapshot());
  if (State.undoStack.length > 20) State.undoStack.shift();
  State.redoStack.length = 0;
}

function applySnapshot(snap) {
  State.n = snap.n;
  State.labels = snap.labels.slice();
  State.customBorders = snap.customBorders.slice();
  State.linesCanvas.getContext('2d').putImageData(snap.linesData, 0, 0);
  State.owners = snap.owners.slice();
  State.groups = snap.groups.slice();
  State.locked = snap.locked.slice();
  State.countries = snap.countries.map(c => ({ ...c }));
  State.items = cloneItemsList(snap.items);
  computeProvinceCentroids();
  renderCountriesUI();
  renderScene();
}

function undoAction() {
  const snap = State.undoStack.pop();
  if (!snap) return;
  State.redoStack.push(createSnapshot());
  applySnapshot(snap);
}

function redoAction() {
  const snap = State.redoStack.pop();
  if (!snap) return;
  State.undoStack.push(createSnapshot());
  applySnapshot(snap);
}

// ============================================================================
// MÓDULO 11: MENÚ CONTEXTUAL AISLADO (CLIC DERECHO)
// ============================================================================
function closeContextMenu() {
  ctxMenu.hidden = true;
}

// Aislamiento estricto: ningún evento dentro del menú llega al mapa
['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'contextmenu'].forEach(evName => {
  ctxMenu.addEventListener(evName, ev => ev.stopPropagation());
});

window.addEventListener('pointerdown', ev => {
  if (!ctxMenu.hidden && !ctxMenu.contains(ev.target)) {
    closeContextMenu();
  }
});

view.addEventListener('contextmenu', ev => {
  ev.preventDefault();
  ev.stopPropagation();
  if (!State.labels || State.playing) return;

  const pt = clientToMapCoords(ev);
  const provId = State.labels[pt.y * State.w + pt.x];
  const itemIdx = findItemAtPoint(pt);

  ctxMenu.innerHTML = '';

  const addMenuHeader = text => {
    const h = document.createElement('div');
    h.className = 'ctx-head';
    h.textContent = text;
    ctxMenu.appendChild(h);
  };
  const addMenuItem = (label, callback, isDanger = false) => {
    const item = document.createElement('div');
    item.className = 'ctx-item' + (isDanger ? ' danger' : '');
    item.textContent = label;
    item.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      closeContextMenu();
      callback();
    });
    ctxMenu.appendChild(item);
  };
  const addMenuSep = () => {
    const s = document.createElement('div');
    s.className = 'ctx-sep';
    ctxMenu.appendChild(s);
  };

  // 1. Opciones si se hizo clic derecho sobre un Texto o Imagen
  if (itemIdx >= 0) {
    const targetItem = State.items[itemIdx];
    addMenuHeader(targetItem.type === 'text' ? `Texto: "${targetItem.text}"` : 'Imagen seleccionada');
    
    if (targetItem.type === 'text') {
      addMenuItem('✏️ Editar contenido del texto...', () => {
        const newText = prompt('Editar texto:', targetItem.text);
        if (newText !== null && newText.trim()) {
          pushUndoState();
          targetItem.text = newText.trim();
          renderScene('✏️ Texto actualizado');
        }
      });
    }

    addMenuItem('📏 Cambiar tamaño / escala...', () => {
      const currentSz = targetItem.type === 'text' ? targetItem.size : Math.round(targetItem.w);
      const inputSz = prompt('Nuevo tamaño en píxeles:', currentSz);
      const val = parseFloat(inputSz);
      if (val && val > 4) {
        pushUndoState();
        if (targetItem.type === 'text') {
          targetItem.size = val;
        } else {
          const ratio = targetItem.w / targetItem.h;
          targetItem.w = val;
          targetItem.h = val / ratio;
        }
        renderScene('📏 Tamaño actualizado');
      }
    });

    addMenuItem('🗑️ Eliminar este elemento', () => {
      pushUndoState();
      State.items.splice(itemIdx, 1);
      renderScene('🗑️ Elemento eliminado');
    }, true);

    addMenuSep();
  }

  // 2. Opciones de la Provincia bajo el cursor
  if (provId > 0) {
    const locked = isProvinceLocked(provId);
    const ownerCountry = State.countries.find(c => c.id === State.owners[provId]);
    const groupMembers = getProvinceMembers(provId);
    addMenuHeader(`Provincia #${provId} (${ownerCountry ? ownerCountry.name : 'Sin Dueño'})${groupMembers.length > 1 ? ` [Grupo: ${groupMembers.length}]` : ''}`);

    addMenuItem(locked ? '🔓 Desbloquear provincia' : '🔒 Bloquear provincia (Proteger)', () => {
      pushUndoState();
      setProvinceLock(provId, !locked);
      renderScene(!locked ? `🔒 Provincia #${provId} bloqueada` : `🔓 Provincia #${provId} desbloqueada`);
    });

    if (!locked) {
      const activeCountry = State.countries.find(c => c.id === State.activeCountryId);
      if (activeCountry) {
        addMenuItem(`🏳️ Asignar a ${activeCountry.name}`, () => {
          pushUndoState();
          assignProvinceOwner(provId, State.activeCountryId);
        });
      }

      const seaCountry = State.countries.find(c => c.name.includes('Mar') || c.color === '#0e79b2');
      if (seaCountry) {
        addMenuItem('🌊 Pintar como Mar / Lago', () => {
          pushUndoState();
          assignProvinceOwner(provId, seaCountry.id);
        });
      }

      addMenuItem('🏳️ Desasignar (Sin Dueño)', () => {
        pushUndoState();
        assignProvinceOwner(provId, 0);
      });

      addMenuSep();

      addMenuItem('🔗 Fijar como base de grupo', () => {
        State.groupAnchor = provId;
        updateStatus(`🔗 Provincia #${provId} fijada como base de grupo.`);
      });

      if (State.groupAnchor && State.groupAnchor !== provId && !State.locked[State.groupAnchor]) {
        addMenuItem(`🔗 Unir al grupo de #${State.groupAnchor}`, () => {
          mergeProvincesIntoGroup([State.groupAnchor, provId], State.groupAnchor);
        });
      }

      if (State.groups[provId] > 0) {
        addMenuItem('✂️ Desagrupar esta provincia', () => {
          pushUndoState();
          State.groups[provId] = 0;
          renderScene(`✂️ Provincia #${provId} separada del grupo`);
        });
      }
    }
    addMenuSep();
  }

  // 3. Acciones rápidas en esta coordenada
  addMenuItem('🔤 Añadir texto aquí...', () => {
    const txt = prompt('Texto a colocar en el mapa:', $('mapTextInput').value || '');
    if (txt) createTextItemAt(pt, txt);
  });
  addMenuItem('🖼️ Añadir imagen aquí...', () => requestImageItemAt(pt));

  ctxMenu.hidden = false;
  const menuW = 240;
  const menuH = ctxMenu.offsetHeight || 260;
  ctxMenu.style.left = Math.min(ev.clientX, window.innerWidth - menuW - 8) + 'px';
  ctxMenu.style.top = Math.min(ev.clientY, window.innerHeight - menuH - 8) + 'px';
});

// ============================================================================
// MÓDULO 12: CÁMARA (ZOOM Y PAN) E INTERACCIÓN EN EL LIENZO
// ============================================================================
function updateStageTransform() {
  stage.style.transform = `translate(${State.panX}px, ${State.panY}px) scale(${State.zoom})`;
}

function fitMapToViewport() {
  if (!State.w || !State.h) return;
  const vw = view.clientWidth;
  const vh = view.clientHeight;
  State.zoom = Math.min(vw / State.w, vh / State.h) * 0.96;
  State.panX = (vw - State.w * State.zoom) / 2;
  State.panY = (vh - State.h * State.zoom) / 2;
  updateStageTransform();
}

view.addEventListener('wheel', ev => {
  ev.preventDefault();
  closeContextMenu();
  const rect = view.getBoundingClientRect();
  const mx = ev.clientX - rect.left;
  const my = ev.clientY - rect.top;
  const newZoom = clamp(State.zoom * (ev.deltaY < 0 ? 1.15 : 1 / 1.15), 0.05, 25);
  State.panX = mx - (mx - State.panX) * (newZoom / State.zoom);
  State.panY = my - (my - State.panY) * (newZoom / State.zoom);
  State.zoom = newZoom;
  updateStageTransform();
}, { passive: false });

window.addEventListener('resize', () => {
  if (State.labels) fitMapToViewport();
});

function clientToMapCoords(ev) {
  const rect = cv.getBoundingClientRect();
  const fx = ((ev.clientX - rect.left) / rect.width) * State.w;
  const fy = ((ev.clientY - rect.top) / rect.height) * State.h;
  return {
    fx,
    fy,
    x: clamp(Math.floor(fx), 0, State.w - 1),
    y: clamp(Math.floor(fy), 0, State.h - 1)
  };
}

view.addEventListener('pointerdown', ev => {
  if (State.playing || !State.labels) return;
  if (ev.button === 2) return; // Clic derecho reservado para el menú contextual

  // Si el menú contextual estaba abierto, el primer clic solo lo cierra sin activar herramientas
  if (!ctxMenu.hidden) {
    closeContextMenu();
    return;
  }

  view.setPointerCapture(ev.pointerId);

  if (ev.button === 1 || State.spacePressed || State.tool === 'pan') {
    State.drag = { type: 'pan', startX: ev.clientX, startY: ev.clientY, origPanX: State.panX, origPanY: State.panY };
    return;
  }

  if (ev.button !== 0) return;
  const pt = clientToMapCoords(ev);
  const provId = State.labels[pt.y * State.w + pt.x];

  switch (State.tool) {
    case 'fill':
      pushUndoState();
      State.drag = { type: 'fill' };
      assignProvinceOwner(provId, State.activeCountryId);
      break;

    case 'unown':
      pushUndoState();
      State.drag = { type: 'unown' };
      assignProvinceOwner(provId, 0);
      break;

    case 'group':
      State.drag = { type: 'group', startPt: pt, isLasso: false };
      State.lassoPoints = [pt];
      break;

    case 'ungroup':
      pushUndoState();
      State.drag = { type: 'ungroup' };
      if (provId && !State.locked[provId]) {
        State.groups[provId] = 0;
        renderScene(`✂️ Provincia #${provId} desagrupada`);
      }
      break;

    case 'split':
      State.drag = { type: 'split' };
      State.splitPoints = [pt];
      break;

    case 'pick':
      if (provId > 0) setActiveCountry(State.owners[provId]);
      break;

    case 'text':
      createTextItemAt(pt);
      break;

    case 'image':
      requestImageItemAt(pt);
      break;

    case 'moveItem': {
      const idx = findItemAtPoint(pt);
      if (idx >= 0) {
        pushUndoState();
        State.drag = {
          type: 'moveItem',
          idx,
          offsetX: State.items[idx].x - pt.fx,
          offsetY: State.items[idx].y - pt.fy
        };
      }
      break;
    }
  }
});

view.addEventListener('pointermove', ev => {
  const d = State.drag;
  if (!d) return;

  if (d.type === 'pan') {
    State.panX = d.origPanX + (ev.clientX - d.startX);
    State.panY = d.origPanY + (ev.clientY - d.startY);
    updateStageTransform();
    return;
  }

  const pt = clientToMapCoords(ev);
  const provId = State.labels[pt.y * State.w + pt.x];

  if (d.type === 'fill') {
    assignProvinceOwner(provId, State.activeCountryId);
  } else if (d.type === 'unown') {
    assignProvinceOwner(provId, 0);
  } else if (d.type === 'group') {
    if (Math.hypot(pt.fx - d.startPt.fx, pt.fy - d.startPt.fy) > 6) {
      d.isLasso = true;
    }
    if (d.isLasso) {
      State.lassoPoints.push(pt);
      recomposeOnly();
    }
  } else if (d.type === 'ungroup') {
    if (provId && !State.locked[provId] && State.groups[provId] !== 0) {
      State.groups[provId] = 0;
      renderScene();
    }
  } else if (d.type === 'split') {
    State.splitPoints.push(pt);
    recomposeOnly();
  } else if (d.type === 'moveItem') {
    const item = State.items[d.idx];
    if (item) {
      item.x = pt.fx + d.offsetX;
      item.y = pt.fy + d.offsetY;
      recomposeOnly();
    }
  }
});

function finishPointerDrag() {
  const d = State.drag;
  if (!d) return;

  if (d.type === 'group') {
    if (d.isLasso && State.lassoPoints.length > 2) {
      const enclosedProvs = findProvincesInLasso(State.lassoPoints);
      mergeProvincesIntoGroup(enclosedProvs, State.groupAnchor);
    } else {
      const provId = State.labels[d.startPt.y * State.w + d.startPt.x];
      if (provId && !State.locked[provId]) {
        if (!State.groupAnchor) {
          State.groupAnchor = provId;
          updateStatus(`🔗 Provincia #${provId} fijada como base. Haz clic en otras o arrastra un lazo para unirlas.`);
        } else if (State.groupAnchor === provId) {
          State.groupAnchor = 0;
          updateStatus('Selección de grupo reiniciada.');
        } else {
          mergeProvincesIntoGroup([State.groupAnchor, provId], State.groupAnchor);
        }
      }
    }
    State.lassoPoints = null;
    recomposeOnly();
  } else if (d.type === 'split') {
    const pts = State.splitPoints;
    State.splitPoints = null;
    if (pts && pts.length > 1) {
      commitSplitBorder(pts);
    } else {
      recomposeOnly();
    }
  }

  State.drag = null;
}

view.addEventListener('pointerup', finishPointerDrag);
view.addEventListener('pointercancel', finishPointerDrag);

// ============================================================================
// MÓDULO 13: LÍNEA DE TIEMPO, ANIMACIÓN Y EXPORTACIÓN DE VIDEO
// ============================================================================
function captureKeyframeData() {
  return {
    owners: State.owners.slice(),
    groups: State.groups.slice(),
    locked: State.locked.slice(),
    countries: State.countries.map(c => ({ ...c })),
    items: cloneItemsList(State.items),
    caption: State.caption,
    hold: +$('holdInput').value || 0,
    trans: +$('transInput').value || 0
  };
}

function renderKeyframesUI() {
  const list = $('kfList');
  list.innerHTML = '';
  State.keyframes.forEach((kf, idx) => {
    const chip = document.createElement('div');
    chip.className = 'kf' + (idx === State.selectedKf ? ' sel' : '');
    chip.textContent = `${idx + 1}${kf.caption ? ' · ' + kf.caption : ''}`;
    const sub = document.createElement('small');
    sub.textContent = `${kf.hold}s`;
    chip.appendChild(sub);
    chip.addEventListener('click', () => loadKeyframeToStage(idx));
    list.appendChild(chip);
  });
  if (!State.keyframes.length) {
    list.textContent = 'Sin fotogramas — Colorea el mapa y presiona "+ Fotograma".';
  }
}

function loadKeyframeToStage(idx) {
  const kf = State.keyframes[idx];
  if (!kf) return;
  State.selectedKf = idx;
  State.owners = kf.owners.slice();
  State.groups = kf.groups ? kf.groups.slice() : new Int32Array(State.n + 1);
  State.locked = kf.locked ? kf.locked.slice() : new Uint8Array(State.n + 1);
  State.countries = kf.countries.map(c => ({ ...c }));
  State.items = cloneItemsList(kf.items || []);
  State.caption = kf.caption || '';
  $('captionInput').value = State.caption;
  $('holdInput').value = kf.hold;
  $('transInput').value = kf.trans;
  renderCountriesUI();
  renderKeyframesUI();
  renderScene();
}

function interpolateColorTables(tableA, tableB, t, outTable) {
  for (let i = 0; i < tableA.length; i++) {
    const a = tableA[i], b = tableB[i];
    if (a === b) { outTable[i] = a; continue; }
    const aa = a >>> 24, ba = b >>> 24;
    let r, g, bl;
    if (!aa) { r = b & 255; g = (b >> 8) & 255; bl = (b >> 16) & 255; }
    else if (!ba) { r = a & 255; g = (a >> 8) & 255; bl = (a >> 16) & 255; }
    else {
      r = (a & 255) + ((b & 255) - (a & 255)) * t;
      g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t;
      bl = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t;
    }
    const alpha = Math.round(aa + (ba - aa) * t);
    outTable[i] = ((alpha << 24) | ((bl | 0) << 16) | ((g | 0) << 8) | (r | 0)) >>> 0;
  }
  return outTable;
}

function triggerBlobDownload(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function playTimeline(recordVideo = false) {
  if (State.playing) return;
  const kfs = State.keyframes;
  if (!kfs.length) return updateStatus('Añade al menos un fotograma en la línea de tiempo.');

  let mimeType = null;
  if (recordVideo) {
    if (!window.MediaRecorder) return updateStatus('MediaRecorder no disponible en este navegador.');
    mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
      .find(m => MediaRecorder.isTypeSupported(m)) || null;
    if (!mimeType) return updateStatus('Formato de grabación no soportado.');
  }

  const tables = kfs.map(k => buildColorLookupTable(k.owners, k.countries));
  const scratchTable = new Uint32Array(State.n + 1);
  const segments = [];
  let totalDuration = 0;

  kfs.forEach((k, i) => {
    if (i > 0 && k.trans > 0) {
      segments.push({ isTrans: true, a: i - 1, b: i, start: totalDuration, dur: k.trans });
      totalDuration += k.trans;
    }
    const holdDur = (k.hold > 0 || i === kfs.length - 1) ? Math.max(k.hold, 0.1) : 0;
    if (holdDur) {
      segments.push({ isTrans: false, a: i, start: totalDuration, dur: holdDur });
      totalDuration += holdDur;
    }
  });

  let recorder = null;
  const recordedChunks = [];
  if (recordVideo) {
    recorder = new MediaRecorder(cv.captureStream(30), { mimeType, videoBitsPerSecond: 16e6 });
    recorder.ondataavailable = ev => { if (ev.data.size) recordedChunks.push(ev.data); };
    recorder.onstop = () => {
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      triggerBlobDownload(new Blob(recordedChunks, { type: mimeType }), `map-animation.${ext}`);
    };
    recorder.start();
  }

  State.playing = true;
  updateStatus(recordVideo ? '🔴 Grabando video...' : '▶ Reproduciendo animación...');
  const startTime = performance.now();

  const renderSegment = (seg, elapsed) => {
    if (!seg.isTrans) {
      paintOverlayBuffer(tables[seg.a]);
      composeCanvasFrame(kfs[seg.a].items, kfs[seg.a].caption);
    } else {
      const p = clamp((elapsed - seg.start) / seg.dur, 0, 1);
      const ease = p * p * (3 - 2 * p);
      paintOverlayBuffer(interpolateColorTables(tables[seg.a], tables[seg.b], ease, scratchTable));
      const activeKf = p < 0.5 ? kfs[seg.a] : kfs[seg.b];
      composeCanvasFrame(activeKf.items, activeKf.caption);
    }
  };

  const stopPlayback = () => {
    State.playing = false;
    const finalize = () => renderScene(recordVideo ? '✅ Video exportado' : '');
    if (recorder) {
      setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); finalize(); }, 350);
    } else {
      finalize();
    }
  };

  const animLoop = now => {
    if (!State.playing) { stopPlayback(); return; }
    const elapsed = (now - startTime) / 1000;
    if (elapsed >= totalDuration) {
      renderSegment(segments[segments.length - 1], totalDuration);
      stopPlayback();
      return;
    }
    let currentSeg = segments[0];
    for (const s of segments) if (elapsed >= s.start) currentSeg = s;
    renderSegment(currentSeg, elapsed);
    requestAnimationFrame(animLoop);
  };
  requestAnimationFrame(animLoop);
}

// ============================================================================
// MÓDULO 14: GUARDAR Y CARGAR PROYECTOS (.JSON)
// ============================================================================
function serializeItemsForSave(items) {
  return items.map(it => {
    const copy = { ...it };
    delete copy.img;
    return copy;
  });
}

const loadImageAsync = src => new Promise((res, rej) => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = rej;
  img.src = src;
});

async function deserializeItemsFromSave(rawList) {
  if (!rawList) return [];
  const result = [];
  for (const it of rawList) {
    if (it.type === 'image' && it.src) {
      const img = await loadImageAsync(it.src);
      result.push({ ...it, img });
    } else {
      result.push({ ...it });
    }
  }
  return result;
}

$('savePrjBtn').addEventListener('click', () => {
  const payload = {
    v: 4,
    w: State.w,
    h: State.h,
    n: State.n,
    thr: +$('thr').value,
    nextCountryId: State.nextCountryId,
    nextGroupId: State.nextGroupId,
    customBorders: Array.from(State.customBorders),
    countries: State.countries,
    owners: Array.from(State.owners),
    groups: Array.from(State.groups),
    locked: Array.from(State.locked),
    items: serializeItemsForSave(State.items),
    caption: State.caption,
    keyframes: State.keyframes.map(k => ({
      countries: k.countries,
      owners: Array.from(k.owners),
      groups: Array.from(k.groups || []),
      locked: Array.from(k.locked || []),
      items: serializeItemsForSave(k.items || []),
      caption: k.caption,
      hold: k.hold,
      trans: k.trans
    }))
  };
  triggerBlobDownload(new Blob([JSON.stringify(payload)], { type: 'application/json' }), 'map-project.json');
});

$('loadPrjInput').addEventListener('change', async ev => {
  const file = ev.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.w !== State.w || data.h !== State.h) {
      updateStatus('Las dimensiones del proyecto no coinciden con la imagen de mapa actual.');
      return;
    }
    if (data.thr) {
      $('thr').value = data.thr;
      $('thrVal').textContent = data.thr;
    }
    State.customBorders = data.customBorders ? Uint8Array.from(data.customBorders) : new Uint8Array(State.w * State.h);
    runProvinceDetection();

    State.nextCountryId = Math.max(State.nextCountryId, data.nextCountryId || 1);
    State.nextGroupId = Math.max(State.nextGroupId, data.nextGroupId || 1);
    State.countries = data.countries || [];
    State.owners = Int32Array.from(data.owners || []);
    State.groups = data.groups ? Int32Array.from(data.groups) : new Int32Array(State.n + 1);
    State.locked = data.locked ? Uint8Array.from(data.locked) : new Uint8Array(State.n + 1);
    State.caption = data.caption || '';
    $('captionInput').value = State.caption;
    State.items = await deserializeItemsFromSave(data.items);

    State.keyframes = [];
    for (const k of (data.keyframes || [])) {
      State.keyframes.push({
        countries: k.countries,
        owners: Int32Array.from(k.owners),
        groups: k.groups ? Int32Array.from(k.groups) : new Int32Array(State.n + 1),
        locked: k.locked ? Uint8Array.from(k.locked) : new Uint8Array(State.n + 1),
        items: await deserializeItemsFromSave(k.items),
        caption: k.caption,
        hold: k.hold,
        trans: k.trans
      });
    }
    State.selectedKf = -1;
    renderCountriesUI();
    renderKeyframesUI();
    renderScene('📂 Proyecto cargado correctamente');
  } catch (err) {
    updateStatus('Error al cargar el proyecto: ' + err.message);
  }
  ev.target.value = '';
});

// ============================================================================
// MÓDULO 15: EVENTOS DE BOTONES, GUERRA RÁPIDA Y ATAJOS DE TECLADO
// ============================================================================
function selectTool(toolName) {
  State.tool = toolName;
  document.querySelectorAll('#tools button').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.tool === toolName);
  });
  view.style.cursor = toolName === 'pan' ? 'grab' : (toolName === 'moveItem' ? 'move' : 'crosshair');
}

document.querySelectorAll('#tools button').forEach(btn => {
  btn.addEventListener('click', () => selectTool(btn.dataset.tool));
});

$('thr').addEventListener('input', () => {$('thrVal').textContent = $('thr').value; });$('opacity').addEventListener('input', () => {
  $('opVal').textContent =$('opacity').value + '%';
  recomposeOnly();
});

$('redetectBtn').addEventListener('click', () => {
  if (!State.baseCanvas) return;
  if (!confirm('Re-detectar provincias con el nuevo umbral reiniciará el mapa actual. ¿Continuar?')) return;
  const savedCountries = State.countries.map(c => ({ ...c }));
  const savedActive = State.activeCountryId;
  State.customBorders = new Uint8Array(State.w * State.h);
  runProvinceDetection();
  State.owners = new Int32Array(State.n + 1);
  State.groups = new Int32Array(State.n + 1);
  State.locked = new Uint8Array(State.n + 1);
  State.countries = savedCountries;
  State.activeCountryId = savedActive;
  renderCountriesUI();
  renderScene('Provincias re-detectadas');
});

$('mapFile').addEventListener('change', ev => {
  const f = ev.target.files[0];
  if (!f) return;
  const img = new Image();
  img.onload = () => {
    initMapFromImage(img);
    setupDefaultCountries();
    renderCountriesUI();
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(f);
  ev.target.value = '';
});

function loadDefaultBalkanImage() {
  const img = new Image();
  img.onload = () => {
    initMapFromImage(img);
    setupDefaultCountries();
    renderCountriesUI();
  };
  img.onerror = () => {
    // Mapa de respaldo si no se encuentra balkan image_2.jpg en la carpeta
    const c = mkCanvas(1200, 700);
    const cx = c.getContext('2d');
    cx.fillStyle = '#dccbb1';
    cx.fillRect(0, 0, 1200, 700);
    cx.strokeStyle = '#1b1b1b';
    cx.lineWidth = 3;
    for (let x = 0; x <= 1200; x += 150) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, 700); cx.stroke(); }
    for (let y = 0; y <= 700; y += 140) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(1200, y); cx.stroke(); }
    initMapFromImage(c);
    setupDefaultCountries();
    renderCountriesUI();
    updateStatus(`Coloca "${DEFAULT_MAP_FILE}" en esta carpeta para cargarlo por defecto.`);
  };
  img.src = encodeURI(DEFAULT_MAP_FILE);
}

$('reloadDefaultBtn').addEventListener('click', loadDefaultBalkanImage);

$('addCustomCountryBtn').addEventListener('click', () => {
  const c = addCountryToState();
  renderCountriesUI();
  setActiveCountry(c.id);
});

// Guerra Rápida + Restauración de Colores Originales
$('warApplyBtn').addEventListener('click', () => {
  const a = State.countries.find(c => c.id === +$('warA').value);
  const b = State.countries.find(c => c.id === +$('warB').value);
  if (!a || !b || a === b) return updateStatus('Selecciona dos países distintos.');
  pushUndoState();
  if (a.color !== '#d62728' && a.color !== '#1f77b4') a.origColor = a.color;
  if (b.color !== '#d62728' && b.color !== '#1f77b4') b.origColor = b.color;
  a.color = '#d62728';
  b.color 