# MATERIALIZE — Map Studio

Editor web de mapas por **provincias reales** (polígonos de QGIS / Natural Earth) para crear vídeos de mapas para YouTube.
Funciona entero en el navegador: no necesita servidor, se publica gratis con **GitHub Pages**.

*(EN: Web editor for province-based map videos. Import your QGIS admin-1 provinces as GeoJSON, paint them, group them, add labels/images, build keyframes with conquest animations and export an MP4.)*

## Qué puedes hacer

- **Importar provincias** desde QGIS (GeoJSON o TopoJSON). Cada provincia es un polígono real, no una imagen.
- **Pintar** provincias con el color de un país (lista con **todos los países**, cada uno con su color predefinido y editable). También países ficticios.
- **Conquistas animadas**: al pintar con el país atacante, la provincia aparece en un **tono más claro** y pasa al color normal en unos segundos (configurable). Las provincias pueden cambiar **una a una en el orden en que las pintaste** («Propagación»).
- **Seleccionar, agrupar y desagrupar** provincias (ideal para islas): al pintar o seleccionar una provincia de un grupo se edita el grupo entero.
- **Transparencia** por provincia y opacidad general del relleno.
- **Colores propios** por provincia (sin cambiar el dueño).
- **Textos** (ciudades, regiones, títulos, fechas): color, contorno, fuente, tamaño, rotación, opacidad, fijos al mapa o fijos en pantalla.
- **Imágenes** (banderas, iconos, flechas…): mover, redimensionar, rotar, opacidad.
- **Fronteras de país dinámicas**: se recalculan solas según quién posee cada provincia.
- **Fondo de QGIS**: carga la imagen de tu mapa (relieve, ríos…) y alinéala con su *world file* (.pgw/.jgw).
- **Capas extra** en GeoJSON: ríos, carreteras, ferrocarriles, zonas urbanas…
- **Línea de tiempo por fotogramas**: duración, transición, aclarado, propagación y **cámara** (zoom/posición) por fotograma, con transiciones suaves de colores, textos, imágenes y cámara.
- **Exportar vídeo** (MP4 H.264 o WebM, 1080p o la resolución que quieras) y **PNG**.
- Deshacer/rehacer, autoguardado en el navegador y guardar/abrir proyecto (`.json`).

## Publicarlo con GitHub Pages

1. En GitHub: **Settings → Pages**.
2. *Source*: **Deploy from a branch** → rama `main`, carpeta `/ (root)` → **Save**.
3. En un minuto la web estará en `https://<tu-usuario>.github.io/<repositorio>/`.

Para probarlo en tu PC sin publicarlo: en la carpeta del proyecto ejecuta `python -m http.server` y abre `http://localhost:8000` (abrir `index.html` con doble clic no funciona porque usa módulos JavaScript).

## Exportar desde QGIS

### Provincias (obligatorio)
1. Clic derecho en la capa **ne_10m_admin_1_states_provinces** → **Exportar → Guardar objetos como…**
2. Formato: **GeoJSON**.
3. SRC (CRS):
   - **EPSG:4326** (lo normal): en la web eliges la proyección (Lambert, Mercator, etc.).
   - **El mismo SRC que tu proyecto de QGIS** si quieres que coincida exactamente con tu imagen de fondo → en la web elige proyección **«Plana»**.
4. Consejo: si solo vas a usar una región, marca **«Extensión»** y exporta solo esa zona, o usa *Vectorial → Herramientas de geometría → Simplificar*. Mapas más pequeños = editor más rápido. La web también puede simplificar al importar.
5. En la web: **Importar provincias…** → el campo de país se detecta solo (`adm0_a3`) y el nombre (`name_es` / `name`).

### Imagen de fondo (opcional)
1. **Proyecto → Importar/Exportar → Exportar mapa a imagen…**, marca **«Añadir archivo de georreferenciación»** (crea un `.pgw` o `.jgw`).
2. En la web, pestaña **Capas y estilo**: **Cargar imagen de fondo…** y luego **Alinear con world file…**.
   (Si las provincias se importaron en EPSG:4326 con otra proyección, alinéala a mano con la herramienta **Mover fondo** o las casillas X0/Y0/X1/Y1.)

### Ríos, carreteras, zonas urbanas (opcional)
Exporta cada capa como GeoJSON (mismo SRC que las provincias) y usa **Añadir capa GeoJSON…**.

## Flujo para un vídeo

1. Importa las provincias y ajusta colores/estilo.
2. Fotograma 1 = situación inicial. Pulsa **📷 Guardar cámara** si quieres un encuadre concreto.
3. **+ Fotograma** (copia el estado actual) → elige el país atacante → pinta las provincias conquistadas.
4. Ajusta *Duración*, *Transición*, *Aclarado* (segundos que tarda el tono claro en volver al color normal), *Tono claro* y *Propagación*.
5. Añade textos de fechas («Fijo en pantalla») o nombres de ciudades.
6. **▶ Desde el inicio** para previsualizar y **● Exportar vídeo** para descargar el MP4.

Los textos/imágenes se conservan al crear un fotograma nuevo; si los cambias (posición, tamaño, color) se animan entre fotogramas. Si los borras, desaparecen con un fundido.

## Atajos

| Tecla | Acción |
|---|---|
| B / V / E / I / T / H | Pintar / Seleccionar / Quitar dueño / Cuentagotas / Texto / Mover vista |
| Alt (al pintar o seleccionar) | Ignorar grupos |
| Mayús + clic, arrastrar | Añadir a la selección, selección por rectángulo |
| Doble clic (Seleccionar) | Seleccionar el país entero |
| Ctrl+G / Ctrl+Shift+G | Agrupar / desagrupar |
| Ctrl+Z / Ctrl+Y | Deshacer / rehacer |
| Ctrl+D, Supr | Duplicar / borrar texto o imagen |
| Ctrl + rueda | Cambiar tamaño del texto/imagen seleccionado |
| Rueda, Espacio + arrastrar, botón derecho | Zoom y mover la vista |
| N, ← / → | Nuevo fotograma, cambiar de fotograma |
| Ctrl+S | Guardar proyecto |

## Estructura

```
index.html            interfaz
css/style.css         estilos
js/app.js             editor, línea de tiempo, vídeo
js/geo.js             importación, proyecciones, topología (fronteras compartidas)
js/countries.js       lista de países y colores predefinidos (editable)
js/store.js           autoguardado (IndexedDB)
js/vendor/            d3-geo, topojson (incluidos, sin CDN)
sample/               provincias de Europa de ejemplo (Natural Earth, dominio público)
```

Datos de ejemplo: [Natural Earth](https://www.naturalearthdata.com/) (dominio público).
