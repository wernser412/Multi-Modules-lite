// imageHoverZoom.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "imageHoverZoom",
    mod: {
      title: "🔍 Image Hover Zoom",
      desc: "Vista previa ampliada de cualquier imagen al pasar el mouse, con toolbar compacto y movible para rotar, voltear y hacer zoom",
      category: "General",

      enable() {

        if (this.active) return;
        this.active = true;

        // ---------- Config / persistencia (por sitio) ----------
        const SITE = location.hostname || "default";
        const LS_KEY = {
          x: `mml_hz_toolbar_x__${SITE}`,
          y: `mml_hz_toolbar_y__${SITE}`,
          open: `mml_hz_toolbar_open__${SITE}`
        };
        const DEFAULT_POS = { x: 20, y: 76 }; // distancia desde bottom-left
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
            z-index: 2147483647;
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
          #mml-hz-row button {
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
          #mml-hz-row button:hover { background: rgba(255,255,255,.2); }
          #mml-hz-row button.mml-hz-active { background: #4285F4; }
          #mml-hz-row .mml-hz-sep {
            width: 1px;
            align-self: stretch;
            margin: 4px 2px;
            background: rgba(255,255,255,.1);
            flex: none;
          }
        `);

        // ---------- Panel de preview (se muestra al pasar sobre una imagen) ----------
        const wrap = document.createElement("div");
        wrap.id = "mml-hz-wrap";

        const panel = document.createElement("img");
        panel.id = "mml-hz-preview";
        wrap.appendChild(panel);
        document.documentElement.appendChild(wrap);

        // ---------- Toolbar compacto: FAB + fila de controles ----------
        const makeBtn = (label, title) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = label;
          b.title = title;
          return b;
        };

        const toolbar = document.createElement("div");
        toolbar.id = "mml-hz-toolbar";

        const fab = document.createElement("button");
        fab.id = "mml-hz-fab";
        fab.type = "button";
        fab.textContent = "🖼️";
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

        // ---------- Estado de transformación de la imagen ----------
        const state = { rot: 0, flipH: false, flipV: false, zoom: 1, pinned: false };

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
        btnPin.addEventListener("click", (e) => {
          e.stopPropagation();
          state.pinned = !state.pinned;
          btnPin.classList.toggle("mml-hz-active", state.pinned);
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
            // Si abrirlo hacia la derecha se saldría de pantalla, se abre
            // hacia la izquierda en su lugar.
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
          // Si no hubo arrastre real, fue un click: abrir/cerrar la fila.
          if (!moved) setOpen(!row.classList.contains("mml-hz-open"));
        };
        fab.addEventListener("pointerdown", onDragStart);
        fab.addEventListener("pointermove", onDragMove);
        fab.addEventListener("pointerup", onDragEnd);
        fab.addEventListener("pointercancel", onDragEnd);

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

        // No se oculta al instante: da un margen para cruzar la pantalla
        // hacia el toolbar sin que desaparezca a mitad de camino. Con 📌
        // fijado, no se oculta nunca (hasta que se desactive el pin).
        const scheduleHide = () => {
          if (!lastUrl || state.pinned) return;
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

        // Si el cursor sale de la ventana, también se oculta (salvo 📌).
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
