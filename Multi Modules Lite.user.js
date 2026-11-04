// ==UserScript==
// @name         ⚙ Multi Modules Lite
// @namespace    http://tampermonkey.net/
// @version      2026.11.06
// @description  Framework modular + Ultra Unlock + Tooltip + módulos completos (cargados desde archivos separados)
// @author       wernser412
// @icon         https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/ICONO.png
// @match        *://*/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand

// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/ultraUnlock.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/imageTooltip.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/linkSelect.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/iframeUnlock.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/ytSpeedButton.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/ytVolumeBoost.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/ytAudioSync.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/ytToggleComments.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/imageHoverZoom.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/plainCopy.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/showPasswords.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/mathSelectSolve.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/googleSelectSearch.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/translateSelect.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/elementHider.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/forceLazyLoadImages.js
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Modules/colorPicker.js
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

/********************************************************
 SITIOS POR MÓDULO
 Cada módulo tiene un interruptor "Todos los sitios". Si está apagado,
 debe tener al menos un sitio en su lista. Ejemplos de patrones:
   youtube.com          -> youtube.com y subdominios (www., m., ...)
   *.google.com         -> cualquier subdominio de google.com
   reddit.com/r/*       -> solo URLs que empiecen así (host + ruta)
   !mail.google.com     -> EXCLUIR este sitio (aunque otro patrón coincida)
********************************************************/
// Formato guardado por módulo: { all: true/false, list: ["youtube.com", ...] }
//   all = true  -> funciona en TODOS los sitios (la lista se ignora)
//   all = false -> funciona SOLO en los sitios de la lista (mínimo 1)
function normalizeCfg(v) {
  if (Array.isArray(v)) {                       // formato viejo: lista simple
    const list = v.map(String).filter(Boolean);
    return { all: !list.some(x => !x.startsWith("!")), list };
  }
  if (v && typeof v === "object") {
    const list = Array.isArray(v.list) ? v.list.map(String).filter(Boolean) : [];
    const hasSite = list.some(x => !x.trim().startsWith("!"));
    return { all: v.all === true || !hasSite, list };
  }
  return null;
}

Core.sites = {};
Object.entries(GM_getValue("modules_lite_sites", {}) || {}).forEach(([k, v]) => {
  const c = normalizeCfg(v);
  if (c) Core.sites[k] = c;
});

function saveSites() {
  GM_setValue("modules_lite_sites", Core.sites);
}

function getCfg(name) {
  if (Core.sites[name]) return Core.sites[name];
  // Sitios por defecto: los de la propiedad `sites` del módulo, y si no tiene,
  // los módulos de categoría "YouTube" quedan fijados a youtube.com.
  const m = Core.modules[name];
  const def = normalizeCfg(m?.sites) ||
    (m?.category === "YouTube" ? { all: false, list: ["youtube.com"] } : null);
  return def || { all: true, list: [] };
}

function hasSite(list) {
  return list.some(x => !x.trim().startsWith("!"));
}

function globToRegex(glob) {
  const esc = glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp("^" + esc + "$");
}

function patternMatches(pattern) {
  const p = pattern.trim().toLowerCase().replace(/^https?:\/\//, "");
  if (!p) return false;
  const host = location.hostname.toLowerCase();
  if (p.includes("/")) {
    const target = host + location.pathname.toLowerCase();
    const re = globToRegex(p.endsWith("*") ? p : p + "*");
    // acepta también subdominios (www.reddit.com para "reddit.com/r/*")
    return re.test(target) || (!p.startsWith("*") && globToRegex("*." + (p.endsWith("*") ? p : p + "*")).test(target));
  }
  if (p.includes("*")) return globToRegex(p).test(host);
  return host === p || host.endsWith("." + p);
}

function siteAllowed(name) {
  const cfg = getCfg(name);
  if (cfg.all) return true;
  const excludes = cfg.list.filter(x => x.trim().startsWith("!")).map(x => x.trim().slice(1));
  const includes = cfg.list.filter(x => !x.trim().startsWith("!"));
  if (excludes.some(patternMatches)) return false;
  return includes.some(patternMatches);
}

function parseSites(text) {
  return text.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
}

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

// Enciende/apaga el módulo según: interruptor global + sitio actual permitido.
function apply(name) {
  const m = Core.modules[name];
  if (!m) return;
  const shouldRun = Core.settings[name] === true && siteAllowed(name);
  if (shouldRun && !m.enabled) {
    try {
      m.enable?.();
      m.enabled = true;
    } catch (e) {
      console.error("Enable error:", name, e);
    }
  } else if (!shouldRun && m.enabled) {
    try {
      m.disable?.();
    } catch {}
    m.enabled = false;
  }
}

function toggle(name, on) {
  const m = Core.modules[name];
  if (!m) return;
  Core.settings[name] = on;
  save();
  apply(name);
  updateBadge();
}

/********************************************************
 UI
********************************************************/

let fab, panel, badge, fabObserver, watchdogTimer;
const STYLE_ID = "mml-theme-style";

// Estado de visibilidad mantenido en memoria. Se lee de storage UNA sola
// vez al arrancar, y luego solo se modifica cuando el usuario hace click
// en el comando del menú. Esto evita que el watchdog/observer "revivan"
// el botón por leer un valor stale del storage en cada chequeo.
let fabVisibleState = GM_getValue(FAB_VISIBLE_KEY, true);

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
  #mml-panel .mml-head { flex-wrap:wrap; gap:8px; }
  #mml-panel .mml-headbtns { display:flex; gap:6px; flex-wrap:wrap; }
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

  .mml-item.mml-off .mml-row { opacity:.45; }
  .mml-sitebtn {
    background:none; border:none; cursor:pointer; font-size:13px; padding:2px 4px;
    border-radius:6px; opacity:.45; flex:none;
  }
  .mml-sitebtn:hover { opacity:1; background:rgba(255,255,255,.08); }
  .mml-sitebtn.on { opacity:1; }
  .mml-rowright { display:flex; align-items:center; gap:4px; flex:none; }
  .mml-sites {
    display:none; margin:-2px 0 6px; padding:8px 10px; background:#181b20;
    border-radius:0 0 10px 10px; border:1px solid rgba(255,255,255,.05);
  }
  .mml-sites.open { display:block; }
  .mml-allrow { display:flex; align-items:center; justify-content:space-between; font-size:12px; color:#eee; margin-bottom:6px; }
  .mml-sites .mml-hint { font-size:10.5px; color:#8a8f98; margin-bottom:6px; line-height:1.35; }
  .mml-sites input[type=text] {
    width:100%; box-sizing:border-box; background:#0f1114; color:#eee;
    border:1px solid #3a3d44; border-radius:7px; padding:6px 8px; font-size:12px; outline:none;
  }
  .mml-sites input[type=text]:focus { border-color:#60a5fa; }
  .mml-sites .mml-sitebtns { display:flex; gap:6px; margin-top:6px; }
  .mml-sites .mml-sitebtns button {
    background:rgba(255,255,255,.08); border:none; color:#ddd; font-size:11px;
    padding:4px 8px; border-radius:7px; cursor:pointer;
  }
  .mml-sites .mml-sitebtns button:hover { background:rgba(255,255,255,.16); }

  #mml-panel .mml-foot { padding:6px 12px 10px; font-size:10px; color:#666; text-align:center; border-top:1px solid rgba(255,255,255,.05); }
`;

/**
 * Inyecta el CSS manualmente (en vez de confiar solo en GM_addStyle)
 * usando un <style id="mml-theme-style"> propio, para poder detectar
 * si YouTube lo elimina (p. ej. al reescribir <head> en navegación SPA)
 * y reinyectarlo.
 */
function ensureStyleInjected() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = THEME;
  (document.head || document.documentElement).appendChild(style);
}

/**
 * Maneja el problema de la Fullscreen API nativa: cuando un elemento
 * entra en fullscreen (p. ej. el <video> de YouTube), el navegador lo
 * renderiza en una capa especial ("top layer") por encima de TODO lo
 * demás, sin importar z-index. Un elemento position:fixed fuera de ese
 * elemento queda tapado aunque siga existiendo en el DOM.
 * Solución: si hay un elemento en fullscreen, movemos el fab/panel
 * dentro de él; al salir, los devolvemos a documentElement.
 */
function handleFullscreenChange() {
  if (!fab || !panel) return;
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  const target = fsEl || document.documentElement;
  if (fab.parentNode !== target) target.appendChild(fab);
  if (panel.parentNode !== target) target.appendChild(panel);
}

function updateBadge() {
  if (!badge) return;
  const count = Object.values(Core.modules).filter(m => m.enabled).length; // solo los que corren en ESTE sitio
  badge.textContent = count;
  badge.style.display = count > 0 ? "flex" : "none";
}

/**
 * Garantiza que exista UN SOLO #mml-fab y #mml-panel en el DOM,
 * y que las referencias `fab` / `panel` apunten a los nodos reales
 * y conectados. Esto corrige el bug de YouTube: al navegar (SPA/Polymer)
 * el nodo puede quedar desconectado del árbol, o el script puede
 * inyectarse más de una vez, dejando nodos duplicados "fantasma".
 */
function ensureFabAttached() {
  // 0) Asegurar que el CSS siga existiendo (YouTube puede vaciar <head>).
  ensureStyleInjected();

  // 1) Eliminar duplicados si los hay, quedándonos con el primero.
  const fabDupes = document.querySelectorAll("#mml-fab");
  if (fabDupes.length > 1) {
    fabDupes.forEach((n, i) => { if (i > 0) n.remove(); });
  }
  const panelDupes = document.querySelectorAll("#mml-panel");
  if (panelDupes.length > 1) {
    panelDupes.forEach((n, i) => { if (i > 0) n.remove(); });
  }

  // 2) Resincronizar referencias con lo que realmente hay en el DOM.
  const realFab = document.getElementById("mml-fab");
  const realPanel = document.getElementById("mml-panel");
  if (realFab) fab = realFab;
  if (realPanel) panel = realPanel;

  // 3) Si nuestra referencia quedó desconectada del documento, reinsertarla
  //    respetando si hay un elemento en fullscreen (top layer).
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  const target = fsEl || document.documentElement;
  if (fab && !document.documentElement.contains(fab)) {
    target.appendChild(fab);
  }
  if (panel && !document.documentElement.contains(panel)) {
    target.appendChild(panel);
  }

  // 4) Corregir ubicación respecto al fullscreen si cambió mientras tanto.
  handleFullscreenChange();
}

function applyFabVisibility() {
  if (!fab) return;
  ensureFabAttached();
  fab.style.display = fabVisibleState ? "flex" : "none";
  if (!fabVisibleState) panel.classList.remove("open");
}

function toggleFabVisibility() {
  fabVisibleState = !fabVisibleState;
  GM_setValue(FAB_VISIBLE_KEY, fabVisibleState);
  applyFabVisibility();
}

/********************************************************
 EXPORTAR / IMPORTAR (JSON)
********************************************************/

function exportConfig() {
  const data = {
    app: "Multi Modules Lite",
    version: 1,
    exported: new Date().toISOString(),
    settings: Core.settings, // { nombreModulo: true/false }
    sites: Core.sites        // { nombreModulo: { all: true/false, list: ["youtube.com", ...] } }
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "multi-modules-lite-config.json";
  document.documentElement.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function resetConfig() {
  if (!confirm("¿Restaurar la configuración de fábrica?\n\n" +
    "• Todos los módulos quedarán desactivados.\n" +
    "• Los sitios volverán a los de por defecto (YouTube solo en youtube.com, el resto en todos los sitios).\n\n" +
    "Tip: usa ⬇ Exportar antes si quieres guardar tu configuración actual.")) return;
  Core.settings = {};
  Core.sites = {};
  save();
  saveSites();
  openEditors.clear();
  Object.keys(Core.modules).forEach(apply);
  updateBadge();
  render();
}

function importConfig() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== "object" || typeof data.settings !== "object") {
          throw new Error("formato inválido");
        }
        const settings = {};
        Object.entries(data.settings || {}).forEach(([k, v]) => { settings[k] = v === true; });
        const sites = {};
        Object.entries(data.sites || {}).forEach(([k, v]) => {
          const c = normalizeCfg(v);
          if (c) sites[k] = c;
        });
        Core.settings = settings;
        Core.sites = sites;
        save();
        saveSites();
        Object.keys(Core.modules).forEach(apply);
        updateBadge();
        render();
        alert("Configuración importada correctamente.");
      } catch (e) {
        alert("No se pudo importar: el archivo no es un JSON válido de Multi Modules Lite.");
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function createUI() {
  // Evita crear una segunda UI si el script ya corrió en este documento
  // (p. ej. por doble inyección) — simplemente resincroniza y sale.
  if (document.getElementById("mml-fab")) {
    ensureFabAttached();
    updateBadge();
    applyFabVisibility();
    return;
  }

  ensureStyleInjected();

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

  const btnExport = document.createElement("button");
  btnExport.className = "mml-headbtn";
  btnExport.textContent = "⬇ Exportar";
  btnExport.title = "Guardar módulos activados y sitios en un archivo JSON";
  btnExport.onclick = exportConfig;

  const btnImport = document.createElement("button");
  btnImport.className = "mml-headbtn";
  btnImport.textContent = "⬆ Importar";
  btnImport.title = "Cargar un archivo JSON exportado antes";
  btnImport.onclick = importConfig;

  const btnReset = document.createElement("button");
  btnReset.className = "mml-headbtn";
  btnReset.textContent = "↺ Restaurar";
  btnReset.title = "Deja todo como viene de fábrica: módulos desactivados y sitios por defecto";
  btnReset.onclick = resetConfig;

  headBtns.append(btnAll, btnNone, btnExport, btnImport, btnReset);
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
  observeFab();
}

/**
 * Vigila el DOM y, si el FAB o el panel se desconectan
 * (por ejemplo, YouTube reemplazando nodos al navegar entre videos
 * o al entrar/salir de fullscreen), los vuelve a insertar automáticamente.
 */
function observeFab() {
  if (fabObserver) fabObserver.disconnect();
  fabObserver = new MutationObserver(() => {
    if (!fab || !document.documentElement.contains(fab) ||
        !panel || !document.documentElement.contains(panel) ||
        !document.getElementById(STYLE_ID)) {
      applyFabVisibility();
    }
  });
  fabObserver.observe(document.documentElement, { childList: true, subtree: false });
  fabObserver.observe(document.head || document.documentElement, { childList: true, subtree: false });

  // Escuchar entradas/salidas de fullscreen nativo (YouTube, players embebidos, etc.)
  ["fullscreenchange", "webkitfullscreenchange"].forEach(ev => {
    document.addEventListener(ev, handleFullscreenChange, true);
  });

  // Respaldo por si el MutationObserver no llega a disparar en algún
  // escenario particular de YouTube (SPA navigation, view-transitions, etc.)
  if (watchdogTimer) clearInterval(watchdogTimer);
  watchdogTimer = setInterval(() => {
    ensureFabAttached();
    if (fab) fab.style.display = fabVisibleState ? "flex" : "none";
  }, 1500);
}

const openEditors = new Set(); // editores 🌐 abiertos (se conservan al redibujar)

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
      const item = document.createElement("div");
      item.className = "mml-item";

      const row = document.createElement("div");
      row.className = "mml-row";

      const label = document.createElement("div");
      label.className = "mml-label";

      const titleEl = document.createElement("div");
      titleEl.className = "mml-title";
      titleEl.textContent = m.title || m.name;
      label.appendChild(titleEl);

      const cfg = getCfg(m.name);
      const sites = cfg.all ? [] : cfg.list;
      const allowedHere = siteAllowed(m.name);

      const descEl = document.createElement("div");
      descEl.className = "mml-desc";
      if (sites.length) {
        descEl.textContent = (allowedHere ? "🌐 " : "🚫 No activo aquí · 🌐 ") + sites.join(", ");
      } else {
        descEl.textContent = m.desc || "";
      }
      if (descEl.textContent) label.appendChild(descEl);

      item.classList.toggle("mml-off", !allowedHere);

      // Botón 🌐 + interruptor
      const right = document.createElement("div");
      right.className = "mml-rowright";

      const siteBtn = document.createElement("button");
      siteBtn.className = "mml-sitebtn" + (!cfg.all ? " on" : "");
      siteBtn.textContent = "🌐";
      siteBtn.title = "Elegir en qué sitios funciona este módulo";

      const sw = document.createElement("label");
      sw.className = "mml-switch";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!Core.settings[m.name];
      cb.onchange = () => toggle(m.name, cb.checked);

      const slider = document.createElement("span");
      slider.className = "mml-slider";

      sw.append(cb, slider);
      right.append(siteBtn, sw);
      row.append(label, right);

      // Editor de sitios (desplegable)
      const editor = document.createElement("div");
      editor.className = "mml-sites" + (openEditors.has(m.name) ? " open" : "");

      const commit = () => {
        saveSites();
        apply(m.name);
        updateBadge();
        render();
      };

      // Interruptor "Todos los sitios"
      const allRow = document.createElement("div");
      allRow.className = "mml-allrow";
      const allLabel = document.createElement("span");
      allLabel.textContent = "🌐 Todos los sitios";
      const allSw = document.createElement("label");
      allSw.className = "mml-switch";
      const allCb = document.createElement("input");
      allCb.type = "checkbox";
      allCb.checked = cfg.all;
      const allSlider = document.createElement("span");
      allSlider.className = "mml-slider";
      allSw.append(allCb, allSlider);
      allRow.append(allLabel, allSw);

      const siteBox = document.createElement("div");
      siteBox.style.display = cfg.all ? "none" : "block";

      const hint = document.createElement("div");
      hint.className = "mml-hint";
      hint.textContent = "Solo funcionará en estos sitios (separados por coma, mínimo uno). " +
        "Ej: youtube.com, *.google.com, reddit.com/r/*. Con ! se excluye: !music.youtube.com";

      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "youtube.com";
      input.value = cfg.list.join(", ");

      const btns = document.createElement("div");
      btns.className = "mml-sitebtns";

      const bThis = document.createElement("button");
      bThis.textContent = "＋ Este sitio";
      bThis.onclick = () => {
        const list = parseSites(input.value);
        const host = location.hostname.replace(/^www\./, "");
        if (!list.includes(host)) list.push(host);
        input.value = list.join(", ");
      };

      const bSave = document.createElement("button");
      bSave.textContent = "Guardar";
      bSave.onclick = () => {
        const list = parseSites(input.value);
        if (!hasSite(list)) {
          alert("Agrega al menos un sitio, o activa \"Todos los sitios\".");
          return;
        }
        Core.sites[m.name] = { all: false, list };
        commit();
      };

      allCb.onchange = () => {
        if (allCb.checked) {
          Core.sites[m.name] = { all: true, list: parseSites(input.value) };
        } else {
          // Al apagar "Todos", siempre debe quedar al menos un sitio activo:
          // si no hay ninguno, se pone el sitio actual.
          const list = parseSites(input.value);
          if (!hasSite(list)) list.push(location.hostname.replace(/^www\./, ""));
          Core.sites[m.name] = { all: false, list };
        }
        openEditors.add(m.name);
        commit();
      };

      input.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") bSave.click();
      });

      btns.append(bThis, bSave);
      siteBox.append(hint, input, btns);
      editor.append(allRow, siteBox);

      siteBtn.onclick = () => {
        editor.classList.toggle("open");
        if (editor.classList.contains("open")) openEditors.add(m.name);
        else openEditors.delete(m.name);
      };

      item.append(row, editor);
      body.appendChild(item);
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
      apply(name); // respeta interruptor + lista de sitios
    });
    updateBadge();
  }, 0);

}, 50);

GM_registerMenuCommand("⚙ Mostrar/Ocultar botón flotante", toggleFabVisibility);

})();
