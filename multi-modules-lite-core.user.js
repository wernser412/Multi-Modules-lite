// ==UserScript==
// @name         ⚙ Multi Modules Lite
// @namespace    http://tampermonkey.net/
// @version      2026.07.13
// @description  Framework modular con módulos externos vía @require
// @match        *://*/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue

// 👇 Un @require por cada módulo alojado en GitHub.
//    Usa raw.githubusercontent.com (o jsDelivr, ver nota abajo).
// @require      https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/iframeUnlock.js

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

// 👇 Aquí "drenamos" todo lo que los archivos @require dejaron en la cola.
//    Esto tiene que correr ANTES de crear la UI.
(window.__MML_QUEUE || []).forEach(({ name, mod }) => register(name, mod));

function toggle(name, on) {
  const m = Core.modules[name];
  if (!m) return;
  Core.settings[name] = on;
  save();
  if (on) {
    try { m.enable?.(); m.enabled = true; }
    catch (e) { console.error("Enable error:", name, e); }
  } else {
    try { m.disable?.(); } catch {}
    m.enabled = false;
  }
}

// ... resto del código (createUI, render, boot) queda exactamente igual
// que en la versión anterior, solo que Core.modules ahora se llena
// desde archivos externos en vez de tenerlos todos en el mismo archivo.

})();
