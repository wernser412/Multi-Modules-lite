// ==UserScript==
// @name         ⚙ Multi Modules Lite
// @namespace    http://tampermonkey.net/
// @version      2026.07.14
// @description  Framework modular + Ultra Unlock + Tooltip + módulos completos (cargados desde archivos separados)
// @author       wernser412
// @icon         https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/ICONO.png
// @match        *://*/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand

// 👇 Un @require por módulo. Reemplazá TU_USUARIO/TU_REPO si aplica.
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/ultraUnlock.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/imageTooltip.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/linkSelect.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/iframeUnlock.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/ytSpeedButton.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/ytVolumeBoost.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/ytToggleComments.js
// ==/UserScript==

(function () {
"use strict";

/********************************************************
 CORE
********************************************************/

const Core = {
  settings: GM_getValue("modules_lite_pro", {}) || {},
  modules: {}
};

const FAB_VISIBLE_KEY = "mml_fab_visible";

function save() {
  GM_setValue("modules_lite_pro", Core.settings);
}

function register(name, mod) {
  Core.modules[name] = {
    name,
    category: "General",
    enabled: false,
    ...mod
  };
}

// Procesa todo lo que los archivos @require dejaron en la cola global.
(window.__MML_QUEUE || []).forEach(({ name, mod }) => register(name, mod));

function toggle(name, on) {
  const m = Core.modules[name];
  if (!m) return;
  Core.settings[name] = on;
  save();
  if (on) {
    try {
      m.enable?.();
      m.enabled = true;
    } catch (e) {
      console.error("Enable error:", name, e);
    }
  } else {
    try {
      m.disable?.();
    } catch {}
    m.enabled = false;
  }
  updateBadge();
}

/********************************************************
 UI
********************************************************/

let fab, panel, badge;

const THEME = `
  #mml-fab {
    position:fixed; right:20px; bottom:20px; width:44px; height:44px;
    border:none; border-radius:50%;
    background:linear-gradient(140deg,#60a5fa,#2563eb 60%,#1e3a8a);
    color:white; font-size:18px; font-weight:bold; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    z-index:999999;
    box-shadow:0 6px 18px rgba(37,99,235,.4), 0 0 0 1px rgba(255,255,255,.08) inset;
    transition:transform .2s ease, box-shadow .2s ease; user-select:none;
  }
  #mml-fab:hover { box-shadow:0 10px 30px rgba(37,99,235,.6), 0 0 0 1px rgba(255,255,255,.08) inset; }
  #mml-fab:active { transform:scale(.94); }

  #mml-badge {
    position:absolute; top:-4px; right:-4px; min-width:18px; height:18px;
    padding:0 4px; border-radius:9px; background:#111; color:#60a5fa;
    font-size:11px; font-weight:700; display:flex; align-items:center;
    justify-content:center; border:2px solid #1e3a8a;
  }

  #mml-panel {
    position:fixed; right:20px; bottom:76px; width:300px; max-height:70vh;
    background:#14161a; color:#eee; border-radius:14px; padding:0;
    display:none; flex-direction:column; overflow:hidden; z-index:2147483647;
    font-family:-apple-system,Segoe UI,Arial,sans-serif; font-size:13px;
    box-shadow:0 12px 36px rgba(0,0,0,.5); border:1px solid rgba(255,255,255,.06);
    opacity:0; transform:translateY(8px) scale(.98);
    transition:opacity .16s ease, transform .16s ease;
  }
  #mml-panel.open { display:flex; opacity:1; transform:translateY(0) scale(1); }

  #mml-panel .mml-head {
    display:flex; align-items:center; justify-content:space-between; padding:12px 14px;
    background:linear-gradient(180deg,rgba(0,255,153,.1),transparent);
    border-bottom:1px solid rgba(255,255,255,.06);
  }
  #mml-panel .mml-head b { font-size:14px; letter-spacing:.2px; }
  #mml-panel .mml-headbtns { display:flex; gap:6px; }
  #mml-panel .mml-headbtn {
    background:rgba(255,255,255,.06); border:none; color:#ccc; font-size:11px;
    padding:4px 8px; border-radius:7px; cursor:pointer;
  }
  #mml-panel .mml-headbtn:hover { background:rgba(255,255,255,.12); color:#fff; }

  #mml-panel .mml-body { overflow-y:auto; padding:8px 10px 12px; }
  #mml-panel .mml-cat {
    font-size:10px; text-transform:uppercase; letter-spacing:.08em;
    color:#8a8f98; margin:10px 4px 6px;
  }

  .mml-row {
    display:flex; justify-content:space-between; align-items:center; gap:8px;
    padding:9px 10px; margin:4px 0; background:#1d2025; border-radius:10px;
    transition:background .12s ease;
  }
  .mml-row:hover { background:#23262c; }
  .mml-row .mml-label { display:flex; flex-direction:column; min-width:0; }
  .mml-row .mml-title { font-size:12.5px; color:#eee; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .mml-row .mml-desc { font-size:10.5px; color:#8a8f98; margin-top:1px; }

  .mml-switch { position:relative; width:36px; height:20px; flex:none; }
  .mml-switch input { opacity:0; width:0; height:0; }
  .mml-slider { position:absolute; inset:0; cursor:pointer; background:#3a3d44; border-radius:999px; transition:background .15s ease; }
  .mml-slider::before { content:""; position:absolute; left:2px; top:2px; width:16px; height:16px; border-radius:50%; background:#fff; transition:transform .15s ease; }
  .mml-switch input:checked + .mml-slider { background:#00c48c; }
  .mml-switch input:checked + .mml-slider::before { transform:translateX(16px); }

  #mml-panel .mml-foot { padding:6px 12px 10px; font-size:10px; color:#666; text-align:center; border-top:1px solid rgba(255,255,255,.05); }
`;

function updateBadge() {
  if (!badge) return;
  const count = Object.values(Core.modules).filter(m => m.enabled).length;
  badge.textContent = count;
  badge.style.display = count > 0 ? "flex" : "none";
}

function applyFabVisibility() {
  if (!fab) return;
  const visible = GM_getValue(FAB_VISIBLE_KEY, true);
  fab.style.display = visible ? "flex" : "none";
  if (!visible) panel.classList.remove("open");
}

function toggleFabVisibility() {
  const visible = GM_getValue(FAB_VISIBLE_KEY, true);
  GM_setValue(FAB_VISIBLE_KEY, !visible);
  applyFabVisibility();
}

function createUI() {

  GM_addStyle(THEME);

  fab = document.createElement("div");
  fab.id = "mml-fab";
  fab.textContent = "⚙";

  badge = document.createElement("div");
  badge.id = "mml-badge";
  badge.style.display = "none";
  fab.appendChild(badge);

  panel = document.createElement("div");
  panel.id = "mml-panel";

  const head = document.createElement("div");
  head.className = "mml-head";

  const title = document.createElement("b");
  title.textContent = "⚙ Multi Modules";

  const headBtns = document.createElement("div");
  headBtns.className = "mml-headbtns";

  const btnAll = document.createElement("button");
  btnAll.className = "mml-headbtn";
  btnAll.textContent = "Activar todo";
  btnAll.onclick = () => {
    Object.keys(Core.modules).forEach(name => toggle(name, true));
    render();
  };

  const btnNone = document.createElement("button");
  btnNone.className = "mml-headbtn";
  btnNone.textContent = "Desactivar";
  btnNone.onclick = () => {
    Object.keys(Core.modules).forEach(name => toggle(name, false));
    render();
  };

  headBtns.append(btnAll, btnNone);
  head.append(title, headBtns);

  const body = document.createElement("div");
  body.className = "mml-body";

  const foot = document.createElement("div");
  foot.className = "mml-foot";
  foot.textContent = "Multi Modules Lite";

  panel.append(head, body, foot);

  document.documentElement.append(fab, panel);

  fab.onclick = () => {
    const opening = !panel.classList.contains("open");
    panel.classList.toggle("open", opening);
    if (opening) render();
  };

  updateBadge();
  applyFabVisibility();
}

function render() {
  if (!panel) return;
  const body = panel.querySelector(".mml-body");
  while (body.firstChild) body.removeChild(body.firstChild);

  const byCategory = {};
  Object.values(Core.modules).forEach(m => {
    (byCategory[m.category] ||= []).push(m);
  });

  Object.entries(byCategory).forEach(([cat, mods]) => {
    const catLabel = document.createElement("div");
    catLabel.className = "mml-cat";
    catLabel.textContent = cat;
    body.appendChild(catLabel);

    mods.forEach(m => {
      const row = document.createElement("div");
      row.className = "mml-row";

      const label = document.createElement("div");
      label.className = "mml-label";

      const titleEl = document.createElement("div");
      titleEl.className = "mml-title";
      titleEl.textContent = m.title || m.name;
      label.appendChild(titleEl);

      if (m.desc) {
        const descEl = document.createElement("div");
        descEl.className = "mml-desc";
        descEl.textContent = m.desc;
        label.appendChild(descEl);
      }

      const sw = document.createElement("label");
      sw.className = "mml-switch";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!Core.settings[m.name];
      cb.onchange = () => toggle(m.name, cb.checked);

      const slider = document.createElement("span");
      slider.className = "mml-slider";

      sw.append(cb, slider);
      row.append(label, sw);
      body.appendChild(row);
    });
  });
}

/********************************************************
 BOOT
********************************************************/

const wait = setInterval(() => {

  if (!document.documentElement) return;

  clearInterval(wait);
  createUI();

  setTimeout(() => {
    Object.keys(Core.modules).forEach(name => {
      if (Core.settings[name] === true) toggle(name, true);
    });
  }, 0);

}, 50);

GM_registerMenuCommand("⚙ Mostrar/Ocultar botón flotante", toggleFabVisibility);

})();
