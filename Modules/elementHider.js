// elementHider.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  // Estado compartido a nivel de módulo (sobrevive a enable()/disable(),
  // así el panel de restaurar sigue disponible aunque el toggle esté apagado).
  let hiddenItems = [];
  let hoverBox, hoverLabel, restorePanel, restoreList, restoreCount, restoreFab;
  let stylesInjected = false;

  const OWN_SELECTOR = "#mml-hider-box, #mml-hider-label, #mml-hider-panel, #mml-hider-fab, #mml-fab, #mml-panel";

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
        border-radius: 999px; padding: 8px 14px; font: 600 12px -apple-system,Segoe UI,Arial,sans-serif;
        cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,.4); display: none;
        align-items: center; gap: 6px; user-select: none;
      }
      #mml-hider-fab span.mml-hider-dot {
        background: #ff4d6d; color: #fff; border-radius: 999px; min-width: 16px; height: 16px;
        font-size: 10px; display: flex; align-items: center; justify-content: center; padding: 0 4px;
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
      [data-mml-hidden] { }
    `);
  }

  // Construye una descripción legible y sin bugs de "##" para el elemento.
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

  function ensureRestoreNodes() {
    injectStyles();

    if (!restoreFab) {
      restoreFab = document.createElement("div");
      restoreFab.id = "mml-hider-fab";
      restoreFab.innerHTML = `🧹 Ocultos <span class="mml-hider-dot">0</span>`;
      restoreFab.onclick = () => {
        restorePanel.classList.toggle("open");
      };
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

      restoreList = document.createElement("div");
      restoreList.className = "mml-hp-list";

      restorePanel.append(head, restoreList);
      document.documentElement.appendChild(restorePanel);
    }
  }

  function renderRestoreUI() {
    ensureRestoreNodes();

    const count = hiddenItems.length;
    restoreFab.style.display = count > 0 ? "flex" : "none";
    restoreFab.querySelector(".mml-hider-dot").textContent = count;
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

  function hideElement(el) {
    if (!el || el === document.body || el === document.documentElement) return;
    if (el.closest && el.closest(OWN_SELECTOR)) return;
    if (hiddenItems.some(it => it.el === el)) return;

    const originalDisplay = el.style.display || "";
    const originalPriority = el.style.getPropertyPriority("display");

    el.setAttribute("data-mml-hidden", "1");
    el.style.setProperty("display", "none", "important");

    hiddenItems.push({
      el,
      label: describeElement(el),
      originalDisplay,
      originalPriority
    });

    renderRestoreUI();
  }

  function restoreElement(item) {
    const idx = hiddenItems.indexOf(item);
    if (idx === -1) return;

    const { el, originalDisplay, originalPriority } = item;
    if (el && el.isConnected) {
      if (originalDisplay) {
        el.style.setProperty("display", originalDisplay, originalPriority || "");
      } else {
        el.style.removeProperty("display");
      }
      el.removeAttribute("data-mml-hidden");
    }

    hiddenItems.splice(idx, 1);
    renderRestoreUI();
  }

  function restoreAll() {
    [...hiddenItems].forEach(restoreElement);
  }

  window.__MML_QUEUE.push({
    name: "elementHider",
    mod: {
      title: "🧹 Seleccionar y ocultar",
      desc: "Resalta y oculta elementos, con panel para restaurar",
      category: "General",

      enable() {
        ensureHoverNodes();
        ensureRestoreNodes();
        renderRestoreUI();

        let currentTarget = null;

        const isOwn = el => !!(el && el.closest && el.closest(OWN_SELECTOR));

        const positionHover = el => {
          const r = el.getBoundingClientRect();
          hoverBox.style.display = "block";
          hoverBox.style.top = r.top + "px";
          hoverBox.style.left = r.left + "px";
          hoverBox.style.width = r.width + "px";
          hoverBox.style.height = r.height + "px";

          hoverLabel.style.display = "block";
          hoverLabel.textContent = describeElement(el);

          // Preferimos mostrar la etiqueta arriba del elemento; si no entra,
          // la mostramos justo debajo.
          const labelH = 24;
          let top = r.top - labelH;
          if (top < 4) top = Math.min(r.bottom + 4, window.innerHeight - labelH);
          let left = Math.max(4, Math.min(r.left, window.innerWidth - 260));
          hoverLabel.style.top = top + "px";
          hoverLabel.style.left = left + "px";
        };

        const clearHover = () => {
          currentTarget = null;
          if (hoverBox) hoverBox.style.display = "none";
          if (hoverLabel) hoverLabel.style.display = "none";
        };

        const onMouseMove = e => {
          const el = document.elementFromPoint(e.clientX, e.clientY);
          if (!el || isOwn(el) || el === document.body || el === document.documentElement) {
            clearHover();
            return;
          }
          if (el === currentTarget) {
            positionHover(el); // por si hubo scroll/reflow
            return;
          }
          currentTarget = el;
          positionHover(el);
        };

        const onScrollOrResize = () => {
          if (currentTarget) positionHover(currentTarget);
        };

        const onClick = e => {
          const el = e.target;
          if (isOwn(el)) return; // dejar que la UI propia funcione normal

          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          const target = currentTarget || el;
          hideElement(target);
          clearHover();
        };

        document.addEventListener("mousemove", onMouseMove, true);
        document.addEventListener("scroll", onScrollOrResize, true);
        window.addEventListener("resize", onScrollOrResize, true);
        document.addEventListener("click", onClick, true);

        this._cleanup = () => {
          document.removeEventListener("mousemove", onMouseMove, true);
          document.removeEventListener("scroll", onScrollOrResize, true);
          window.removeEventListener("resize", onScrollOrResize, true);
          document.removeEventListener("click", onClick, true);
          clearHover();
        };
      },

      disable() {
        this._cleanup?.();
        // El panel de restaurar y los elementos ya ocultos se mantienen
        // disponibles aunque el modo de selección se apague, para que
        // el usuario siempre pueda deshacer lo que ocultó.
      }
    }
  });
})();
