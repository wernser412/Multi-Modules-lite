// imageHoverZoom.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "imageHoverZoom",
    mod: {
      title: "🔍 Image Hover Zoom",
      desc: "Vista previa ampliada de cualquier imagen al pasar el mouse, con toolbar movible para rotar, voltear y hacer zoom",
      category: "General",

      enable() {

        if (this.active) return;
        this.active = true;

        // ---------- Config / persistencia (por sitio) ----------
        const SITE = location.hostname || "default";
        const LS_KEY = {
          x: `mml_hz_toolbar_x__${SITE}`,
          y: `mml_hz_toolbar_y__${SITE}`,
          scale: `mml_hz_toolbar_scale__${SITE}`
        };
        const DEFAULT_POS = { x: 20, y: 76 }; // desde bottom-left
        const MIN_SCALE = 0.7;
        const MAX_SCALE = 1.6;
        const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

        GM_addStyle(`
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
          #mml-hz-toolbar {
            position: fixed;
            display: flex;
            align-items: center;
            gap: 4px;
            background: #14161a;
            border: 1px solid rgba(255,255,255,.08);
            border-radius: 999px;
            padding: 6px;
            box-shadow: 0 8px 24px rgba(0,0,0,.45);
            z-index: 2147483647;
            cursor: grab;
            user-select: none;
            transform-origin: bottom left;
          }
          #mml-hz-toolbar.mml-hz-dragging { cursor: grabbing; }
          #mml-hz-toolbar button {
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
          #mml-hz-toolbar button:hover { background: rgba(255,255,255,.2); }
          #mml-hz-toolbar button.mml-hz-active { background: #4285F4; }
          #mml-hz-toolbar .mml-hz-sep {
            width: 1px;
            align-self: stretch;
            margin: 4px 2px;
            background: rgba(255,255,255,.1);
            flex: none;
          }
          #mml-hz-toolbar .mml-hz-grip {
            width: 16px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: nwse-resize;
            color: #666;
            font-size: 13px;
            flex: none;
            touch-action: none;
          }
          #mml-hz-toolbar .mml-hz-grip:hover { color: #aaa; }
        `);

        // ---------- Estructura: wrap (panel de preview, se muestra al hover) ----------
        const wrap = document.createElement("div");
        wrap.id = "mml-hz-wrap";

        const panel = document.createElement("img");
        panel.id = "mml-hz-preview";
        wrap.appendChild(panel);
        document.documentElement.appendChild(wrap);

        // ---------- Toolbar: persistente, siempre visible, arrastrable ----------
        const makeBtn = (label, title) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = label;
          b.title = title;
          return b;
        };

        const toolbar = document.createElement("div");
        toolbar.id = "mml-hz-toolbar";

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
        const btnReset = makeBtn("↺", "Restablecer todo");
        const grip = document.createElement("div");
        grip.className = "mml-hz-grip";
        grip.textContent = "⠿";
        grip.title = "Arrastrar el borde para agrandar/achicar el toolbar";

        toolbar.append(
          btnRotateLeft, btnRotateRight, btnFlipH, btnFlipV,
          sep1, btnZoomOut, btnZoomIn,
          sep2, btnReset, grip
        );
        document.documentElement.appendChild(toolbar);

        // ---------- Estado de transformación de la imagen ----------
        const state = { rot: 0, flipH: false, flipV: false, zoom: 1 };

        const applyTransform = () => {
          panel.style.transform =
            `rotate(${state.rot}deg) scale(${state.zoom * (state.flipH ? -1 : 1)}, ${state.zoom * (state.flipV ? -1 : 1)})`;
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
        btnReset.addEventListener("click", (e) => {
          e.stopPropagation();
          resetState();
        });

        // ---------- Arrastrar el toolbar (posición persistida por sitio) ----------
        const setToolbarPos = (x, y) => {
          const w = toolbar.offsetWidth || 200;
          const h = toolbar.offsetHeight || 42;
          x = clamp(x, 4, window.innerWidth - w - 4);
          y = clamp(y, 4, window.innerHeight - h - 4);
          toolbar.style.left = `${x}px`;
          toolbar.style.top = `${y}px`;
          return { x, y };
        };

        // Posición guardada como distancia desde bottom-left, para que se
        // adapte razonablemente si cambia el tamaño de ventana.
        const savedX = Number(GM_getValue(LS_KEY.x, DEFAULT_POS.x));
        const savedY = Number(GM_getValue(LS_KEY.y, DEFAULT_POS.y));
        setToolbarPos(savedX, window.innerHeight - savedY - 42);

        const savedScale = Number(GM_getValue(LS_KEY.scale, 1));
        toolbar.style.transform = `scale(${clamp(savedScale, MIN_SCALE, MAX_SCALE)})`;

        let dragging = false;
        let dragStartX = 0, dragStartY = 0, dragStartLeft = 0, dragStartTop = 0;

        const onDragStart = (e) => {
          if (e.target.closest("button, .mml-hz-grip")) return; // esos tienen su propio handler
          dragging = true;
          toolbar.classList.add("mml-hz-dragging");
          toolbar.setPointerCapture(e.pointerId);
          dragStartX = e.clientX;
          dragStartY = e.clientY;
          const r = toolbar.getBoundingClientRect();
          dragStartLeft = r.left;
          dragStartTop = r.top;
        };
        const onDragMove = (e) => {
          if (!dragging) return;
          const pos = setToolbarPos(
            dragStartLeft + (e.clientX - dragStartX),
            dragStartTop + (e.clientY - dragStartY)
          );
          GM_setValue(LS_KEY.x, pos.x);
          GM_setValue(LS_KEY.y, window.innerHeight - pos.y - toolbar.offsetHeight);
        };
        const onDragEnd = (e) => {
          if (!dragging) return;
          dragging = false;
          toolbar.classList.remove("mml-hz-dragging");
          try { toolbar.releasePointerCapture(e.pointerId); } catch {}
        };
        toolbar.addEventListener("pointerdown", onDragStart);
        toolbar.addEventListener("pointermove", onDragMove);
        toolbar.addEventListener("pointerup", onDragEnd);
        toolbar.addEventListener("pointercancel", onDragEnd);

        // ---------- "Estirar" el toolbar: el grip escala todo el bloque ----------
        let resizing = false;
        let resizeStartX = 0, resizeStartScale = 1;

        const onResizeStart = (e) => {
          e.stopPropagation();
          resizing = true;
          resizeStartX = e.clientX;
          resizeStartScale = clamp(Number(GM_getValue(LS_KEY.scale, 1)), MIN_SCALE, MAX_SCALE);
          grip.setPointerCapture(e.pointerId);
        };
        const onResizeMove = (e) => {
          if (!resizing) return;
          const delta = (e.clientX - resizeStartX) / 200; // sensibilidad
          const newScale = clamp(resizeStartScale + delta, MIN_SCALE, MAX_SCALE);
          toolbar.style.transform = `scale(${newScale})`;
          GM_setValue(LS_KEY.scale, newScale);
        };
        const onResizeEnd = (e) => {
          if (!resizing) return;
          resizing = false;
          try { grip.releasePointerCapture(e.pointerId); } catch {}
        };
        grip.addEventListener("pointerdown", onResizeStart);
        grip.addEventListener("pointermove", onResizeMove);
        grip.addEventListener("pointerup", onResizeEnd);
        grip.addEventListener("pointercancel", onResizeEnd);

        // Si cambia el tamaño de la ventana, re-clamped para que no quede
        // fuera de pantalla.
        const onWindowResize = () => {
          const r = toolbar.getBoundingClientRect();
          setToolbarPos(r.left, r.top);
        };
        window.addEventListener("resize", onWindowResize);

        // Misma lógica de extracción que imageTooltip.js: sirve para
        // imágenes normales, lazy-load (data-src/data-original), <image>
        // de SVG y fondos con background-image.
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

        // Tamaño mínimo para no activar el preview con iconos/avatares/sprites.
        const MIN_SIZE = 48;

        const isTooSmall = (el) => {
          const r = el.getBoundingClientRect?.();
          if (!r) return false;
          return r.width < MIN_SIZE || r.height < MIN_SIZE;
        };

        let lastUrl = "";
        let lastSide = ""; // "left" | "right" — evita reescribir el style si no cambió
        let hideTimer = null;

        const cancelHide = () => {
          if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
          }
        };

        // El panel de preview (no el toolbar, que ahora es siempre visible)
        // se oculta con un pequeño margen para poder cruzar la pantalla
        // hacia el toolbar sin que desaparezca a mitad de camino.
        const scheduleHide = () => {
          if (!lastUrl) return;
          cancelHide();
          hideTimer = setTimeout(() => {
            lastUrl = "";
            wrap.style.display = "none";
          }, 350);
        };

        // Pone el panel del lado contrario al cursor: si estás mirando
        // imágenes pegadas a la derecha, el panel aparece a la izquierda
        // (y viceversa), para que nunca tape a la miniatura siguiente.
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

        // En vez de depender de mouseover/mouseout (que a veces no disparan
        // bien: scroll rápido, elementos que se re-renderizan, overlays,
        // z-index encimados, etc.), se revisa en cada mousemove qué hay
        // realmente bajo el cursor. Así el panel nunca queda "pegado":
        // si no hay imagen debajo, se oculta sí o sí en ese mismo movimiento.
        const onMove = (e) => {
          // Si el cursor está sobre nuestro propio panel o el toolbar, no
          // tocar nada: se puede ir hasta los botones sin que el preview
          // se oculte en el camino.
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
            resetState(); // imagen nueva: arrancar sin rotación/volteo/zoom previo
          }
          positionPanel(e.clientX);
          wrap.style.display = "block";
        };

        // Si el cursor sale de la ventana, también se oculta el panel de
        // preview (el toolbar se queda, es persistente).
        const onLeaveWindow = (e) => {
          if (!e.relatedTarget && !e.toElement) scheduleHide();
        };

        document.addEventListener("mousemove", onMove, true);
        document.addEventListener("mouseout", onLeaveWindow, true);

        this._cleanup = () => {
          document.removeEventListener("mousemove", onMove, true);
          document.removeEventListener("mouseout", onLeaveWindow, true);
          window.removeEventListener("resize", onWindowResize);
          cancelHide();
          wrap.remove();
          toolbar.remove();
          this.active = false;
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
