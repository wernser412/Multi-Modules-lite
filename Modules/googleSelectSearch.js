// googleSelectSearch.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "googleSelectSearch",
    mod: {
      title: "🔍 Buscar selección en Google",
      desc: "Al seleccionar texto aparece un ícono para buscarlo en Google en una ventana flotante (movible, redimensionable y colapsable)",
      category: "General",

      enable() {

        if (this.active) return;
        this.active = true;

        // ---------- Config ----------
        const LS_KEY = {
          x: "mml_gs_box_x",
          y: "mml_gs_box_y",
          w: "mml_gs_box_w",
          h: "mml_gs_box_h",
          collapsed: "mml_gs_box_collapsed"
        };
        const DEFAULT_BOX = { x: 60, y: 60, w: 500, h: 420 };
        const MIN_BOX = { w: 320, h: 220 };
        const MARGIN = 8;

        // ---------- Utilidades ----------
        const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
        const debounce = (fn, ms) => {
          let t = null;
          return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), ms);
          };
        };

        GM_addStyle(`
          #mml-gs-icon {
            position: absolute;
            box-sizing: border-box;
            width: 30px;
            height: 30px;
            cursor: pointer;
            background: #fff;
            border-radius: 50%;
            box-shadow: 0 3px 10px rgba(0,0,0,.25);
            padding: 6px;
            display: none;
            z-index: 2147483000;
            opacity: 0;
            transform: scale(.7);
            transition: opacity .15s ease, transform .15s ease;
          }
          #mml-gs-icon.mml-gs-visible { display: block; opacity: 1; transform: scale(1); }
          #mml-gs-icon:hover { transform: scale(1.12); }

          #mml-gs-box {
            position: fixed;
            background: #fff;
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 14px 40px rgba(0,0,0,.35);
            z-index: 2147483000;
            display: none;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            opacity: 0;
            transform: translateY(6px);
            transition: opacity .15s ease, transform .15s ease;
          }
          #mml-gs-box.mml-gs-visible { display: flex; flex-direction: column; opacity: 1; transform: translateY(0); }
          #mml-gs-box.mml-gs-collapsed { height: 42px !important; }
          #mml-gs-box.mml-gs-collapsed #mml-gs-frame-wrap,
          #mml-gs-box.mml-gs-collapsed #mml-gs-resize-handle { display: none; }

          #mml-gs-titlebar {
            flex-shrink: 0;
            height: 42px;
            background: linear-gradient(90deg, #4285F4, #34A853 40%, #FBBC05 70%, #EA4335);
            color: #fff;
            font-size: 13px;
            font-weight: 700;
            display: flex;
            align-items: center;
            padding: 0 6px 0 12px;
            gap: 4px;
            cursor: grab;
            user-select: none;
            text-shadow: 0 1px 2px rgba(0,0,0,.25);
          }
          #mml-gs-titlebar:active { cursor: grabbing; }
          #mml-gs-titlebar-text { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

          .mml-gs-title-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 26px;
            height: 26px;
            border-radius: 50%;
            background: rgba(255,255,255,.18);
            cursor: pointer;
            font-size: 13px;
            transition: background .15s ease, transform .15s ease;
            flex-shrink: 0;
          }
          .mml-gs-title-btn:hover { background: rgba(255,255,255,.32); }
          .mml-gs-title-btn.mml-gs-collapse-icon.mml-gs-collapsed { transform: rotate(180deg); }

          #mml-gs-frame-wrap { position: relative; flex: 1; min-height: 0; background: #f4f4f4; }
          #mml-gs-frame-wrap iframe { width: 100%; height: 100%; border: none; display: block; }
          #mml-gs-frame-loading {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            color: #777;
            font-size: 12px;
            background: #f4f4f4;
            transition: opacity .2s ease;
            pointer-events: none;
          }
          #mml-gs-frame-loading .mml-gs-spinner {
            width: 14px;
            height: 14px;
            border: 2px solid #ccc;
            border-top-color: #4285F4;
            border-radius: 50%;
            animation: mml-gs-spin 0.8s linear infinite;
          }
          @keyframes mml-gs-spin { to { transform: rotate(360deg); } }

          #mml-gs-resize-handle {
            position: absolute;
            width: 16px;
            height: 16px;
            right: 2px;
            bottom: 2px;
            cursor: se-resize;
            opacity: .55;
          }
          #mml-gs-resize-handle svg { width: 100%; height: 100%; }
          #mml-gs-resize-handle:hover { opacity: .9; }
        `);

        // ---------- Construcción de la UI ----------
        const icon = document.createElement("img");
        icon.id = "mml-gs-icon";
        icon.src = "https://www.google.com/favicon.ico";
        icon.title = "Buscar en Google";
        document.body.appendChild(icon);

        const box = document.createElement("div");
        box.id = "mml-gs-box";

        const titleBar = document.createElement("div");
        titleBar.id = "mml-gs-titlebar";

        const titleText = document.createElement("div");
        titleText.id = "mml-gs-titlebar-text";
        titleText.textContent = "🔍 Google Search";
        titleBar.appendChild(titleText);

        const openTabBtn = document.createElement("div");
        openTabBtn.className = "mml-gs-title-btn";
        openTabBtn.title = "Abrir en una pestaña nueva";
        openTabBtn.textContent = "↗";
        titleBar.appendChild(openTabBtn);

        const collapseBtn = document.createElement("div");
        collapseBtn.className = "mml-gs-title-btn mml-gs-collapse-icon";
        collapseBtn.title = "Colapsar / expandir";
        collapseBtn.textContent = "▾";
        titleBar.appendChild(collapseBtn);

        const closeBtn = document.createElement("div");
        closeBtn.className = "mml-gs-title-btn";
        closeBtn.title = "Cerrar";
        closeBtn.textContent = "✕";
        titleBar.appendChild(closeBtn);

        box.appendChild(titleBar);

        const frameWrap = document.createElement("div");
        frameWrap.id = "mml-gs-frame-wrap";

        const frame = document.createElement("iframe");
        frameWrap.appendChild(frame);

        const frameLoading = document.createElement("div");
        frameLoading.id = "mml-gs-frame-loading";
        const frameLoadingSpinner = document.createElement("div");
        frameLoadingSpinner.className = "mml-gs-spinner";
        const frameLoadingText = document.createElement("span");
        frameLoadingText.textContent = "Cargando resultados…";
        frameLoading.appendChild(frameLoadingSpinner);
        frameLoading.appendChild(frameLoadingText);
        frameWrap.appendChild(frameLoading);

        box.appendChild(frameWrap);

        const resizeHandle = document.createElement("div");
        resizeHandle.id = "mml-gs-resize-handle";
        const SVG_NS = "http://www.w3.org/2000/svg";
        const resizeSvg = document.createElementNS(SVG_NS, "svg");
        resizeSvg.setAttribute("viewBox", "0 0 16 16");
        const resizePath = document.createElementNS(SVG_NS, "path");
        resizePath.setAttribute("fill", "#0078D7");
        resizePath.setAttribute("d", "M15 15h-3v-2h3v2zm0-5h-3V8h3v2zm-5 5H7v-2h3v2zm0-5H7V8h3v2zm-5 5H2v-2h3v2z");
        resizeSvg.appendChild(resizePath);
        resizeHandle.appendChild(resizeSvg);
        box.appendChild(resizeHandle);

        document.body.appendChild(box);

        // ---------- Mostrar / ocultar ----------
        const hideBox = () => {
          box.classList.remove("mml-gs-visible");
          setTimeout(() => { box.style.display = "none"; }, 150);
        };

        const showBox = (query) => {
          frameLoading.style.opacity = "1";
          frame.dataset.query = query;
          frame.src = `https://www.google.com/search?igu=1&q=${query}`;
          box.style.display = "flex";
          void box.offsetWidth; // fuerza reflow para que la transición de entrada se anime
          box.classList.add("mml-gs-visible");
          icon.classList.remove("mml-gs-visible");
        };

        const onFrameLoad = () => { frameLoading.style.opacity = "0"; };
        frame.addEventListener("load", onFrameLoad);

        closeBtn.addEventListener("click", hideBox);

        const onOpenTab = () => {
          if (frame.dataset.query) {
            window.open(`https://www.google.com/search?q=${frame.dataset.query}`, "_blank");
          }
        };
        openTabBtn.addEventListener("click", onOpenTab);

        // ---------- Posición / tamaño: aplicar, limitar al viewport y guardar ----------
        const applyBoxRect = (x, y, w, h) => {
          const width = clamp(w, MIN_BOX.w, window.innerWidth - MARGIN * 2);
          const height = clamp(h, MIN_BOX.h, window.innerHeight - MARGIN * 2);
          const left = clamp(x, MARGIN, Math.max(MARGIN, window.innerWidth - width - MARGIN));
          const top = clamp(y, MARGIN, Math.max(MARGIN, window.innerHeight - height - MARGIN));

          box.style.left = left + "px";
          box.style.top = top + "px";
          box.style.width = width + "px";
          box.style.height = height + "px";

          return { x: left, y: top, w: width, h: height };
        };

        const saveBoxRect = debounce((rect) => {
          GM_setValue(LS_KEY.x, rect.x);
          GM_setValue(LS_KEY.y, rect.y);
          GM_setValue(LS_KEY.w, rect.w);
          GM_setValue(LS_KEY.h, rect.h);
        }, 150);

        const rect0 = applyBoxRect(
          GM_getValue(LS_KEY.x, DEFAULT_BOX.x),
          GM_getValue(LS_KEY.y, DEFAULT_BOX.y),
          GM_getValue(LS_KEY.w, DEFAULT_BOX.w),
          GM_getValue(LS_KEY.h, DEFAULT_BOX.h)
        );
        saveBoxRect(rect0);

        const onWindowResize = debounce(() => {
          const r = box.getBoundingClientRect();
          saveBoxRect(applyBoxRect(r.left, r.top, r.width, r.height));
        }, 150);
        window.addEventListener("resize", onWindowResize);

        // ---------- Arrastrar (Pointer Events: mouse y touch) ----------
        let dragging = false;
        let dragStartX = 0, dragStartY = 0, dragStartLeft = 0, dragStartTop = 0;

        const onDragStart = (e) => {
          if (e.target.closest(".mml-gs-title-btn")) return;
          dragging = true;
          titleBar.setPointerCapture(e.pointerId);
          const r = box.getBoundingClientRect();
          dragStartX = e.clientX;
          dragStartY = e.clientY;
          dragStartLeft = r.left;
          dragStartTop = r.top;
        };
        const onDragMove = (e) => {
          if (!dragging) return;
          const newLeft = dragStartLeft + (e.clientX - dragStartX);
          const newTop = dragStartTop + (e.clientY - dragStartY);
          const r = box.getBoundingClientRect();
          saveBoxRect(applyBoxRect(newLeft, newTop, r.width, r.height));
        };
        const onDragEnd = (e) => {
          if (!dragging) return;
          dragging = false;
          try { titleBar.releasePointerCapture(e.pointerId); } catch {}
        };
        titleBar.addEventListener("pointerdown", onDragStart);
        titleBar.addEventListener("pointermove", onDragMove);
        titleBar.addEventListener("pointerup", onDragEnd);
        titleBar.addEventListener("pointercancel", onDragEnd);

        // ---------- Redimensionar ----------
        let resizing = false;
        let resizeStartX = 0, resizeStartY = 0, resizeStartW = 0, resizeStartH = 0;

        const onResizeStart = (e) => {
          e.preventDefault();
          resizing = true;
          resizeHandle.setPointerCapture(e.pointerId);
          const r = box.getBoundingClientRect();
          resizeStartX = e.clientX;
          resizeStartY = e.clientY;
          resizeStartW = r.width;
          resizeStartH = r.height;
        };
        const onResizeMove = (e) => {
          if (!resizing) return;
          const r = box.getBoundingClientRect();
          const newW = resizeStartW + (e.clientX - resizeStartX);
          const newH = resizeStartH + (e.clientY - resizeStartY);
          saveBoxRect(applyBoxRect(r.left, r.top, newW, newH));
        };
        const onResizeEnd = (e) => {
          if (!resizing) return;
          resizing = false;
          try { resizeHandle.releasePointerCapture(e.pointerId); } catch {}
        };
        resizeHandle.addEventListener("pointerdown", onResizeStart);
        resizeHandle.addEventListener("pointermove", onResizeMove);
        resizeHandle.addEventListener("pointerup", onResizeEnd);
        resizeHandle.addEventListener("pointercancel", onResizeEnd);

        // ---------- Colapsar ----------
        const setCollapsed = (collapsed) => {
          box.classList.toggle("mml-gs-collapsed", collapsed);
          collapseBtn.classList.toggle("mml-gs-collapsed", collapsed);
          GM_setValue(LS_KEY.collapsed, collapsed ? "1" : "0");
        };
        const onCollapseClick = () => setCollapsed(!box.classList.contains("mml-gs-collapsed"));
        collapseBtn.addEventListener("click", onCollapseClick);
        setCollapsed(GM_getValue(LS_KEY.collapsed, "0") === "1");

        // ---------- Selección de texto -> ícono ----------
        // Se ignora si el clic/mouseup fue sobre el propio ícono o la caja:
        // si no, el ícono se ocultaría justo antes de procesar su propio clic.
        const onTextSelect = (e) => {
          if (e.target.closest("#mml-gs-icon, #mml-gs-box")) return;

          const sel = window.getSelection();
          const text = sel?.toString().trim();

          if (!text) {
            icon.classList.remove("mml-gs-visible");
            return;
          }

          const rect = sel.getRangeAt(0).getBoundingClientRect();
          icon.style.left = `${rect.right + window.scrollX + 6}px`;
          icon.style.top = `${rect.top + window.scrollY - 4}px`;
          icon.classList.add("mml-gs-visible");
          icon.onclick = () => showBox(encodeURIComponent(text));
        };
        document.addEventListener("mouseup", onTextSelect);

        // ---------- Escape cierra la caja (si no se está escribiendo) ----------
        const onKeyDown = (e) => {
          if (e.key !== "Escape") return;
          const el = document.activeElement;
          if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
          if (box.classList.contains("mml-gs-visible")) hideBox();
        };
        document.addEventListener("keydown", onKeyDown);

        this._cleanup = () => {
          document.removeEventListener("mouseup", onTextSelect);
          document.removeEventListener("keydown", onKeyDown);
          window.removeEventListener("resize", onWindowResize);
          frame.removeEventListener("load", onFrameLoad);
          icon.remove();
          box.remove();
          this.active = false;
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
