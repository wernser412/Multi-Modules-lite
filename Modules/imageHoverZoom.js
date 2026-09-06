// imageHoverZoom.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "imageHoverZoom",
    mod: {
      title: "🔍 Image Hover Zoom",
      desc: "Vista previa ampliada de imágenes al pasar el mouse. Elegí modo: panel flotante o toolbar sobre la misma imagen",
      category: "General",

      enable() {

        if (this.active) return;
        this.active = true;

        // ---------- Config / persistencia ----------
        const SITE = location.hostname || "default";
        const LS_KEY = {
          x: `mml_hz_toolbar_x__${SITE}`,
          y: `mml_hz_toolbar_y__${SITE}`,
          open: `mml_hz_toolbar_open__${SITE}`
        };
        const MODE_KEY = "mml_hz_mode"; // "float" | "overlay" | null (sin elegir todavía)
        const DEFAULT_POS = { x: 20, y: 76 }; // distancia desde bottom-left
        const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
        const MIN_SIZE = 48; // tamaño mínimo para no activar con iconos/avatares/sprites

        const makeBtn = (label, title) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = label;
          b.title = title;
          return b;
        };

        GM_addStyle(`
          /* ---------- Selector de modo ---------- */
          #mml-hz-mode-fab {
            position: fixed;
            left: 20px;
            bottom: 20px;
            width: 34px;
            height: 34px;
            box-sizing: border-box;
            border-radius: 999px;
            background: #14161a;
            color: #eee;
            border: 1px solid rgba(255,255,255,.08);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 15px;
            cursor: pointer;
            z-index: 2147483647;
            box-shadow: 0 8px 24px rgba(0,0,0,.45);
            user-select: none;
          }
          #mml-hz-mode-fab.mml-hz-mode-set { background: #4285F4; }
          #mml-hz-mode-menu {
            position: fixed;
            left: 20px;
            bottom: 62px;
            display: none;
            flex-direction: column;
            gap: 6px;
            background: #14161a;
            border: 1px solid rgba(255,255,255,.08);
            border-radius: 12px;
            padding: 10px;
            width: 240px;
            z-index: 2147483647;
            box-shadow: 0 8px 24px rgba(0,0,0,.45);
            font-family: -apple-system, Segoe UI, Arial, sans-serif;
          }
          #mml-hz-mode-menu.mml-hz-mode-open { display: flex; }
          #mml-hz-mode-menu .mml-hz-mode-title {
            font-size: 11px; color: #8a8f98; text-transform: uppercase;
            letter-spacing: .05em; margin: 0 2px 2px;
          }
          #mml-hz-mode-menu button {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 2px;
            background: rgba(255,255,255,.06);
            border: 1px solid transparent;
            border-radius: 9px;
            color: #eee;
            padding: 8px 10px;
            cursor: pointer;
            text-align: left;
            font-family: inherit;
          }
          #mml-hz-mode-menu button:hover { background: rgba(255,255,255,.14); }
          #mml-hz-mode-menu button.mml-hz-mode-active { border-color: #4285F4; background: rgba(66,133,244,.15); }
          #mml-hz-mode-menu button b { font-size: 12.5px; }
          #mml-hz-mode-menu button span { font-size: 10.5px; color: #a8adb5; }

          /* ---------- Modo 1: Panel flotante ---------- */
          #mml-hz-wrap {
            position: fixed;
            top: 50%;
            transform: translateY(-50%);
            max-height: 88vh;
            max-width: 42vw;
            z-index: 2147483647;
            display: none;
            pointer-events: none;
          }
          #mml-hz-preview {
            display: block;
            max-height: 88vh;
            max-width: 42vw;
            border-radius: 12px;
            box-shadow: 0 0 40px rgba(0,0,0,.85);
            background: #000;
            object-fit: contain;
            pointer-events: none;
            transition: transform .15s ease;
          }
          #mml-hz-preview.mml-hz-pannable {
            pointer-events: auto;
            cursor: grab;
            transition: none;
          }
          #mml-hz-preview.mml-hz-pannable.mml-hz-panning { cursor: grabbing; }
          #mml-hz-toolbar {
            position: fixed;
            z-index: 2147483647;
            display: none; /* solo visible cuando el panel flotante está activo (imagen en hover o fijado) */
          }
          #mml-hz-fab {
            width: 38px;
            height: 38px;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            border-radius: 999px;
            background: #14161a;
            color: #eee;
            font-size: 16px;
            cursor: grab;
            box-shadow: 0 8px 24px rgba(0,0,0,.45);
            border: 1px solid rgba(255,255,255,.08);
            user-select: none;
            touch-action: none;
          }
          #mml-hz-fab.mml-hz-dragging { cursor: grabbing; }
          #mml-hz-fab.mml-hz-active { background: #4285F4; }
          #mml-hz-fab span {
            display: inline-block;
            transition: transform .15s ease;
          }
          #mml-hz-fab.mml-hz-active span { transform: rotate(180deg); }
          #mml-hz-row {
            position: absolute;
            top: 0;
            display: none;
            align-items: center;
            gap: 4px;
            background: #14161a;
            border: 1px solid rgba(255,255,255,.08);
            border-radius: 999px;
            padding: 6px;
            box-shadow: 0 8px 24px rgba(0,0,0,.45);
          }
          #mml-hz-row.mml-hz-open { display: flex; }
          #mml-hz-row.mml-hz-row-right { left: 44px; }
          #mml-hz-row.mml-hz-row-left { right: 44px; }
          #mml-hz-row button,
          #mml-hz-ov-toolbar button {
            box-sizing: border-box;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            border-radius: 999px;
            background: rgba(255,255,255,.08);
            color: #eee;
            font-size: 14px;
            cursor: pointer;
            line-height: 1;
            flex: none;
          }
          #mml-hz-row button:hover,
          #mml-hz-ov-toolbar button:hover { background: rgba(255,255,255,.2); }
          #mml-hz-row button.mml-hz-active,
          #mml-hz-ov-toolbar button.mml-hz-active { background: #4285F4; }
          #mml-hz-row .mml-hz-sep,
          #mml-hz-ov-toolbar .mml-hz-sep {
            width: 1px;
            align-self: stretch;
            margin: 4px 2px;
            background: rgba(255,255,255,.1);
            flex: none;
          }

          /* ---------- Modo 2: toolbar sobre la misma imagen ---------- */
          .mml-hz-ov-target {
            transition: transform .15s ease;
            will-change: transform;
          }
          #mml-hz-ov-toolbar {
            position: fixed;
            display: none;
            align-items: center;
            gap: 4px;
            background: #14161a;
            border: 1px solid rgba(255,255,255,.08);
            border-radius: 999px;
            padding: 6px;
            z-index: 2147483647;
            box-shadow: 0 8px 24px rgba(0,0,0,.45);
          }
          #mml-hz-ov-toolbar.mml-hz-ov-open { display: flex; }
          #mml-hz-ov-toolbar.mml-hz-ov-mini .mml-hz-ov-extra { display: none; }
          #mml-hz-ov-fullscreen {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,.92);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 2147483646;
          }
          #mml-hz-ov-fullscreen.mml-hz-ov-fs-open { display: flex; }
          #mml-hz-ov-fullscreen-img {
            max-width: 92vw;
            max-height: 92vh;
            object-fit: contain;
            border-radius: 8px;
            box-shadow: 0 0 60px rgba(0,0,0,.8);
            transition: transform .15s ease;
          }
        `);

        // ---------- Extraer URL de imagen ----------
        // Sirve para imágenes normales, lazy-load (data-src/data-original),
        // <image> de SVG y fondos con background-image.
        const extract = (node) => {
          while (node) {
            if (node.nodeType !== 1) {
              node = node.parentElement;
              continue;
            }

            const tag = node.tagName.toLowerCase();

            if (tag === "img") {
              return (
                node.getAttribute("orig") ||
                node.currentSrc ||
                node.src ||
                node.getAttribute("data-src") ||
                node.getAttribute("data-original") ||
                ""
              );
            }

            if (tag === "image") {
              return (
                node.getAttribute("href") ||
                node.getAttribute("xlink:href") ||
                ""
              );
            }

            const child = node.querySelector?.("img") || node.querySelector?.("image");

            if (child) {
              const cs2 = getComputedStyle(child);
              return (
                child.getAttribute("orig") ||
                child.currentSrc ||
                child.src ||
                child.getAttribute("data-src") ||
                child.getAttribute("data-original") ||
                child.getAttribute("href") ||
                child.getAttribute("xlink:href") ||
                (cs2.backgroundImage !== "none" &&
                  cs2.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1]) ||
                ""
              );
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

        // ---------- Encontrar el nodo visual de la imagen (modo overlay) ----------
        // A diferencia de extract(), acá necesitamos el elemento DOM real
        // (no la URL) para poder transformarlo/rotarlo directamente.
        const findImageNode = (node) => {
          while (node) {
            if (node.nodeType !== 1) {
              node = node.parentElement;
              continue;
            }
            const tag = node.tagName.toLowerCase();
            if (tag === "img" || tag === "image") return node;

            const child = node.querySelector?.("img") || node.querySelector?.("image");
            if (child) return child;

            const cs = getComputedStyle(node);
            if (cs.backgroundImage && cs.backgroundImage !== "none") return node;

            node = node.parentElement;
          }
          return null;
        };

        const isTooSmall = (el) => {
          const r = el.getBoundingClientRect?.();
          if (!r) return false;
          return r.width < MIN_SIZE || r.height < MIN_SIZE;
        };

        /********************************************************
         MODO 1: Panel flotante
         Los controles (FAB + fila de botones) solo se muestran
         mientras el panel flotante está activo: hay una imagen en
         hover, o quedó fijado con 📌. Si no, están ocultos.
        ********************************************************/
        const initFloatMode = () => {
          // ---------- Panel de preview ----------
          const wrap = document.createElement("div");
          wrap.id = "mml-hz-wrap";

          const panel = document.createElement("img");
          panel.id = "mml-hz-preview";
          wrap.appendChild(panel);
          document.documentElement.appendChild(wrap);

          // ---------- Toolbar compacto: FAB + fila de controles ----------
          const toolbar = document.createElement("div");
          toolbar.id = "mml-hz-toolbar";

          const fab = document.createElement("button");
          fab.id = "mml-hz-fab";
          fab.type = "button";
          const fabIcon = document.createElement("span");
          fabIcon.textContent = "▶";
          fab.appendChild(fabIcon);
          fab.title = "Controles de zoom (arrastrar para mover)";

          const row = document.createElement("div");
          row.id = "mml-hz-row";
          row.className = "mml-hz-row-right";

          const btnRotateLeft = makeBtn("⟲", "Rotar 90° a la izquierda");
          const btnRotateRight = makeBtn("⟳", "Rotar 90° a la derecha");
          const btnFlipH = makeBtn("⇋", "Voltear horizontal");
          const btnFlipV = makeBtn("⇕", "Voltear vertical");
          const sep1 = document.createElement("div");
          sep1.className = "mml-hz-sep";
          const btnZoomOut = makeBtn("−", "Alejar");
          const btnZoomIn = makeBtn("+", "Acercar");
          const sep2 = document.createElement("div");
          sep2.className = "mml-hz-sep";
          const btnPin = makeBtn("📌", "Fijar: mantener visible aunque el mouse salga de la imagen");
          const btnReset = makeBtn("↺", "Restablecer todo");

          row.append(
            btnRotateLeft, btnRotateRight, btnFlipH, btnFlipV,
            sep1, btnZoomOut, btnZoomIn,
            sep2, btnPin, btnReset
          );

          toolbar.append(fab, row);
          document.documentElement.appendChild(toolbar);

          // ---------- Mostrar/ocultar panel + controles juntos ----------
          const setPanelVisible = (visible) => {
            wrap.style.display = visible ? "block" : "none";
            toolbar.style.display = visible ? "block" : "none";
          };

          // ---------- Estado de transformación de la imagen ----------
          const state = { rot: 0, flipH: false, flipV: false, zoom: 1, pinned: false, panX: 0, panY: 0 };

          const applyTransform = () => {
            panel.style.transform =
              `translate(${state.panX}px, ${state.panY}px) rotate(${state.rot}deg) scale(${state.zoom * (state.flipH ? -1 : 1)}, ${state.zoom * (state.flipV ? -1 : 1)})`;
          };

          const resetState = () => {
            state.rot = 0;
            state.flipH = false;
            state.flipV = false;
            state.zoom = 1;
            state.panX = 0;
            state.panY = 0;
            btnFlipH.classList.remove("mml-hz-active");
            btnFlipV.classList.remove("mml-hz-active");
            applyTransform();
          };

          btnRotateLeft.addEventListener("click", (e) => {
            e.stopPropagation();
            state.rot = (state.rot - 90) % 360;
            applyTransform();
          });
          btnRotateRight.addEventListener("click", (e) => {
            e.stopPropagation();
            state.rot = (state.rot + 90) % 360;
            applyTransform();
          });
          btnFlipH.addEventListener("click", (e) => {
            e.stopPropagation();
            state.flipH = !state.flipH;
            btnFlipH.classList.toggle("mml-hz-active", state.flipH);
            applyTransform();
          });
          btnFlipV.addEventListener("click", (e) => {
            e.stopPropagation();
            state.flipV = !state.flipV;
            btnFlipV.classList.toggle("mml-hz-active", state.flipV);
            applyTransform();
          });
          btnZoomOut.addEventListener("click", (e) => {
            e.stopPropagation();
            state.zoom = clamp(state.zoom - 0.25, 0.5, 4);
            applyTransform();
          });
          btnZoomIn.addEventListener("click", (e) => {
            e.stopPropagation();
            state.zoom = clamp(state.zoom + 0.25, 0.5, 4);
            applyTransform();
          });
          btnPin.addEventListener("click", (e) => {
            e.stopPropagation();
            state.pinned = !state.pinned;
            btnPin.classList.toggle("mml-hz-active", state.pinned);
            panel.classList.toggle("mml-hz-pannable", state.pinned);
          });
          btnReset.addEventListener("click", (e) => {
            e.stopPropagation();
            resetState();
          });

          // ---------- Abrir/cerrar la fila de controles (compacto) ----------
          const setOpen = (open) => {
            row.classList.toggle("mml-hz-open", open);
            fab.classList.toggle("mml-hz-active", open);
            GM_setValue(LS_KEY.open, open ? "1" : "0");

            if (open) {
              row.className = "mml-hz-row mml-hz-open mml-hz-row-right";
              const r = row.getBoundingClientRect();
              if (r.right > window.innerWidth - 4) {
                row.className = "mml-hz-row mml-hz-open mml-hz-row-left";
              }
            }
          };

          // ---------- Arrastrar el FAB (posición persistida por sitio) ----------
          const setToolbarPos = (x, y) => {
            const w = 38, h = 38;
            x = clamp(x, 4, window.innerWidth - w - 4);
            y = clamp(y, 4, window.innerHeight - h - 4);
            toolbar.style.left = `${x}px`;
            toolbar.style.top = `${y}px`;
            return { x, y };
          };

          const savedX = Number(GM_getValue(LS_KEY.x, DEFAULT_POS.x));
          const savedY = Number(GM_getValue(LS_KEY.y, DEFAULT_POS.y));
          setToolbarPos(savedX, window.innerHeight - savedY - 38);
          setOpen(GM_getValue(LS_KEY.open, "0") === "1");

          let dragging = false;
          let moved = false;
          let dragStartX = 0, dragStartY = 0, dragStartLeft = 0, dragStartTop = 0;

          const onDragStart = (e) => {
            dragging = true;
            moved = false;
            fab.classList.add("mml-hz-dragging");
            fab.setPointerCapture(e.pointerId);
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            const r = toolbar.getBoundingClientRect();
            dragStartLeft = r.left;
            dragStartTop = r.top;
          };
          const onDragMove = (e) => {
            if (!dragging) return;
            if (Math.abs(e.clientX - dragStartX) > 3 || Math.abs(e.clientY - dragStartY) > 3) moved = true;
            if (!moved) return;
            const pos = setToolbarPos(
              dragStartLeft + (e.clientX - dragStartX),
              dragStartTop + (e.clientY - dragStartY)
            );
            GM_setValue(LS_KEY.x, pos.x);
            GM_setValue(LS_KEY.y, window.innerHeight - pos.y - 38);
          };
          const onDragEnd = (e) => {
            if (!dragging) return;
            dragging = false;
            fab.classList.remove("mml-hz-dragging");
            try { fab.releasePointerCapture(e.pointerId); } catch {}
            if (!moved) setOpen(!row.classList.contains("mml-hz-open"));
          };
          fab.addEventListener("pointerdown", onDragStart);
          fab.addEventListener("pointermove", onDragMove);
          fab.addEventListener("pointerup", onDragEnd);
          fab.addEventListener("pointercancel", onDragEnd);

          const onWindowResize = () => {
            const r = toolbar.getBoundingClientRect();
            setToolbarPos(r.left, r.top);
          };
          window.addEventListener("resize", onWindowResize);

          // ---------- Arrastrar la imagen ampliada (pan, solo si está 📌) ----------
          let panning = false;
          let panStartX = 0, panStartY = 0, panOrigX = 0, panOrigY = 0;

          const onPanStart = (e) => {
            if (!state.pinned) return;
            panning = true;
            panel.classList.add("mml-hz-panning");
            panel.setPointerCapture(e.pointerId);
            panStartX = e.clientX;
            panStartY = e.clientY;
            panOrigX = state.panX;
            panOrigY = state.panY;
            e.preventDefault();
          };
          const onPanMove = (e) => {
            if (!panning) return;
            state.panX = panOrigX + (e.clientX - panStartX);
            state.panY = panOrigY + (e.clientY - panStartY);
            applyTransform();
          };
          const onPanEnd = (e) => {
            if (!panning) return;
            panning = false;
            panel.classList.remove("mml-hz-panning");
            try { panel.releasePointerCapture(e.pointerId); } catch {}
          };
          panel.addEventListener("pointerdown", onPanStart);
          panel.addEventListener("pointermove", onPanMove);
          panel.addEventListener("pointerup", onPanEnd);
          panel.addEventListener("pointercancel", onPanEnd);

          let lastUrl = "";
          let lastSide = "";
          let hideTimer = null;

          const cancelHide = () => {
            if (hideTimer) {
              clearTimeout(hideTimer);
              hideTimer = null;
            }
          };

          const scheduleHide = () => {
            if (!lastUrl || state.pinned) return;
            cancelHide();
            hideTimer = setTimeout(() => {
              lastUrl = "";
              setPanelVisible(false);
            }, 350);
          };

          const positionPanel = (clientX) => {
            const side = clientX > window.innerWidth / 2 ? "left" : "right";
            if (side === lastSide) return;
            lastSide = side;
            if (side === "left") {
              wrap.style.left = "20px";
              wrap.style.right = "auto";
            } else {
              wrap.style.right = "20px";
              wrap.style.left = "auto";
            }
          };

          const onMove = (e) => {
            if (panning) {
              cancelHide();
              return;
            }

            if (wrap.contains(e.target) || toolbar.contains(e.target)) {
              cancelHide();
              return;
            }

            const el = e.target.closest?.("img, image, [style*='background-image']");

            if (!el || isTooSmall(el)) {
              scheduleHide();
              return;
            }

            const url = extract(el);

            if (!url) {
              scheduleHide();
              return;
            }

            cancelHide();

            if (url !== lastUrl) {
              lastUrl = url;
              panel.src = url;
              resetState();
            }
            positionPanel(e.clientX);
            setPanelVisible(true);
          };

          const onLeaveWindow = (e) => {
            if (!e.relatedTarget && !e.toElement) scheduleHide();
          };

          document.addEventListener("mousemove", onMove, true);
          document.addEventListener("mouseout", onLeaveWindow, true);

          return function teardown() {
            document.removeEventListener("mousemove", onMove, true);
            document.removeEventListener("mouseout", onLeaveWindow, true);
            window.removeEventListener("resize", onWindowResize);
            panel.removeEventListener("pointerdown", onPanStart);
            panel.removeEventListener("pointermove", onPanMove);
            panel.removeEventListener("pointerup", onPanEnd);
            panel.removeEventListener("pointercancel", onPanEnd);
            cancelHide();
            wrap.remove();
            toolbar.remove();
          };
        };

        /********************************************************
         MODO 2: Toolbar arriba de la misma imagen (in-place),
         con botón ⛶ para ver la imagen en pantalla completa
         (con todos los controles disponibles ahí también).
        ********************************************************/
        const initOverlayMode = () => {
          const ovToolbar = document.createElement("div");
          ovToolbar.id = "mml-hz-ov-toolbar";

          const btnRotateLeft = makeBtn("⟲", "Rotar 90° a la izquierda");
          const btnRotateRight = makeBtn("⟳", "Rotar 90° a la derecha");
          const btnFlipH = makeBtn("⇋", "Voltear horizontal");
          const btnFlipV = makeBtn("⇕", "Voltear vertical");
          const sep1 = document.createElement("div");
          sep1.className = "mml-hz-sep mml-hz-ov-extra";
          const btnZoomOut = makeBtn("−", "Alejar");
          const btnZoomIn = makeBtn("+", "Acercar");
          const sep2 = document.createElement("div");
          sep2.className = "mml-hz-sep mml-hz-ov-extra";
          const btnPin = makeBtn("📌", "Fijar: mantener el zoom aunque el mouse salga de la imagen");
          const btnFullscreen = makeBtn("⛶", "Ver en pantalla completa");
          const sep3 = document.createElement("div");
          sep3.className = "mml-hz-sep mml-hz-ov-extra";
          const btnReset = makeBtn("↺", "Restablecer todo");

          // Mientras se hace hover normal, la toolbar sobre la imagen solo
          // muestra el botón de pantalla completa. El resto de controles
          // (rotar, voltear, zoom, pin, reset) recién aparecen al entrar
          // en pantalla completa.
          [btnRotateLeft, btnRotateRight, btnFlipH, btnFlipV, btnZoomOut, btnZoomIn, btnPin, btnReset]
            .forEach(b => b.classList.add("mml-hz-ov-extra"));

          ovToolbar.append(
            btnRotateLeft, btnRotateRight, btnFlipH, btnFlipV,
            sep1, btnZoomOut, btnZoomIn,
            sep2, btnPin, btnFullscreen,
            sep3, btnReset
          );
          ovToolbar.classList.add("mml-hz-ov-mini");
          document.documentElement.appendChild(ovToolbar);

          // ---------- Overlay de pantalla completa ----------
          const fsOverlay = document.createElement("div");
          fsOverlay.id = "mml-hz-ov-fullscreen";
          const fsImg = document.createElement("img");
          fsImg.id = "mml-hz-ov-fullscreen-img";
          fsOverlay.appendChild(fsImg);
          document.documentElement.appendChild(fsOverlay);

          const state = { rot: 0, flipH: false, flipV: false, zoom: 1, pinned: false };
          let currentEl = null;
          let originalInline = { position: "", zIndex: "" };
          let fsOpen = false;

          const applyTransform = () => {
            const t = `rotate(${state.rot}deg) scale(${state.zoom * (state.flipH ? -1 : 1)}, ${state.zoom * (state.flipV ? -1 : 1)})`;
            if (currentEl) {
              currentEl.style.transformOrigin = "top center";
              currentEl.style.transform = t;
            }
            if (fsOpen) {
              fsImg.style.transform = t;
            }
          };

          const resetState = () => {
            state.rot = 0;
            state.flipH = false;
            state.flipV = false;
            state.zoom = 1;
            btnFlipH.classList.remove("mml-hz-active");
            btnFlipV.classList.remove("mml-hz-active");
            applyTransform();
          };

          const positionToolbar = () => {
            if (!currentEl || fsOpen) return;
            const r = currentEl.getBoundingClientRect();
            const tw = ovToolbar.offsetWidth || 220;
            let left = r.left + r.width / 2 - tw / 2;
            left = clamp(left, 4, window.innerWidth - tw - 4);
            let top = clamp(r.top + 6, 4, window.innerHeight - 40);
            ovToolbar.style.left = `${left}px`;
            ovToolbar.style.top = `${top}px`;
          };

          const positionToolbarFullscreen = () => {
            const tw = ovToolbar.offsetWidth || 220;
            const left = clamp(window.innerWidth / 2 - tw / 2, 4, window.innerWidth - tw - 4);
            const top = window.innerHeight - 54;
            ovToolbar.style.left = `${left}px`;
            ovToolbar.style.top = `${top}px`;
          };

          const clearTarget = () => {
            if (currentEl) {
              currentEl.style.transform = "";
              currentEl.style.transformOrigin = "";
              currentEl.style.position = originalInline.position;
              currentEl.style.zIndex = originalInline.zIndex;
              currentEl.classList.remove("mml-hz-ov-target");
            }
            currentEl = null;
            ovToolbar.classList.remove("mml-hz-ov-open");
          };

          const setTarget = (el) => {
            if (currentEl === el) return;
            clearTarget();
            currentEl = el;
            originalInline.position = el.style.position;
            originalInline.zIndex = el.style.zIndex;
            if (getComputedStyle(el).position === "static") el.style.position = "relative";
            el.style.zIndex = "2147483000";
            el.classList.add("mml-hz-ov-target");
            resetState();
            ovToolbar.classList.add("mml-hz-ov-open");
            positionToolbar();
          };

          // ---------- Pantalla completa ----------
          const onFsKeydown = (e) => {
            if (e.key === "Escape") closeFullscreen();
          };

          const openFullscreen = () => {
            if (!currentEl) return;
            const url = extract(currentEl);
            if (!url) return;
            cancelHide();
            fsImg.src = url;
            fsOpen = true;
            fsOverlay.classList.add("mml-hz-ov-fs-open");
            btnFullscreen.classList.add("mml-hz-active");
            ovToolbar.classList.remove("mml-hz-ov-mini"); // en pantalla completa: mostrar todos los controles
            applyTransform();
            positionToolbarFullscreen();
            document.addEventListener("keydown", onFsKeydown, true);
          };

          const closeFullscreen = () => {
            fsOpen = false;
            fsOverlay.classList.remove("mml-hz-ov-fs-open");
            btnFullscreen.classList.remove("mml-hz-active");
            ovToolbar.classList.add("mml-hz-ov-mini"); // al volver al hover normal: solo el botón ⛶
            document.removeEventListener("keydown", onFsKeydown, true);
            if (currentEl) {
              positionToolbar();
            } else {
              ovToolbar.classList.remove("mml-hz-ov-open");
            }
          };

          fsOverlay.addEventListener("click", (e) => {
            if (e.target === fsOverlay) closeFullscreen();
          });

          btnRotateLeft.addEventListener("click", (e) => {
            e.stopPropagation();
            state.rot = (state.rot - 90) % 360;
            applyTransform();
          });
          btnRotateRight.addEventListener("click", (e) => {
            e.stopPropagation();
            state.rot = (state.rot + 90) % 360;
            applyTransform();
          });
          btnFlipH.addEventListener("click", (e) => {
            e.stopPropagation();
            state.flipH = !state.flipH;
            btnFlipH.classList.toggle("mml-hz-active", state.flipH);
            applyTransform();
          });
          btnFlipV.addEventListener("click", (e) => {
            e.stopPropagation();
            state.flipV = !state.flipV;
            btnFlipV.classList.toggle("mml-hz-active", state.flipV);
            applyTransform();
          });
          btnZoomOut.addEventListener("click", (e) => {
            e.stopPropagation();
            state.zoom = clamp(state.zoom - 0.25, 1, 4);
            applyTransform();
          });
          btnZoomIn.addEventListener("click", (e) => {
            e.stopPropagation();
            state.zoom = clamp(state.zoom + 0.25, 1, 4);
            applyTransform();
          });
          btnPin.addEventListener("click", (e) => {
            e.stopPropagation();
            state.pinned = !state.pinned;
            btnPin.classList.toggle("mml-hz-active", state.pinned);
          });
          btnFullscreen.addEventListener("click", (e) => {
            e.stopPropagation();
            if (fsOpen) closeFullscreen();
            else openFullscreen();
          });
          btnReset.addEventListener("click", (e) => {
            e.stopPropagation();
            resetState();
          });

          let hideTimer = null;
          const cancelHide = () => {
            if (hideTimer) {
              clearTimeout(hideTimer);
              hideTimer = null;
            }
          };
          const scheduleHide = () => {
            if (!currentEl || state.pinned || fsOpen) return;
            cancelHide();
            hideTimer = setTimeout(() => clearTarget(), 300);
          };

          const onMove = (e) => {
            if (fsOpen) return; // no cambiar de imagen mientras está en pantalla completa

            if (ovToolbar.contains(e.target)) {
              cancelHide();
              return;
            }

            const hit = e.target.closest?.("img, image, [style*='background-image']");

            if (!hit || isTooSmall(hit)) {
              scheduleHide();
              return;
            }

            const target = findImageNode(hit) || hit;

            if (state.pinned && currentEl && target !== currentEl) {
              // Con 📌 fijado no cambiamos de imagen: hay que soltar el pin primero.
              return;
            }

            cancelHide();

            if (target !== currentEl) {
              setTarget(target);
            } else {
              positionToolbar();
            }
          };

          const onScrollOrResize = () => {
            if (fsOpen) positionToolbarFullscreen();
            else positionToolbar();
          };

          document.addEventListener("mousemove", onMove, true);
          window.addEventListener("scroll", onScrollOrResize, true);
          window.addEventListener("resize", onScrollOrResize);

          return function teardown() {
            document.removeEventListener("mousemove", onMove, true);
            window.removeEventListener("scroll", onScrollOrResize, true);
            window.removeEventListener("resize", onScrollOrResize);
            document.removeEventListener("keydown", onFsKeydown, true);
            cancelHide();
            clearTarget();
            ovToolbar.remove();
            fsOverlay.remove();
          };
        };

        /********************************************************
         Selector de modo: nada se activa hasta elegir uno
        ********************************************************/
        const modeFab = document.createElement("button");
        modeFab.id = "mml-hz-mode-fab";
        modeFab.type = "button";
        modeFab.textContent = "🧩";

        const modeMenu = document.createElement("div");
        modeMenu.id = "mml-hz-mode-menu";

        const modeMenuTitle = document.createElement("div");
        modeMenuTitle.className = "mml-hz-mode-title";
        modeMenuTitle.textContent = "Modo de Image Hover Zoom";

        const btnModeFloat = document.createElement("button");
        btnModeFloat.type = "button";
        btnModeFloat.innerHTML = "<b>🖼️ Panel flotante</b><span>Vista ampliada en un panel lateral. Controles visibles solo con el panel activo</span>";

        const btnModeOverlay = document.createElement("button");
        btnModeOverlay.type = "button";
        btnModeOverlay.innerHTML = "<b>📌 Sobre la imagen</b><span>Zoom en el lugar + toolbar arriba de la imagen, con opción de pantalla completa</span>";

        modeMenu.append(modeMenuTitle, btnModeFloat, btnModeOverlay);
        document.documentElement.append(modeFab, modeMenu);

        const setMenuOpen = (open) => modeMenu.classList.toggle("mml-hz-mode-open", open);

        let currentMode = GM_getValue(MODE_KEY, null);
        let teardownActive = null;

        const updateModeButtons = () => {
          btnModeFloat.classList.toggle("mml-hz-mode-active", currentMode === "float");
          btnModeOverlay.classList.toggle("mml-hz-mode-active", currentMode === "overlay");
          modeFab.classList.toggle("mml-hz-mode-set", !!currentMode);
          modeFab.title = currentMode
            ? "Cambiar modo de Image Hover Zoom"
            : "Elegí un modo para activar Image Hover Zoom";
        };

        const chooseMode = (mode) => {
          setMenuOpen(false);
          if (mode === currentMode) return;
          if (teardownActive) {
            teardownActive();
            teardownActive = null;
          }
          currentMode = mode;
          GM_setValue(MODE_KEY, mode);
          updateModeButtons();
          teardownActive = mode === "float" ? initFloatMode() : initOverlayMode();
        };

        btnModeFloat.addEventListener("click", (e) => {
          e.stopPropagation();
          chooseMode("float");
        });
        btnModeOverlay.addEventListener("click", (e) => {
          e.stopPropagation();
          chooseMode("overlay");
        });

        modeFab.addEventListener("click", (e) => {
          e.stopPropagation();
          setMenuOpen(!modeMenu.classList.contains("mml-hz-mode-open"));
        });

        const onOutsideClick = (e) => {
          if (!modeMenu.contains(e.target) && e.target !== modeFab) setMenuOpen(false);
        };
        document.addEventListener("click", onOutsideClick, true);

        updateModeButtons();

        // Al activar el módulo, ninguno de los dos modos corre todavía:
        // si ya había uno elegido antes, se retoma; si no, se abre el
        // selector para que el usuario elija.
        if (currentMode === "float" || currentMode === "overlay") {
          teardownActive = currentMode === "float" ? initFloatMode() : initOverlayMode();
        } else {
          setMenuOpen(true);
        }

        this._cleanup = () => {
          if (teardownActive) teardownActive();
          document.removeEventListener("click", onOutsideClick, true);
          modeFab.remove();
          modeMenu.remove();
          this.active = false;
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
