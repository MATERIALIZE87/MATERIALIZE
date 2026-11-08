// ============================================================================
// geo.js — Importación de GeoJSON/TopoJSON, proyección, topología y mallas.
// Usa las librerías globales cargadas en index.html: d3 (d3-geo) y topojson.
// ============================================================================
/* global d3, topojson */

export const WORLD_W = 1920;   // el mapa se normaliza para caber en 1920x1080
export const WORLD_H = 1080;

// ---------------------------------------------------------------------------
// Lectura de archivos
// ---------------------------------------------------------------------------
export function parseGeoText(text) {
  const json = JSON.parse(text);
  if (json.type === 'Topology') {
    // Elegimos el objeto con más geometrías
    let best = null, bestN = -1;
    for (const [k, o] of Object.entries(json.objects)) {
      const n = o.geometries ? o.geometries.length : 1;
      if (n > bestN) { best = k; bestN = n; }
    }
    const fc = topojson.feature(json, json.objects[best]);
    return fc.type === 'FeatureCollection' ? fc : { type: 'FeatureCollection', features: [fc] };
  }
  if (json.type === 'FeatureCollection') return json;
  if (json.type === 'Feature') return { type: 'FeatureCollection', features: [json] };
  if (json.type && json.coordinates) return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: json }] };
  throw new Error('El archivo no es GeoJSON ni TopoJSON');
}

export function polygonFeatures(fc) {
  return fc.features.filter(f => f && f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'));
}

const OWNER_CANDIDATES = ['adm0_a3', 'ADM0_A3', 'gu_a3', 'GU_A3', 'sov_a3', 'SOV_A3', 'iso_a3', 'ISO_A3', 'admin', 'ADMIN', 'country', 'COUNTRY', 'NAME_0', 'owner'];
const NAME_CANDIDATES = ['name_es', 'NAME_ES', 'name', 'NAME', 'name_en', 'NAME_EN', 'NAME_1', 'name_local', 'woe_name', 'gn_name'];

export function listFields(features) {
  const set = new Set();
  for (let i = 0; i < Math.min(features.length, 50); i++) Object.keys(features[i].properties || {}).forEach(k => set.add(k));
  return [...set];
}
export function guessField(fields, candidates) {
  for (const c of candidates) if (fields.includes(c)) return c;
  return '';
}
export const guessOwnerField = f => guessField(f, OWNER_CANDIDATES);
export const guessNameField = f => guessField(f, NAME_CANDIDATES);

// ¿Coordenadas en grados (EPSG:4326)?
export function looksLonLat(fc) {
  let ok = true, n = 0;
  eachCoord(fc, ([x, y]) => {
    if (n++ > 20000) return;
    if (x < -181 || x > 181 || y < -91 || y > 91) ok = false;
  });
  return ok;
}

function eachCoord(obj, fn) {
  const walk = c => { if (typeof c[0] === 'number') fn(c); else for (const s of c) walk(s); };
  const geom = g => {
    if (!g) return;
    if (g.type === 'GeometryCollection') g.geometries.forEach(geom);
    else walk(g.coordinates);
  };
  if (obj.type === 'FeatureCollection') obj.features.forEach(f => geom(f.geometry));
  else if (obj.type === 'Feature') geom(obj.geometry);
  else geom(obj);
}

function featureBox(f, tf = p => p) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  eachCoord(f, c => {
    const [x, y] = tf(c);
    if (!isFinite(x) || !isFinite(y)) return;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  });
  return [x0, y0, x1, y1];
}

/**
 * Extensión "principal": ignora provincias muy alejadas (p. ej. los territorios
 * de ultramar de Francia) para que el mapa no quede diminuto en una esquina.
 */
export function mainBounds(boxes) {
  boxes = boxes.filter(b => isFinite(b[0]) && isFinite(b[2]));
  if (!boxes.length) return [0, 0, 1, 1];
  const full = boxes.reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
  if (boxes.length < 10) return full;
  const cxs = boxes.map(b => (b[0] + b[2]) / 2).sort((a, b) => a - b);
  const cys = boxes.map(b => (b[1] + b[3]) / 2).sort((a, b) => a - b);
  const q = (arr, t) => arr[Math.floor(t * (arr.length - 1))];
  const lx = q(cxs, 0.02), hx = q(cxs, 0.98), ly = q(cys, 0.02), hy = q(cys, 0.98);
  const inner = boxes.filter(b => { const x = (b[0] + b[2]) / 2, y = (b[1] + b[3]) / 2; return x >= lx && x <= hx && y >= ly && y <= hy; });
  const main = inner.reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
  const area = b => Math.max(1e-12, (b[2] - b[0]) * (b[3] - b[1]));
  return area(main) / area(full) < 0.35 ? main : full;
}

function lonLatBounds(fc) {
  return mainBounds(fc.features.map(f => featureBox(f)));
}

// ---------------------------------------------------------------------------
// Proyección. cfg = { type, rotate, parallels, norm:{s,tx,ty} }
// ---------------------------------------------------------------------------
export const PROJECTIONS = {
  planar: 'Plana (coordenadas tal cual, CRS proyectado de QGIS)',
  lcc: 'Cónica conforme de Lambert (Europa / regiones)',
  laea: 'Azimutal de áreas iguales (tipo EPSG:3035)',
  albers: 'Cónica de áreas iguales (Albers)',
  mercator: 'Mercator',
  equirect: 'Equirectangular (lat/lon simple)',
  natural: 'Natural Earth (mundo)'
};

export function makeProjectionConfig(type, fc) {
  const cfg = { type };
  if (type !== 'planar') {
    const [x0, y0, x1, y1] = lonLatBounds(fc);
    const lon0 = (x0 + x1) / 2, lat0 = (y0 + y1) / 2, span = y1 - y0;
    cfg.rotate = [-lon0, type === 'laea' ? -lat0 : 0];
    cfg.center = [0, type === 'laea' ? 0 : lat0];
    cfg.parallels = [lat0 - span / 4, lat0 + span / 4];
  }
  return cfg;
}

function rawProjector(cfg) {
  if (cfg.type === 'planar') return p => [p[0], -p[1]];
  let pr;
  switch (cfg.type) {
    case 'lcc': pr = d3.geoConicConformal().parallels(cfg.parallels); break;
    case 'albers': pr = d3.geoConicEqualArea().parallels(cfg.parallels); break;
    case 'laea': pr = d3.geoAzimuthalEqualArea(); break;
    case 'mercator': pr = d3.geoMercator(); break;
    case 'equirect': pr = d3.geoEquirectangular(); break;
    default: pr = d3.geoNaturalEarth1();
  }
  pr.rotate(cfg.rotate).scale(1000).translate([0, 0]).precision(0);
  if (cfg.type !== 'laea') pr.center(cfg.center);
  return p => pr([p[0], p[1]]) || [NaN, NaN];
}

// Devuelve una función [x,y] (coords. originales) -> [x,y] mundo (px de 1920x1080)
export function projector(cfg) {
  const raw = rawProjector(cfg);
  const n = cfg.norm;
  return p => { const q = raw(p); return [q[0] * n.s + n.tx, q[1] * n.s + n.ty]; };
}

// Calcula la normalización para que la extensión quepa en WORLD_W x WORLD_H
function computeNorm(cfg, fc) {
  const raw = rawProjector(cfg);
  const [x0, y0, x1, y1] = mainBounds(fc.features.map(f => featureBox(f, raw)));
  const pad = 0.03;
  const s = Math.min(WORLD_W * (1 - 2 * pad) / (x1 - x0), WORLD_H * (1 - 2 * pad) / (y1 - y0));
  return { s, tx: WORLD_W / 2 - s * (x0 + x1) / 2, ty: WORLD_H / 2 - s * (y0 + y1) / 2 };
}

const round2 = v => Math.round(v * 100) / 100;

// ---------------------------------------------------------------------------
// Construye la topología proyectada de provincias (se guarda en el proyecto).
// opts: { ownerField, nameField, projType, simplify (0..1) }
// ---------------------------------------------------------------------------
export function buildProvinceTopology(fc, opts, onStatus = () => {}) {
  const feats = polygonFeatures(fc);
  if (!feats.length) throw new Error('No hay polígonos en el archivo');
  const clean = feats.map((f, i) => ({
    type: 'Feature', id: i,
    properties: {
      name: String((f.properties || {})[opts.nameField] ?? `Provincia ${i + 1}`),
      owner: String((f.properties || {})[opts.ownerField] ?? '').trim(),
      ownerName: String((f.properties || {}).admin ?? (f.properties || {}).ADMIN ?? (f.properties || {})[opts.ownerField] ?? '')
    },
    geometry: f.geometry
  }));
  const cleanFc = { type: 'FeatureCollection', features: clean };
  const cfg = makeProjectionConfig(opts.projType, cleanFc);
  cfg.norm = computeNorm(cfg, cleanFc);

  onStatus('Construyendo topología (fronteras compartidas)…');
  let topo = topojson.topology({ p: cleanFc }, 1e6);
  if (opts.simplify > 0) {
    onStatus('Simplificando…');
    topo = topojson.presimplify(topo);
    // simplify 0..1 -> cuantil de pesos a eliminar (máx. 85 %)
    topo = topojson.simplify(topo, topojson.quantile(topo, Math.min(0.85, opts.simplify)));
  }
  // Decodificar arcos (cuantizados + delta) a coordenadas absolutas
  const tf = topo.transform;
  topo.arcs = topo.arcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(pt => {
      if (tf) { x += pt[0]; y += pt[1]; return [x * tf.scale[0] + tf.translate[0], y * tf.scale[1] + tf.translate[1]]; }
      return [pt[0], pt[1]];
    });
  });
  delete topo.transform;
  delete topo.bbox;
  onStatus('Proyectando…');
  const proj = projector(cfg);
  topo.arcs = topo.arcs.map(arc => arc.map(pt => { const q = proj(pt); return [round2(q[0]), round2(q[1])]; }));
  return { topo, projCfg: cfg };
}

// Proyecta una capa extra (líneas o polígonos) con la misma proyección
export function projectLayer(fc, cfg) {
  const proj = projector(cfg);
  const lines = [], polys = [];
  const ring = r => r.map(p => { const q = proj(p); return [round2(q[0]), round2(q[1])]; });
  const geom = g => {
    if (!g) return;
    switch (g.type) {
      case 'LineString': lines.push(ring(g.coordinates)); break;
      case 'MultiLineString': g.coordinates.forEach(l => lines.push(ring(l))); break;
      case 'Polygon': polys.push(g.coordinates.map(ring)); break;
      case 'MultiPolygon': g.coordinates.forEach(p => polys.push(p.map(ring))); break;
      case 'Point': polys.length; break;
      case 'GeometryCollection': g.geometries.forEach(geom); break;
    }
  };
  fc.features.forEach(f => geom(f.geometry));
  return { lines, polys };
}

// Convierte un punto de coordenadas originales a mundo (para world files)
export function sourceToWorld(cfg, x, y) { return projector(cfg)([x, y]); }

// ---------------------------------------------------------------------------
// Modelo en tiempo de ejecución (Path2D, cajas, centroides, mallas)
// ---------------------------------------------------------------------------
function ringsToPath(path, rings) {
  for (const r of rings) {
    if (r.length < 2) continue;
    path.moveTo(r[0][0], r[0][1]);
    for (let i = 1; i < r.length; i++) path.lineTo(r[i][0], r[i][1]);
    path.closePath();
  }
}

function ringArea(r) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return a / 2;
}
function ringCentroid(r) {
  let x = 0, y = 0, a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
    x += (r[j][0] + r[i][0]) * f; y += (r[j][1] + r[i][1]) * f; a += f;
  }
  if (Math.abs(a) < 1e-9) return r[0];
  return [x / (3 * a), y / (3 * a)];
}

export function buildModel(topo) {
  const fc = topojson.feature(topo, topo.objects.p);
  const provinces = fc.features.map((f, i) => {
    const polys = f.geometry ? (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) : [];
    const path = new Path2D();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, best = null, bestA = -1, area = 0;
    for (const poly of polys) {
      ringsToPath(path, poly);
      for (const [x, y] of poly[0]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const a = Math.abs(ringArea(poly[0]));
      area += a;
      if (a > bestA) { bestA = a; best = poly[0]; }
    }
    const c = best ? ringCentroid(best) : [0, 0];
    return { i, name: f.properties.name, owner0: f.properties.owner, ownerName: f.properties.ownerName, path, bbox: [x0, y0, x1, y1], cx: c[0], cy: c[1], area };
  });
  // Niveles de detalle: versiones simplificadas para dibujar rápido con poco zoom.
  // minW = área mínima de triángulo (en unidades de mundo²) que se conserva.
  const lods = [lodFrom(topo, 0, provinces)];
  const pre = topojson.presimplify(topo);
  for (const minW of [0.02, 0.25, 2.5]) lods.push(lodFrom(topojson.simplify(pre, minW), minW));
  return { provinces, lods, inner: lods[0].inner, coast: lods[0].coast };
}

function lodFrom(topo, minW, fullProvinces) {
  const obj = topo.objects.p;
  let paths;
  if (fullProvinces) paths = fullProvinces.map(p => p.path);
  else paths = topojson.feature(topo, obj).features.map(f => {
    const path = new Path2D();
    const polys = f.geometry ? (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) : [];
    for (const poly of polys) ringsToPath(path, poly);
    return path;
  });
  return {
    minW, topo, paths,
    inner: meshPath(topojson.mesh(topo, obj, (a, b) => a !== b)),
    coast: meshPath(topojson.mesh(topo, obj, (a, b) => a === b))
  };
}

export function meshPath(mls) {
  const path = new Path2D();
  if (!mls) return path;
  for (const line of mls.coordinates) {
    if (line.length < 2) continue;
    path.moveTo(line[0][0], line[0][1]);
    for (let i = 1; i < line.length; i++) path.lineTo(line[i][0], line[i][1]);
  }
  return path;
}

// Frontera entre provincias con distinto dueño (fronteras de país dinámicas)
export function ownerMesh(topo, owners) {
  const obj = topo.objects.p;
  return meshPath(topojson.mesh(topo, obj, (a, b) => a !== b && (owners[a.id] || '') !== (owners[b.id] || '')));
}

export function layerPaths(layer) {
  const lp = new Path2D(), pp = new Path2D();
  for (const l of layer.lines || []) {
    if (l.length < 2) continue;
    lp.moveTo(l[0][0], l[0][1]);
    for (let i = 1; i < l.length; i++) lp.lineTo(l[i][0], l[i][1]);
  }
  for (const p of layer.polys || []) ringsToPath(pp, p);
  return { lines: lp, polys: pp, hasLines: (layer.lines || []).length > 0, hasPolys: (layer.polys || []).length > 0 };
}

// World file (.pgw/.jgw/.wld/.tfw): A D B E C F
export function parseWorldFile(text) {
  const v = text.trim().split(/\s+/).map(Number);
  if (v.length < 6 || v.some(n => !isFinite(n))) throw new Error('World file inválido');
  return { A: v[0], D: v[1], B: v[2], E: v[3], C: v[4], F: v[5] };
}
