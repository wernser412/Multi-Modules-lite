// elementHider.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  // Estado compartido a nivel de módulo: sobrevive a enable()/disable() y
  // a que el usuario apague el switch, para que el panel de restaurar y los
  // elementos ya ocultos sigan disponibles.
  let hiddenItems = [];         // [{ el, label, selector, originalDisplay, originalPriority, persisted }]
  let hoverBox, hoverLabel, restoreFab, restorePanel, restoreList;
  let stylesInjected = false;
  let moduleActive = false;     // true mientras el switch del panel está encendido
  let currentTarget = null;
  let applyTimer = null;

  const OWN_SELECTOR = "#mml-hider-box, #mml-hider-label, #mml-hider-panel, #mml-hider-fab, #mml-fab, #mml-panel";
  const STORE_KEY = "mml_hider_store_v1";
  const PAUSED_KEY = "mml_hider_paused_v1";

  // true = modo selección en pausa (no oculta al clickear). Se recuerda
  // entre recargas tal como el usuario lo dejó.
  let paused = (function () {
    try { return !!GM_getValue(PAUSED_KEY, false); } catch { return false; }
  })();

  /* ---------------- Estilos ---------------- */

  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    GM_addStyle(`
      #mml-hider-box {
        position: fixed; pointer-events: none; z-index: 2147483645;
        border: 2px solid #ff4d6d; background: rgba(255,77,109,0.12);
        border-radius: 3px; box-sizing: border-box;
        transition: top .04s linear, left .04s linear, width .04s linear, height .04s linear;
        display: none;
      }
      #mml-hider-label {
        position: fixed; pointer-events: none; z-index: 2147483646;
        background: #14161a; color: #ff8fa3; font: 11px/1.4 -apple-system,Segoe UI,Arial,sans-serif;
        padding: 3px 7px; border-radius: 6px; white-space: nowrap;
        box-shadow: 0 4px 14px rgba(0,0,0,.4); border: 1px solid rgba(255,255,255,.08);
        display: none; max-width: 60vw; overflow: hidden; text-overflow: ellipsis;
      }
      #mml-hider-fab {
        position: fixed; left: 20px; bottom: 20px; z-index: 2147483647;
        background: #14161a; color: #eee; border: 1px solid rgba(255,255,255,.08);
        border-radius: 999px; padding: 6px 10px 6px 6px; font: 600 12px -apple-system,Segoe UI,Arial,sans-serif;
        cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,.4); display: none;
        align-items: center; gap: 7px; user-select: none;
      }
      #mml-hider-fab .mml-hf-pause {
        display: none; align-items: center; justify-content: center;
        width: 24px; height: 24px; border-radius: 50%; border: none;
        background: rgba(255,255,255,.1); color: #fff; font-size: 12px; cursor: pointer; flex: none;
      }
      #mml-hider-fab .mml-hf-pause:hover { background: rgba(255,255,255,.2); }
      #mml-hider-fab .mml-hf-text { white-space: nowrap; }
      #mml-hider-fab .mml-hider-dot {
        background: #ff4d6d; color: #fff; border-radius: 999px; min-width: 16px; height: 16px;
        font-size: 10px; display: none; align-items: center; justify-content: center; padding: 0 4px;
      }
      #mml-hider-panel {
        position: fixed; left: 20px; bottom: 76px; width: 280px; max-height: 60vh;
        background: #14161a; color: #eee; border-radius: 14px; overflow: hidden;
        display: none; flex-direction: column; z-index: 2147483647;
        font-family: -apple-system,Segoe UI,Arial,sans-serif; font-size: 12.5px;
        box-shadow: 0 12px 36px rgba(0,0,0,.5); border: 1px solid rgba(255,255,255,.06);
      }
      #mml-hider-panel.open { display: flex; }
      #mml-hider-panel .mml-hp-head {
        display: flex; align-items: center; justify-content: space-between; padding: 10px 12px;
        border-bottom: 1px solid rgba(255,255,255,.06);
        background: linear-gradient(180deg, rgba(255,77,109,.12), transparent);
      }
      #mml-hider-panel .mml-hp-head b { font-size: 13px; }
      #mml-hider-panel .mml-hp-restoreall {
        background: rgba(255,255,255,.06); border: none; color: #ccc; font-size: 10.5px;
        padding: 4px 8px; border-radius: 7px; cursor: pointer;
      }
      #mml-hider-panel .mml-hp-restoreall:hover { background: rgba(255,255,255,.12); color: #fff; }
      #mml-hider-panel .mml-hp-hint {
        padding: 6px 12px; font-size: 10px; color: #8a8f98; border-bottom: 1px solid rgba(255,255,255,.05);
      }
      #mml-hider-panel .mml-hp-list { overflow-y: auto; padding: 6px 8px 10px; }
      #mml-hider-panel .mml-hp-empty { padding: 14px 6px; color: #8a8f98; text-align: center; font-size: 11.5px; }
      #mml-hider-panel .mml-hp-row {
        display: flex; align-items: center; gap: 8px; padding: 7px 8px; margin: 4px 0;
        background: #1d2025; border-radius: 9px;
      }
      #mml-hider-panel .mml-hp-row:hover { background: #23262c; }
      #mml-hider-panel .mml-hp-name {
        flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        color: #ddd; font-size: 11.5px;
      }
      #mml-hider-panel .mml-hp-restore {
        flex: none; background: rgba(0,196,140,.15); color: #00c48c; border: none;
        border-radius: 7px; padding: 4px 7px; font-size: 10.5px; cursor: pointer;
      }
      #mml-hider-panel .mml-hp-restore:hover { background: rgba(0,196,140,.28); }
    `);
  }

  /* ---------------- Descripción / selector ---------------- */

  function describeElement(el) {
    if (!el || !el.tagName) return "elemento";
    const tag = el.tagName.toLowerCase();
    const idPart = el.id ? "#" + el.id : "";
    let classPart = "";
    if (el.classList && el.classList.length) {
      classPart = "." + Array.from(el.classList).slice(0, 2).join(".");
    }
    let label = tag + idPart + classPart;
    if (!idPart && !classPart) {
      const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28);
      if (text) label += ` “${text}”`;
    }
    return label;
  }

  function cssEscape(s) {
    if (window.CSS && CSS.escape) return CSS.escape(s);
    return String(s).replace(/([ #.;?%&,+*~':"!^$\[\]()=>|/@])/g, "\\$1");
  }

  // Genera un selector aproximado para poder volver a encontrar el mismo
  // elemento tras recargar la página. No es perfecto (páginas muy dinámicas
  // pueden cambiar de estructura), pero funciona bien para la mayoría de sitios.
  function buildSelectorPath(el) {
    if (!el || el.nodeType !== 1) return "";
    if (el.id) return "#" + cssEscape(el.id);

    const parts = [];
    let node = el;
    let depth = 0;
    while (node && node.nodeType === 1 && node !== document.documentElement && depth < 8) {
      if (node.id) {
        parts.unshift("#" + cssEscape(node.id));
        break;
      }
      let part = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter(c => c.tagName === node.tagName);
        if (sameTag.length > 1) {
          part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
        }
      }
      parts.unshift(part);
      if (parent === document.body) { parts.unshift("body"); break; }
      node = parent;
      depth++;
    }
    return parts.join(" > ");
  }

  /* ---------------- Almacenamiento persistente ---------------- */

  function pageKey() {
    return location.hostname + location.pathname;
  }

  function loadStore() {
    try { return GM_getValue(STORE_KEY, {}) || {}; } catch { return {}; }
  }

  function saveStore(store) {
    try { GM_setValue(STORE_KEY, store); } catch {}
  }

  function getPersistedList() {
    const store = loadStore();
    return store[pageKey()] || [];
  }

  function addPersisted(selector, label) {
    if (!selector) return;
    const store = loadStore();
    const key = pageKey();
    const list = store[key] || [];
    if (!list.some(it => it.selector === selector)) {
      list.push({ selector, label });
      store[key] = list;
      saveStore(store);
    }
  }

  function removePersisted(selector) {
    if (!selector) return;
    const store = loadStore();
    const key = pageKey();
    store[key] = (store[key] || []).filter(it => it.selector !== selector);
    saveStore(store);
  }

  function clearPersistedForPage() {
    const store = loadStore();
    delete store[pageKey()];
    saveStore(store);
  }

  /* ---------------- Ocultar / restaurar ---------------- */

  function hideElement(el, opts) {
    opts = opts || {};
    const persist = opts.persist !== false;
    if (!el || el === document.body || el === document.documentElement) return;
    if (el.closest && el.closest(OWN_SELECTOR)) return;
    if (hiddenItems.some(it => it.el === el)) return;

    const originalDisplay = el.style.display || "";
    const originalPriority = el.style.getPropertyPriority("display");
    const selector = buildSelectorPath(el);
    const label = describeElement(el);

    el.setAttribute("data-mml-hidden", "1");
    el.style.setProperty("display", "none", "important");

    hiddenItems.push({ el, label, selector, originalDisplay, originalPriority });

    if (persist) addPersisted(selector, label);

    renderRestoreUI();
  }

  function restoreElement(item) {
    const idx = hiddenItems.indexOf(item);
    if (idx === -1) return;

    const { el, originalDisplay, originalPriority, selector } = item;
    if (el && el.isConnected) {
      if (originalDisplay) el.style.setProperty("display", originalDisplay, originalPriority || "");
      else el.style.removeProperty("display");
      el.removeAttribute("data-mml-hidden");
    }

    hiddenItems.splice(idx, 1);
    removePersisted(selector);
    renderRestoreUI();
  }

  function restoreAll() {
    [...hiddenItems].forEach(restoreElement);
    clearPersistedForPage();
    renderRestoreUI();
  }

  // Vuelve a aplicar, en la carga actual de la página, lo que se ocultó
  // en sesiones anteriores. Corre independientemente de si el switch del
  // módulo está encendido, para que lo oculto se mantenga oculto siempre.
  function applyPersisted() {
    const list = getPersistedList();
    if (!list.length) return;
    list.forEach(({ selector }) => {
      if (!selector) return;
      let el = null;
      try { el = document.querySelector(selector); } catch {}
      if (el && !hiddenItems.some(it => it.el === el)) {
        hideElement(el, { persist: false });
      }
    });
  }

  function scheduleApplyPersisted() {
    if (applyTimer) return;
    applyTimer = setTimeout(() => { applyTimer = null; applyPersisted(); }, 300);
  }

  /* ---------------- UI: overlay de hover ---------------- */

  function ensureHoverNodes() {
    injectStyles();
    if (!hoverBox) {
      hoverBox = document.createElement("div");
      hoverBox.id = "mml-hider-box";
      document.documentElement.appendChild(hoverBox);
    }
    if (!hoverLabel) {
      hoverLabel = document.createElement("div");
      hoverLabel.id = "mml-hider-label";
      document.documentElement.appendChild(hoverLabel);
    }
  }

  function positionHover(el) {
    const r = el.getBoundingClientRect();
    hoverBox.style.display = "block";
    hoverBox.style.top = r.top + "px";
    hoverBox.style.left = r.left + "px";
    hoverBox.style.width = r.width + "px";
    hoverBox.style.height = r.height + "px";

    hoverLabel.style.display = "block";
    hoverLabel.textContent = describeElement(el);

    const labelH = 24;
    let top = r.top - labelH;
    if (top < 4) top = Math.min(r.bottom + 4, window.innerHeight - labelH);
    const left = Math.max(4, Math.min(r.left, window.innerWidth - 260));
    hoverLabel.style.top = top + "px";
    hoverLabel.style.left = left + "px";
  }

  function clearHoverVisual() {
    currentTarget = null;
    if (hoverBox) hoverBox.style.display = "none";
    if (hoverLabel) hoverLabel.style.display = "none";
  }

  /* ---------------- UI: panel / botón de restaurar ---------------- */

  function togglePause() {
    paused = !paused;
    try { GM_setValue(PAUSED_KEY, paused); } catch {}
    if (paused) clearHoverVisual();
    renderRestoreUI();
  }

  function ensureRestoreNodes() {
    injectStyles();

    if (!restoreFab) {
      restoreFab = document.createElement("div");
      restoreFab.id = "mml-hider-fab";

      const pauseBtn = document.createElement("button");
      pauseBtn.type = "button";
      pauseBtn.className = "mml-hf-pause";
      pauseBtn.onclick = e => { e.stopPropagation(); togglePause(); };

      const text = document.createElement("span");
      text.className = "mml-hf-text";

      const dot = document.createElement("span");
      dot.className = "mml-hider-dot";

      restoreFab.append(pauseBtn, text, dot);
      restoreFab.addEventListener("click", () => {
        restorePanel.classList.toggle("open");
      });

      document.documentElement.appendChild(restoreFab);
    }

    if (!restorePanel) {
      restorePanel = document.createElement("div");
      restorePanel.id = "mml-hider-panel";

      const head = document.createElement("div");
      head.className = "mml-hp-head";

      const title = document.createElement("b");
      title.textContent = "🧹 Elementos ocultos";

      const btnAll = document.createElement("button");
      btnAll.className = "mml-hp-restoreall";
      btnAll.textContent = "Restaurar todo";
      btnAll.onclick = restoreAll;

      head.append(title, btnAll);

      const hint = document.createElement("div");
      hint.className = "mml-hp-hint";
      hint.textContent = "Esc o el botón ⏸ pausan la selección sin perder lo ya oculto.";

      restoreList = document.createElement("div");
      restoreList.className = "mml-hp-list";

      restorePanel.append(head, hint, restoreList);
      document.documentElement.appendChild(restorePanel);
    }
  }

  function renderRestoreUI() {
    ensureRestoreNodes();

    const count = hiddenItems.length;
    const pauseBtn = restoreFab.querySelector(".mml-hf-pause");
    const text = restoreFab.querySelector(".mml-hf-text");
    const dot = restoreFab.querySelector(".mml-hider-dot");

    restoreFab.style.display = (moduleActive || count > 0) ? "flex" : "none";

    if (moduleActive) {
      pauseBtn.style.display = "flex";
      pauseBtn.textContent = paused ? "▶" : "⏸";
      pauseBtn.title = paused ? "Reanudar selección" : "Pausar selección (Esc)";
      text.textContent = paused ? "Pausado" : "Seleccionando";
    } else {
      pauseBtn.style.display = "none";
      text.textContent = "🧹 Ocultos";
    }

    dot.textContent = count;
    dot.style.display = count > 0 ? "flex" : "none";

    if (count === 0) restorePanel.classList.remove("open");

    while (restoreList.firstChild) restoreList.removeChild(restoreList.firstChild);

    if (count === 0) {
      const empty = document.createElement("div");
      empty.className = "mml-hp-empty";
      empty.textContent = "No hay elementos ocultos todavía.";
      restoreList.appendChild(empty);
      return;
    }

    hiddenItems.forEach(item => {
      const row = document.createElement("div");
      row.className = "mml-hp-row";

      const name = document.createElement("div");
      name.className = "mml-hp-name";
      name.textContent = item.label;
      name.title = item.label;

      const btn = document.createElement("button");
      btn.className = "mml-hp-restore";
      btn.textContent = "♻ Restaurar";
      btn.onclick = () => restoreElement(item);

      row.append(name, btn);
      restoreList.appendChild(row);
    });
  }

  // Quita por completo la GUI del módulo del DOM (fab, panel, overlay de
  // hover). Las referencias se resetean para que ensure*Nodes() las vuelva
  // a crear desde cero la próxima vez que se active el módulo.
  function removeGuiNodes() {
    [hoverBox, hoverLabel, restoreFab, restorePanel].forEach(n => n && n.remove());
    hoverBox = hoverLabel = restoreFab = restorePanel = restoreList = null;
  }

  /* ---------------- Watcher persistente (independiente del switch) ---------------- */
  // Reaplica lo guardado apenas hay DOM disponible, y sigue vigilando por si
  // el sitio carga contenido de forma diferida (SPA, lazy load, etc.).

  function startPersistentWatcher() {
    applyPersisted();
    try {
      const obs = new MutationObserver(scheduleApplyPersisted);
      obs.observe(document.documentElement, { childList: true, subtree: true });
    } catch {}
    setInterval(applyPersisted, 2500);
  }

  if (document.documentElement) {
    startPersistentWatcher();
  } else {
    const iv = setInterval(() => {
      if (document.documentElement) {
        clearInterval(iv);
        startPersistentWatcher();
      }
    }, 20);
  }

  /* ---------------- Registro del módulo ---------------- */

  window.__MML_QUEUE.push({
    name: "elementHider",
    mod: {
      title: "🧹 Seleccionar y ocultar",
      desc: "Resalta y oculta elementos; se guarda y se restaura",
      category: "General",

      enable() {
        ensureHoverNodes();
        ensureRestoreNodes();
        moduleActive = true;
        // "paused" se mantiene tal como el usuario lo dejó (persistido).
        applyPersisted();
        renderRestoreUI();

        const isOwn = el => !!(el && el.closest && el.closest(OWN_SELECTOR));

        const onMouseMove = e => {
          if (paused) { clearHoverVisual(); return; }
          const el = document.elementFromPoint(e.clientX, e.clientY);
          if (!el || isOwn(el) || el === document.body || el === document.documentElement) {
            clearHoverVisual();
            return;
          }
          currentTarget = el;
          positionHover(el);
        };

        const onScrollOrResize = () => {
          if (!paused && currentTarget) positionHover(currentTarget);
        };

        const onClick = e => {
          if (isOwn(e.target)) return; // dejar que la UI propia funcione normal
          if (paused) return;          // en pausa, navegación normal de la página

          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          const target = currentTarget || e.target;
          hideElement(target);
          clearHoverVisual();
        };

        const onKeyDown = e => {
          if (e.key === "Escape") togglePause();
        };

        document.addEventListener("mousemove", onMouseMove, true);
        document.addEventListener("scroll", onScrollOrResize, true);
        window.addEventListener("resize", onScrollOrResize, true);
        document.addEventListener("click", onClick, true);
        document.addEventListener("keydown", onKeyDown, true);

        this._cleanup = () => {
          document.removeEventListener("mousemove", onMouseMove, true);
          document.removeEventListener("scroll", onScrollOrResize, true);
          window.removeEventListener("resize", onScrollOrResize, true);
          document.removeEventListener("click", onClick, true);
          document.removeEventListener("keydown", onKeyDown, true);
          clearHoverVisual();
          moduleActive = false;
          renderRestoreUI();
        };
      },

      disable() {
        this._cleanup?.();

        // Al apagar el módulo: se restaura todo lo oculto (y se olvida lo
        // guardado de esta página) y se retira la GUI del DOM por completo.
        restoreAll();
        removeGuiNodes();
      }
    }
  });
})();
