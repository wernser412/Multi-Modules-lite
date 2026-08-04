// stereogramDecoder.js
// Puerto al navegador del "Decodificador de Estereogramas" (Python/Tkinter):
// detecta automáticamente el patrón de un autoestereograma (SIRDS / "Magic Eye")
// y revela el mapa de profundidad oculto, todo del lado del cliente (canvas).
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "stereogramDecoder",
    mod: {
      title: "🧩 Decodificador de Estereogramas",
      desc: "Revela la figura 3D oculta en autoestereogramas (Magic Eye) desde cualquier imagen de la página",
      category: "Imágenes",

      enable() {
        if (this.active) return;
        this.active = true;

        /********************************************************
         ESTILOS
        ********************************************************/
        GM_addStyle(`
          .mml-st-badge {
            position: fixed;
            padding: 4px 8px;
            border-radius: 8px;
            background: #1e1e1e;
            color: #fff;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
            cursor: pointer;
            z-index: 2147483000;
            box-shadow: 0 2px 8px rgba(0,0,0,.4);
            user-select: none;
          }
          .mml-st-badge:hover { background: #2563eb; }

          #mml-st-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,.55);
            z-index: 2147483600; display: flex; align-items: center; justify-content: center;
          }
          #mml-st-modal {
            width: min(1100px, 96vw); height: min(760px, 92vh);
            background: #14161a; color: #eee; border-radius: 14px;
            display: flex; flex-direction: column; overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,.6); border: 1px solid rgba(255,255,255,.08);
            font-family: -apple-system, Segoe UI, Arial, sans-serif; font-size: 13px;
          }
          #mml-st-modal .mml-st-head {
            display: flex; align-items: center; justify-content: space-between;
            padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,.08);
            background: linear-gradient(180deg, rgba(96,165,250,.12), transparent);
          }
          #mml-st-modal .mml-st-head b { font-size: 15px; }
          #mml-st-close {
            background: rgba(255,255,255,.08); border: none; color: #eee;
            width: 28px; height: 28px; border-radius: 8px; cursor: pointer; font-size: 14px;
          }
          #mml-st-close:hover { background: rgba(255,255,255,.18); }

          #mml-st-body { flex: 1; display: flex; overflow: hidden; }

          #mml-st-controls {
            width: 270px; flex: none; overflow-y: auto; padding: 12px;
            border-right: 1px solid rgba(255,255,255,.08);
          }
          #mml-st-controls h4 {
            margin: 14px 0 6px; font-size: 10.5px; text-transform: uppercase;
            letter-spacing: .07em; color: #8a8f98;
          }
          #mml-st-controls h4:first-child { margin-top: 0; }
          .mml-st-btn {
            width: 100%; padding: 8px 10px; margin: 3px 0; border: none; border-radius: 8px;
            background: #23262c; color: #eee; cursor: pointer; font-size: 12.5px; text-align: left;
          }
          .mml-st-btn:hover { background: #2b2f36; }
          .mml-st-btn.primary { background: #1d4ed8; }
          .mml-st-btn.primary:hover { background: #2563eb; }
          .mml-st-row { display: flex; align-items: center; justify-content: space-between; margin: 6px 0; gap: 6px; }
          .mml-st-row label { color: #c8ccd2; font-size: 12px; }
          .mml-st-row input[type=number] {
            width: 64px; background: #1d2025; border: 1px solid rgba(255,255,255,.1);
            color: #eee; border-radius: 6px; padding: 3px 6px; font-size: 12px;
          }
          .mml-st-row input[type=range] { width: 100%; }
          .mml-st-info { color: #8a8f98; font-size: 11.5px; line-height: 1.4; }
          .mml-st-status { color: #60a5fa; font-size: 11.5px; margin: 6px 0; min-height: 14px; }
          .mml-st-checkrow { display: flex; align-items: center; gap: 6px; margin: 6px 0; }

          #mml-st-canvases {
            flex: 1; overflow: auto; padding: 14px; background: #0e0f12;
          }
          .mml-st-block { margin-bottom: 22px; }
          .mml-st-block h5 { margin: 0 0 8px; font-size: 12.5px; color: #c8ccd2; font-weight: 600; }
          .mml-st-canvas-wrap { position: relative; display: inline-block; max-width: 100%; }
          .mml-st-canvas-wrap canvas { max-width: 100%; height: auto; display: block; border-radius: 4px; }
          .mml-st-drop {
            border: 2px dashed rgba(255,255,255,.15); border-radius: 10px; padding: 30px 10px;
            text-align: center; color: #8a8f98; font-size: 12.5px;
          }
        `);

        /********************************************************
         PROCESAMIENTO DE IMAGEN (equivalente a numpy en el script Python)
        ********************************************************/

        // L = 0.299 R + 0.587 G + 0.114 B  (igual que PIL .convert("L"))
        function toGrayscale(img, w, h) {
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, w, h);
          let imgData;
          try {
            imgData = ctx.getImageData(0, 0, w, h);
          } catch (e) {
            throw new Error("CORS");
          }
          const d = imgData.data;
          const gray = new Float32Array(w * h);
          for (let i = 0, p = 0; i < d.length; i += 4, p++) {
            gray[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          }
          return gray;
        }

        // Filtro de caja vía suma acumulada (equivalente a _box_filter en Python)
        function boxFilter(src, w, h, k) {
          if (k <= 0) return src;
          const pw = w + 2 * k, ph = h + 2 * k;
          const padded = new Float64Array(pw * ph);
          for (let y = 0; y < ph; y++) {
            const sy = Math.min(h - 1, Math.max(0, y - k));
            const base = y * pw, sbase = sy * w;
            for (let x = 0; x < pw; x++) {
              const sx = Math.min(w - 1, Math.max(0, x - k));
              padded[base + x] = src[sbase + sx];
            }
          }
          const csw = pw + 1;
          const csum = new Float64Array(csw * (ph + 1));
          for (let y = 1; y <= ph; y++) {
            let rowsum = 0;
            const base = y * csw, prevBase = (y - 1) * csw, sbase = (y - 1) * pw;
            for (let x = 1; x <= pw; x++) {
              rowsum += padded[sbase + x - 1];
              csum[base + x] = csum[prevBase + x] + rowsum;
            }
          }
          const ksz = 2 * k + 1, area = ksz * ksz;
          const out = new Float64Array(w * h);
          for (let y = 0; y < h; y++) {
            const y0 = y, y1 = y + ksz, rowOut = y * w;
            const rowA = y1 * csw, rowB = y0 * csw;
            for (let x = 0; x < w; x++) {
              const x0 = x, x1 = x + ksz;
              out[rowOut + x] = (csum[rowA + x1] - csum[rowB + x1] - csum[rowA + x0] + csum[rowB + x0]) / area;
            }
          }
          return out;
        }

        // Detección automática del ancho de patrón por autocorrelación (muestreando 1 de cada 4 filas)
        function autodetect(gray, w, h) {
          const rows = [];
          for (let y = 0; y < h; y += 4) rows.push(y);
          const lagMin = 20, lagMax = Math.min(Math.floor(w / 2), 400);
          if (lagMax <= lagMin) return null;

          let sum = 0;
          for (const y of rows) { const base = y * w; for (let x = 0; x < w; x++) sum += gray[base + x]; }
          const mean = sum / (rows.length * w);

          const sample = new Float64Array(rows.length * w);
          rows.forEach((y, ry) => {
            const base = y * w, sbase = ry * w;
            for (let x = 0; x < w; x++) sample[sbase + x] = gray[base + x] - mean;
          });

          let bestLag = lagMin, bestScore = -1;
          for (let lag = lagMin; lag < lagMax; lag++) {
            let dot = 0, na = 0, nb = 0;
            for (let ry = 0; ry < rows.length; ry++) {
              const base = ry * w;
              for (let x = lag; x < w; x++) {
                const a = sample[base + x], b = sample[base + x - lag];
                dot += a * b; na += a * a; nb += b * b;
              }
            }
            const score = dot / (Math.sqrt(na * nb) + 1e-9);
            if (score > bestScore) { bestScore = score; bestLag = lag; }
          }
          return { lag: bestLag, score: bestScore };
        }

        // Vista previa en vivo: mapa de coincidencia para UN desplazamiento (rápido)
        function livePreview(gray, w, h, s) {
          s = Math.max(1, Math.min(s, w - 1));
          const diff = new Float64Array(w * h);
          let dmax = 0;
          for (let y = 0; y < h; y++) {
            const base = y * w;
            for (let x = s; x < w; x++) {
              const v = Math.abs(gray[base + x] - gray[base + x - s]);
              diff[base + x] = v;
              if (v > dmax) dmax = v;
            }
          }
          const out = new Uint8ClampedArray(w * h);
          if (dmax > 0) {
            for (let i = 0; i < out.length; i++) out[i] = 255 - (diff[i] / dmax) * 255;
          } else {
            out.fill(255);
          }
          return out;
        }

        // Decodificación completa (async + progreso, igual al bucle min_s..max_s de Python)
        async function decode(gray, w, h, minS, maxS, block, onProgress) {
          const size = w * h, sentinel = 1e6;
          const bestError = new Float64Array(size).fill(Infinity);
          const bestShift = new Int32Array(size).fill(minS);
          let done = 0;
          const total = maxS - minS + 1;

          for (let s = minS; s <= maxS; s++) {
            const diff = new Float64Array(size).fill(sentinel);
            for (let y = 0; y < h; y++) {
              const base = y * w;
              for (let x = s; x < w; x++) diff[base + x] = Math.abs(gray[base + x] - gray[base + x - s]);
            }
            const filtered = block > 0 ? boxFilter(diff, w, h, block) : diff;
            for (let i = 0; i < size; i++) {
              if (filtered[i] < bestError[i]) { bestError[i] = filtered[i]; bestShift[i] = s; }
            }
            done++;
            if (done % 4 === 0 || done === total) {
              onProgress && onProgress(done, total);
              await new Promise((r) => setTimeout(r, 0));
            }
          }
          return bestShift;
        }

        function normalizeShiftMap(bestShift, invert) {
          let dmin = Infinity, dmax = -Infinity;
          for (let i = 0; i < bestShift.length; i++) {
            if (bestShift[i] < dmin) dmin = bestShift[i];
            if (bestShift[i] > dmax) dmax = bestShift[i];
          }
          const out = new Uint8ClampedArray(bestShift.length);
          if (dmax > dmin) {
            for (let i = 0; i < out.length; i++) {
              let v = ((bestShift[i] - dmin) / (dmax - dmin)) * 255;
              if (invert) v = 255 - v;
              out[i] = v;
            }
          } else {
            out.fill(invert ? 255 : 0);
          }
          return out;
        }

        function medianFilter3(data, w, h) {
          const out = new Uint8ClampedArray(w * h);
          const wnd = new Uint8ClampedArray(9);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              let n = 0;
              for (let dy = -1; dy <= 1; dy++) {
                const yy = Math.min(h - 1, Math.max(0, y + dy));
                for (let dx = -1; dx <= 1; dx++) {
                  const xx = Math.min(w - 1, Math.max(0, x + dx));
                  wnd[n++] = data[yy * w + xx];
                }
              }
              wnd.sort();
              out[y * w + x] = wnd[4];
            }
          }
          return out;
        }

        function grayToCanvas(gray8, w, h) {
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          const ctx = c.getContext("2d");
          const imgData = ctx.createImageData(w, h);
          for (let i = 0, p = 0; p < gray8.length; i += 4, p++) {
            imgData.data[i] = imgData.data[i + 1] = imgData.data[i + 2] = gray8[p];
            imgData.data[i + 3] = 255;
          }
          ctx.putImageData(imgData, 0, 0);
          return c;
        }

        /********************************************************
         ÍCONO FLOTANTE SOBRE IMÁGENES DE LA PÁGINA
        ********************************************************/

        const MIN_SIZE = 120;

        const extractUrl = (node) => {
          while (node) {
            if (node.nodeType !== 1) { node = node.parentElement; continue; }
            const tag = node.tagName.toLowerCase();
            if (tag === "img") {
              return node.currentSrc || node.src || node.getAttribute("data-src") || node.getAttribute("data-original") || "";
            }
            const cs = getComputedStyle(node);
            if (cs.backgroundImage && cs.backgroundImage !== "none") {
              const m = cs.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
              if (m) return m[1];
            }
            node = node.parentElement;
          }
          return "";
        };

        const badge = document.createElement("div");
        badge.className = "mml-st-badge";
        badge.textContent = "🧩 Decodificar estereograma";
        badge.style.display = "none";
        document.documentElement.appendChild(badge);

        let hoveredUrl = "";

        const onMove = (e) => {
          if (e.target === badge) return;
          const el = e.target.closest?.("img, [style*='background-image']");
          if (!el) { badge.style.display = "none"; return; }
          const r = el.getBoundingClientRect();
          if (r.width < MIN_SIZE || r.height < MIN_SIZE) { badge.style.display = "none"; return; }
          const url = extractUrl(el);
          if (!url) { badge.style.display = "none"; return; }
          hoveredUrl = url;
          badge.style.left = `${Math.max(4, r.left + 6)}px`;
          badge.style.top = `${Math.max(4, r.top + 6)}px`;
          badge.style.display = "flex";
        };

        badge.addEventListener("mousedown", (e) => e.preventDefault());
        badge.addEventListener("click", (e) => {
          e.stopPropagation();
          openModal(hoveredUrl);
        });

        document.addEventListener("mousemove", onMove, true);

        /********************************************************
         MODAL / UI PRINCIPAL
        ********************************************************/

        let overlay = null;
        let state = null; // { img, w, h, gray, depth8 }

        function closeModal() {
          overlay?.remove();
          overlay = null;
          state = null;
        }

        function buildModal() {
          overlay = document.createElement("div");
          overlay.id = "mml-st-overlay";
          overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) closeModal(); });

          overlay.innerHTML = `
            <div id="mml-st-modal">
              <div class="mml-st-head">
                <b>🧩 Decodificador de Estereogramas</b>
                <button id="mml-st-close">✕</button>
              </div>
              <div id="mml-st-body">
                <div id="mml-st-controls">
                  <h4>Imagen</h4>
                  <button class="mml-st-btn" id="st-load-btn">📂 Cargar imagen...</button>
                  <input type="file" id="st-file-input" accept="image/*" style="display:none">
                  <button class="mml-st-btn" id="st-capture-btn">📷 Capturar pantalla (seleccionar área)</button>
                  <div class="mml-st-info" id="st-info">Ninguna imagen cargada</div>

                  <button class="mml-st-btn" id="st-auto-btn">🔎 Detectar patrón automáticamente</button>

                  <h4>Puntos guía</h4>
                  <div class="mml-st-checkrow">
                    <input type="checkbox" id="st-dots-check" checked>
                    <label for="st-dots-check">Mostrar puntos guía</label>
                  </div>
                  <div class="mml-st-row">
                    <label>Separación (px)</label>
                    <input type="number" id="st-dots-spacing" value="80" min="10">
                  </div>

                  <h4>Vista previa en vivo</h4>
                  <input type="range" id="st-preview-slider" min="1" max="200" value="80" disabled>
                  <div class="mml-st-info" id="st-preview-label">Desplazamiento: 80px</div>
                  <button class="mml-st-btn" id="st-use-center-btn">Usar como centro del rango</button>

                  <h4>Parámetros de decodificación</h4>
                  <div class="mml-st-row"><label>Desplaz. mínimo</label><input type="number" id="st-min-shift" value="60" min="1"></div>
                  <div class="mml-st-row"><label>Desplaz. máximo</label><input type="number" id="st-max-shift" value="140" min="1"></div>
                  <div class="mml-st-row"><label>Suavizado (bloque)</label><input type="number" id="st-block" value="3" min="0"></div>
                  <div class="mml-st-checkrow"><input type="checkbox" id="st-invert"><label for="st-invert">Invertir profundidad</label></div>
                  <div class="mml-st-checkrow"><input type="checkbox" id="st-median" checked><label for="st-median">Filtro de mediana</label></div>

                  <button class="mml-st-btn primary" id="st-decode-btn">Decodificar</button>
                  <div class="mml-st-status" id="st-status"></div>

                  <button class="mml-st-btn" id="st-save-depth-btn">💾 Guardar mapa de profundidad PNG</button>
                  <button class="mml-st-btn" id="st-save-full-btn">💾 Guardar captura (original + mapa)</button>
                </div>
                <div id="mml-st-canvases">
                  <div class="mml-st-drop" id="st-drop-hint">
                    Cargá una imagen desde el panel de la izquierda, o pasá el mouse sobre una imagen de la página
                    y hacé clic en "🧩 Decodificar estereograma".
                  </div>
                  <div class="mml-st-block" id="st-block-original" style="display:none">
                    <h5>Imagen original</h5>
                    <div class="mml-st-canvas-wrap"><canvas id="st-canvas-original"></canvas></div>
                  </div>
                  <div class="mml-st-block" id="st-block-preview" style="display:none">
                    <h5>Vista previa en vivo</h5>
                    <div class="mml-st-canvas-wrap"><canvas id="st-canvas-preview"></canvas></div>
                  </div>
                  <div class="mml-st-block" id="st-block-depth" style="display:none">
                    <h5>Mapa de profundidad decodificado</h5>
                    <div class="mml-st-canvas-wrap"><canvas id="st-canvas-depth"></canvas></div>
                  </div>
                </div>
              </div>
            </div>
          `;

          document.documentElement.appendChild(overlay);

          const $ = (id) => overlay.querySelector(id);

          $("#mml-st-close").onclick = closeModal;
          $("#st-load-btn").onclick = () => $("#st-file-input").click();
          $("#st-file-input").onchange = (e) => {
            const file = e.target.files?.[0];
            if (file) loadFromFile(file);
          };
          $("#st-capture-btn").onclick = captureScreen;
          $("#st-auto-btn").onclick = runAutodetect;
          $("#st-dots-check").onchange = redrawOriginal;
          $("#st-dots-spacing").onchange = redrawOriginal;
          $("#st-preview-slider").oninput = (e) => {
            const s = parseInt(e.target.value, 10);
            $("#st-preview-label").textContent = `Desplazamiento: ${s}px`;
            updatePreview(s);
          };
          $("#st-use-center-btn").onclick = () => {
            const centro = parseInt($("#st-preview-slider").value, 10);
            $("#st-min-shift").value = Math.max(1, centro - 15);
            $("#st-max-shift").value = centro + 15;
          };
          $("#st-decode-btn").onclick = runDecode;
          $("#st-save-depth-btn").onclick = saveDepthPng;
          $("#st-save-full-btn").onclick = saveFullPng;

          return $;
        }

        let $;

        function setStatus(text) { $("#st-status").textContent = text; }

        function redrawOriginal() {
          if (!state) return;
          const showDots = $("#st-dots-check").checked;
          const spacing = Math.max(10, parseInt($("#st-dots-spacing").value, 10) || 80);
          const strip = showDots ? 30 : 0;
          const canvas = $("#st-canvas-original");
          canvas.width = state.w;
          canvas.height = state.h + strip;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(state.img, 0, strip, state.w, state.h);
          if (showDots) {
            const cx = state.w / 2, cy = strip / 2, r = 5;
            ctx.fillStyle = "#000";
            [-spacing / 2, spacing / 2].forEach((dx) => {
              ctx.beginPath();
              ctx.arc(cx + dx, cy, r, 0, Math.PI * 2);
              ctx.fill();
            });
          }
        }

        function updatePreview(s) {
          if (!state) return;
          const gray8 = livePreview(state.gray, state.w, state.h, s);
          const c = grayToCanvas(gray8, state.w, state.h);
          const canvas = $("#st-canvas-preview");
          canvas.width = state.w; canvas.height = state.h;
          canvas.getContext("2d").drawImage(c, 0, 0);
        }

        async function setImage(img, label) {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          let gray;
          try {
            gray = toGrayscale(img, w, h);
          } catch (e) {
            setStatus("");
            alert(
              "No se pudo leer esta imagen (restricción CORS del sitio).\n" +
              "Probá con el botón 'Cargar imagen...' para elegirla desde tu disco."
            );
            return;
          }

          state = { img, w, h, gray, depth8: null };

          $("#st-drop-hint").style.display = "none";
          $("#st-block-original").style.display = "";
          $("#st-block-preview").style.display = "";
          $("#st-block-depth").style.display = "none";
          $("#st-info").textContent = `${label || "Imagen"}: ${w} x ${h} px`;
          setStatus("");

          const maxSlider = Math.max(2, Math.min(Math.floor(w / 2), 500));
          const slider = $("#st-preview-slider");
          slider.disabled = false;
          slider.max = maxSlider;
          const initial = Math.min(parseInt(slider.value, 10) || 80, maxSlider);
          slider.value = initial;
          $("#st-preview-label").textContent = `Desplazamiento: ${initial}px`;

          redrawOriginal();
          updatePreview(initial);
        }

        function loadFromFile(file) {
          const url = URL.createObjectURL(file);
          const img = new Image();
          img.onload = () => { setImage(img, file.name); URL.revokeObjectURL(url); };
          img.onerror = () => { alert("No se pudo abrir el archivo como imagen."); URL.revokeObjectURL(url); };
          img.src = url;
        }

        function loadFromUrl(url) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => setImage(img, "Imagen de la página");
          img.onerror = () => {
            alert(
              "No se pudo cargar esa imagen directamente (posible restricción CORS del sitio).\n" +
              "Probá con el botón 'Cargar imagen...' y seleccionala manualmente si la tenés guardada."
            );
          };
          img.src = url;
        }

        // ---------------- CAPTURAR PANTALLA (seleccionando un área con el mouse) ----------------
        // Útil para estereogramas dentro de <video>, <canvas>, reproductores embebidos, etc.,
        // donde no hay una URL de imagen para extraer directamente.

        async function captureScreen() {
          if (!navigator.mediaDevices?.getDisplayMedia) {
            alert("Tu navegador no soporta la Screen Capture API (captura de pantalla).");
            return;
          }

          let stream;
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: { frameRate: 30 },
              audio: false
            });
          } catch (e) {
            return; // el usuario canceló el diálogo de permisos
          }

          const video = document.createElement("video");
          video.autoplay = true;
          video.muted = true;
          video.playsInline = true;
          video.srcObject = stream;

          await new Promise((resolve) => {
            video.onloadedmetadata = () => { video.play(); resolve(); };
          });

          // Oculta el modal para que no tape lo que se quiere capturar
          // (equivalente a self.root.withdraw() en la versión de Python).
          if (overlay) overlay.style.display = "none";

          openSelectionOverlay(video, stream);
        }

        function openSelectionOverlay(video, stream) {
          const sel = document.createElement("div");
          Object.assign(sel.style, {
            position: "fixed", inset: 0, zIndex: 2147483647,
            background: "#000", cursor: "crosshair", overflow: "hidden"
          });

          Object.assign(video.style, {
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)", maxWidth: "100%", maxHeight: "100%"
          });
          sel.appendChild(video);

          const dim = document.createElement("div");
          Object.assign(dim.style, { position: "absolute", inset: 0, background: "rgba(0,0,0,.35)", pointerEvents: "none" });
          sel.appendChild(dim);

          const info = document.createElement("div");
          info.textContent = "Arrastrá el mouse para seleccionar el área del estereograma  |  Esc para cancelar";
          Object.assign(info.style, {
            position: "absolute", top: "12px", left: "50%", transform: "translateX(-50%)",
            background: "#000", color: "#fff", padding: "6px 14px", borderRadius: "8px",
            fontSize: "13px", zIndex: 2, fontFamily: "Arial, sans-serif"
          });
          sel.appendChild(info);

          const rectEl = document.createElement("div");
          Object.assign(rectEl.style, {
            position: "absolute", border: "2px solid #00ff88",
            background: "rgba(0,255,136,.15)", display: "none", zIndex: 2
          });
          sel.appendChild(rectEl);

          document.documentElement.appendChild(sel);

          let startX = 0, startY = 0, dragging = false;

          const cleanup = (restoreModal) => {
            sel.remove();
            stream.getTracks().forEach((t) => t.stop());
            document.removeEventListener("keydown", onKey);
            if (restoreModal && overlay) overlay.style.display = "flex";
          };

          const onKey = (e) => { if (e.key === "Escape") cleanup(true); };
          document.addEventListener("keydown", onKey);

          // Si el usuario corta el compartir desde la barra del navegador.
          stream.getVideoTracks()[0].addEventListener("ended", () => cleanup(true));

          sel.addEventListener("mousedown", (e) => {
            dragging = true;
            startX = e.clientX; startY = e.clientY;
            Object.assign(rectEl.style, { left: `${startX}px`, top: `${startY}px`, width: "0px", height: "0px", display: "block" });
          });

          sel.addEventListener("mousemove", (e) => {
            if (!dragging) return;
            const x = Math.min(e.clientX, startX), y = Math.min(e.clientY, startY);
            const w = Math.abs(e.clientX - startX), h = Math.abs(e.clientY - startY);
            Object.assign(rectEl.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
          });

          sel.addEventListener("mouseup", (e) => {
            if (!dragging) return;
            dragging = false;

            const x0 = Math.min(e.clientX, startX), y0 = Math.min(e.clientY, startY);
            const x1 = Math.max(e.clientX, startX), y1 = Math.max(e.clientY, startY);

            if (x1 - x0 < 5 || y1 - y0 < 5) { cleanup(true); return; }

            // Convierte coordenadas de pantalla (CSS) a píxeles nativos del video,
            // ya que el <video> puede estar escalado dentro del overlay.
            const vRect = video.getBoundingClientRect();
            const scaleX = video.videoWidth / vRect.width;
            const scaleY = video.videoHeight / vRect.height;

            const sx = Math.max(0, (x0 - vRect.left) * scaleX);
            const sy = Math.max(0, (y0 - vRect.top) * scaleY);
            const sw = Math.min(video.videoWidth - sx, (x1 - x0) * scaleX);
            const sh = Math.min(video.videoHeight - sy, (y1 - y0) * scaleY);

            if (sw < 10 || sh < 10) { cleanup(true); return; }

            const c = document.createElement("canvas");
            c.width = Math.round(sw);
            c.height = Math.round(sh);
            c.getContext("2d").drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height);

            cleanup(true);
            setImage(c, "Captura de pantalla");
          });
        }

        function runAutodetect() {
          if (!state) { alert("Primero cargá una imagen."); return; }
          setStatus("Detectando patrón...");
          setTimeout(() => {
            const res = autodetect(state.gray, state.w, state.h);
            if (!res) { setStatus(""); alert("La imagen es demasiado angosta para detectar el patrón."); return; }
            const sugMax = res.lag;
            const sugMin = Math.max(20, Math.floor(res.lag * 0.6));
            $("#st-min-shift").value = sugMin;
            $("#st-max-shift").value = sugMax;
            $("#st-dots-spacing").value = res.lag;

            const maxSlider = parseInt($("#st-preview-slider").max, 10);
            const previewVal = Math.max(1, Math.min(res.lag, maxSlider));
            $("#st-preview-slider").value = previewVal;
            $("#st-preview-label").textContent = `Desplazamiento: ${previewVal}px`;
            updatePreview(previewVal);
            redrawOriginal();

            setStatus(`Patrón estimado: ~${res.lag}px (correlación ${res.score.toFixed(2)})`);
            runDecode();
          }, 10);
        }

        async function runDecode() {
          if (!state) { alert("Primero cargá una imagen."); return; }
          const minS = parseInt($("#st-min-shift").value, 10);
          const maxS = parseInt($("#st-max-shift").value, 10);
          const block = parseInt($("#st-block").value, 10);

          if (!Number.isInteger(minS) || !Number.isInteger(maxS) || !Number.isInteger(block) || minS < 1 || maxS < 1 || block < 0) {
            alert("Los parámetros deben ser números enteros válidos (desplazamiento >= 1, suavizado >= 0).");
            return;
          }
          if (minS > maxS) { alert("El desplazamiento mínimo no puede ser mayor al máximo."); return; }
          if (maxS >= state.w) { alert(`El desplazamiento máximo (${maxS}) debe ser menor al ancho de la imagen (${state.w}px).`); return; }

          $("#st-decode-btn").disabled = true;
          setStatus("Procesando 0%...");

          const bestShift = await decode(state.gray, state.w, state.h, minS, maxS, block, (done, total) => {
            setStatus(`Procesando ${Math.round((done / total) * 100)}%...`);
          });

          let gray8 = normalizeShiftMap(bestShift, $("#st-invert").checked);
          if ($("#st-median").checked) gray8 = medianFilter3(gray8, state.w, state.h);

          state.depth8 = gray8;
          const c = grayToCanvas(gray8, state.w, state.h);
          const canvas = $("#st-canvas-depth");
          canvas.width = state.w; canvas.height = state.h;
          canvas.getContext("2d").drawImage(c, 0, 0);
          $("#st-block-depth").style.display = "";

          setStatus("✅ Mapa de profundidad generado.");
          $("#st-decode-btn").disabled = false;
        }

        function downloadCanvas(canvas, filename) {
          canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
          }, "image/png");
        }

        function saveDepthPng() {
          if (!state?.depth8) { alert("Todavía no decodificaste ninguna imagen."); return; }
          downloadCanvas($("#st-canvas-depth"), "mapa_profundidad.png");
        }

        function saveFullPng() {
          if (!state) { alert("Primero cargá una imagen."); return; }
          const orig = $("#st-canvas-original");
          const depth = state.depth8 ? $("#st-canvas-depth") : null;
          const margin = 15, titleH = 28, gap = 20;
          const w = Math.max(orig.width, depth ? depth.width : 0) + margin * 2;
          let h = margin + titleH + orig.height + gap;
          if (depth) h += titleH + depth.height + gap;
          h += margin;

          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = "#000";
          ctx.font = "bold 16px Arial";

          let y = margin;
          ctx.fillText("Imagen original" + ($("#st-dots-check").checked ? " (con puntos guía)" : ""), margin, y + 16);
          y += titleH;
          ctx.drawImage(orig, margin, y);
          y += orig.height + gap;

          if (depth) {
            ctx.fillText("Mapa de profundidad decodificado", margin, y + 16);
            y += titleH;
            ctx.drawImage(depth, margin, y);
          }

          downloadCanvas(c, "estereograma_captura.png");
        }

        /********************************************************
         API pública del módulo
        ********************************************************/

        function openModal(url) {
          $ = buildModal();
          if (url) loadFromUrl(url);
        }
        this._openModal = openModal;

        this._cleanup = () => {
          document.removeEventListener("mousemove", onMove, true);
          badge.remove();
          closeModal();
          this.active = false;
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
