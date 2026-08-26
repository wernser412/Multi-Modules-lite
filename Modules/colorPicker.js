// colorPicker.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "colorPicker",
    mod: {
      title: "🎨 Selector de color (RGB)",
      desc: "Cuentagotas para elegir cualquier color en pantalla y ver su HEX/RGB, con copiado con un click",
      category: "General",

      enable() {

        if (this.active) return;
        this.active = true;

        const SITE = location.hostname || "default";
        const LS_KEY = {
          x: `mml_cp_fab_x__${SITE}`,
          y: `mml_cp_fab_y__${SITE}`
        };
        const DEFAULT_POS = { x: 20, y: 132 }; // arriba de imageHoverZoom (76) y elementHider (20)
        const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

        GM_addStyle(`
          #mml-cp-fab {
            position: fixed;
            z-index: 2147483647;
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
          #mml-cp-fab.mml-cp-dragging { cursor: grabbing; }
          #mml-cp-fab.mml-cp-busy { background: #4285F4; }
          #mml-cp-panel {
            position: fixed;
            z-index: 2147483647;
            width: 220px;
            background: #14161a;
            color: #eee;
            border: 1px solid rgba(255,255,255,.08);
            border-radius: 14px;
            box-shadow: 0 12px 36px rgba(0,0,0,.5);
            padding: 12px;
            font: 12.5px -apple-system,Segoe UI,Arial,sans-serif;
            display: none;
          }
          #mml-cp-panel.mml-cp-open { display: block; }
          #mml-cp-swatch {
            width: 100%;
            height: 54px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,.12);
            margin-bottom: 10px;
          }
          .mml-cp-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            background: #1d2025;
            border-radius: 8px;
            padding: 6px 9px;
            margin-bottom: 6px;
          }
          .mml-cp-row .mml-cp-label { color: #8a8f98; font-size: 10.5px; flex: none; }
          .mml-cp-row .mml-cp-value {
            font-weight: 600;
            letter-spacing: .2px;
            flex: 1 1 auto;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .mml-cp-row .mml-cp-copy-btn {
            flex: none;
            border: 1px solid rgba(255,255,255,.14);
            background: #262a31;
            color: #eee;
            font-size: 10.5px;
            font-weight: 600;
            padding: 4px 8px;
            border-radius: 6px;
            cursor: pointer;
          }
          .mml-cp-row .mml-cp-copy-btn:hover { background: #30353d; }
          #mml-cp-hint {
            text-align: center;
            color: #8a8f98;
            font-size: 10.5px;
            margin-top: 2px;
          }
          #mml-cp-toast {
            position: absolute;
            top: -28px;
            left: 50%;
            transform: translateX(-50%);
            background: #00c48c;
            color: #08150f;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 999px;
            white-space: nowrap;
            opacity: 0;
            pointer-events: none;
            transition: opacity .15s ease, transform .15s ease;
          }
          #mml-cp-toast.mml-cp-show { opacity: 1; transform: translateX(-50%) translateY(-4px); }
        `);

        // ---------- FAB ----------
        const fab = document.createElement("button");
        fab.id = "mml-cp-fab";
        fab.type = "button";
        fab.textContent = "🎨";
        fab.title = "Elegir un color de la pantalla";
        document.documentElement.appendChild(fab);

        // ---------- Panel de resultado ----------
        const panel = document.createElement("div");
        panel.id = "mml-cp-panel";

        const toast = document.createElement("div");
        toast.id = "mml-cp-toast";
        toast.textContent = "✅ Copiado";
        panel.appendChild(toast);

        const swatch = document.createElement("div");
        swatch.id = "mml-cp-swatch";
        panel.appendChild(swatch);

        // Cada fila: etiqueta (HEX/RGB) + valor + botón "Copiar" explícito,
        // igual que en la versión de AutoHotkey.
        const makeRow = (labelText) => {
          const row = document.createElement("div");
          row.className = "mml-cp-row";

          const label = document.createElement("span");
          label.className = "mml-cp-label";
          label.textContent = labelText;

          const value = document.createElement("span");
          value.className = "mml-cp-value";
          value.textContent = "—";

          const copyBtn = document.createElement("button");
          copyBtn.type = "button";
          copyBtn.className = "mml-cp-copy-btn";
          copyBtn.textContent = "Copiar";
          copyBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            copyText(value.textContent);
          });

          row.appendChild(label);
          row.appendChild(value);
          row.appendChild(copyBtn);
          panel.appendChild(row);
          return { row, value };
        };

        const hexRow = makeRow("HEX");
        const rgbRow = makeRow("RGB");

        const hint = document.createElement("div");
        hint.id = "mml-cp-hint";
        hint.textContent = "Click en \"Copiar\" para copiar el valor";
        panel.appendChild(hint);

        document.documentElement.appendChild(panel);

        // ---------- Copiar con feedback ----------
        let toastTimer = null;
        const showToast = () => {
          toast.classList.add("mml-cp-show");
          clearTimeout(toastTimer);
          toastTimer = setTimeout(() => toast.classList.remove("mml-cp-show"), 900);
        };
        const copyText = async (text) => {
          if (!text || text === "—") return;
          try {
            await navigator.clipboard.writeText(text);
            showToast();
          } catch {}
        };

        // ---------- Conversión HEX <-> RGB ----------
        const hexToRgb = (hex) => {
          const m = hex.replace("#", "").match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i);
          if (!m) return { r: 0, g: 0, b: 0 };
          return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
        };

        // ---------- Mostrar un color en el panel ----------
        const showColor = (hex) => {
          const { r, g, b } = hexToRgb(hex);
          swatch.style.background = hex;
          hexRow.value.textContent = hex.toUpperCase();
          rgbRow.value.textContent = `rgb(${r}, ${g}, ${b})`;
          panel.classList.add("mml-cp-open");
          positionPanel();
        };

        // ---------- Posicionamiento del panel (junto al FAB, sin salirse) ----------
        const positionPanel = () => {
          const fr = fab.getBoundingClientRect();
          let left = fr.right + 10;
          let top = fr.top;
          const pw = 220, ph = panel.offsetHeight || 180;
          if (left + pw > window.innerWidth - 4) left = fr.left - pw - 10;
          if (left < 4) left = clamp(fr.left, 4, window.innerWidth - pw - 4);
          if (top + ph > window.innerHeight - 4) top = window.innerHeight - ph - 4;
          top = clamp(top, 4, window.innerHeight - ph - 4);
          panel.style.left = `${left}px`;
          panel.style.top = `${top}px`;
        };

        // ---------- Cuentagotas ----------
        const supported = "EyeDropper" in window;
        if (!supported) fab.title = "Tu navegador no soporta el selector nativo de color (usa Chrome/Edge)";

        const pick = async () => {
          if (!supported) {
            hexRow.value.textContent = "No soportado";
            rgbRow.value.textContent = "Usa Chrome/Edge 95+";
            swatch.style.background = "#333";
            panel.classList.add("mml-cp-open");
            positionPanel();
            return;
          }
          try {
            fab.classList.add("mml-cp-busy");
            const eyeDropper = new window.EyeDropper();
            const result = await eyeDropper.open();
            const hex = result.sRGBHex;
            showColor(hex);
          } catch (err) {
            // AbortError = el usuario canceló (Esc / click derecho). Cualquier
            // otro error se deja ver en consola para poder diagnosticarlo.
            if (err?.name !== "AbortError") console.error("[colorPicker]", err);
          } finally {
            fab.classList.remove("mml-cp-busy");
          }
        };

        // ---------- Arrastrar el FAB (posición persistida por sitio) ----------
        const setFabPos = (x, y) => {
          x = clamp(x, 4, window.innerWidth - 38 - 4);
          y = clamp(y, 4, window.innerHeight - 38 - 4);
          fab.style.left = `${x}px`;
          fab.style.top = `${y}px`;
          return { x, y };
        };

        const savedX = Number(GM_getValue(LS_KEY.x, DEFAULT_POS.x));
        const savedY = Number(GM_getValue(LS_KEY.y, DEFAULT_POS.y));
        setFabPos(savedX, window.innerHeight - savedY - 38);

        let dragging = false;
        let moved = false;
        let dragStartX = 0, dragStartY = 0, dragStartLeft = 0, dragStartTop = 0;

        const onDragStart = (e) => {
          dragging = true;
          moved = false;
          fab.classList.add("mml-cp-dragging");
          fab.setPointerCapture(e.pointerId);
          dragStartX = e.clientX;
          dragStartY = e.clientY;
          const r = fab.getBoundingClientRect();
          dragStartLeft = r.left;
          dragStartTop = r.top;
        };
        const onDragMove = (e) => {
          if (!dragging) return;
          if (Math.abs(e.clientX - dragStartX) > 3 || Math.abs(e.clientY - dragStartY) > 3) moved = true;
          if (!moved) return;
          const pos = setFabPos(
            dragStartLeft + (e.clientX - dragStartX),
            dragStartTop + (e.clientY - dragStartY)
          );
          GM_setValue(LS_KEY.x, pos.x);
          GM_setValue(LS_KEY.y, window.innerHeight - pos.y - 38);
          if (panel.classList.contains("mml-cp-open")) positionPanel();
        };
        const onDragEnd = (e) => {
          if (!dragging) return;
          dragging = false;
          fab.classList.remove("mml-cp-dragging");
          try { fab.releasePointerCapture(e.pointerId); } catch {}
          if (!moved) pick(); // fue un click, no un arrastre: abrir el cuentagotas
        };
        fab.addEventListener("pointerdown", onDragStart);
        fab.addEventListener("pointermove", onDragMove);
        fab.addEventListener("pointerup", onDragEnd);
        fab.addEventListener("pointercancel", onDragEnd);

        // Cerrar el panel al clickear afuera.
        const onDocClick = (e) => {
          if (fab.contains(e.target) || panel.contains(e.target)) return;
          panel.classList.remove("mml-cp-open");
        };
        document.addEventListener("click", onDocClick, true);

        const onWindowResize = () => {
          const r = fab.getBoundingClientRect();
          setFabPos(r.left, r.top);
          if (panel.classList.contains("mml-cp-open")) positionPanel();
        };
        window.addEventListener("resize", onWindowResize);

        this._cleanup = () => {
          document.removeEventListener("click", onDocClick, true);
          window.removeEventListener("resize", onWindowResize);
          clearTimeout(toastTimer);
          fab.remove();
          panel.remove();
          this.active = false;
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
