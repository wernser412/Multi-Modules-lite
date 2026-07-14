// ==UserScript==
// @name         ⚙ Multi Modules Lite
// @namespace    http://tampermonkey.net/
// @version      2026.07.07
// @description  Framework modular + Ultra Unlock + Tooltip + módulos completos
// @author       wernser412
// @icon         https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/ICONO.png
// @downloadURL  https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Multi%20Modules%20Lite.user.js
// @match        *://*/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
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
    enabled: false,
    ...mod
  };
}

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
}

/********************************************************
 UI
********************************************************/

let panel;

function createUI() {

  const fab = document.createElement("div");
  panel = document.createElement("div");

  fab.textContent = "⚙";

  fab.style.cssText = `
    position:fixed;
    right:18px;
    bottom:18px;
    width:56px;
    height:56px;
    background:#00ff99;
    color:#000;
    border-radius:50%;
    display:flex;
    align-items:center;
    justify-content:center;
    cursor:pointer;
    font-size:24px;
    z-index:2147483647;
  `;

  panel.style.cssText = `
    position:fixed;
    right:18px;
    bottom:85px;
    width:320px;
    max-height:420px;
    overflow:auto;
    background:#111;
    color:white;
    border-radius:12px;
    padding:10px;
    display:none;
    z-index:2147483647;
    font-family:Arial;
    font-size:13px;
  `;

  document.documentElement.appendChild(fab);
  document.documentElement.appendChild(panel);

  fab.onclick = () => {
    panel.style.display =
      panel.style.display === "block"
        ? "none"
        : "block";

    render();
  };

}

function render() {
  if (!panel) return;
  while (panel.firstChild) {
    panel.removeChild(panel.firstChild);
  }

  Object.entries(Core.modules).forEach(([name]) => {

    const row = document.createElement("div");

    row.style.cssText = `
      display:flex;
      justify-content:space-between;
      align-items:center;
      padding:8px;
      margin:6px 0;
      background:#222;
      border-radius:8px;
    `;

    const label = document.createElement("span");
const m = Core.modules[name];

label.textContent =
  m.title || name;

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!Core.settings[name];

    cb.onchange = () => {
      toggle(name, cb.checked);
    };

    row.appendChild(label);
    row.appendChild(cb);

    panel.appendChild(row);

  });

}

/********************************************************
 BOOT
********************************************************/

const wait = setInterval(() => {

  if (!document.documentElement)
    return;

  clearInterval(wait);
  createUI();

  // IMPORTANTE: esperar microtick para módulos
  setTimeout(() => {
    Object.keys(Core.modules).forEach(name => {
      const state =
        Core.settings[name] === true;
      if (state) {
        toggle(name, true);
      }
    });

  }, 0);

}, 50);

/********************************************************
 MODULES BASE
********************************************************/

register("ultraUnlock", {
  title: "🖼 Desbloquear web",

  enable() {

    // Permite seleccionar texto en cualquier elemento.
GM_addStyle(`
  * {
    user-select: text !important;              /* 📝 Permite seleccionar texto en cualquier elemento de la página. Muchas webs usan "user-select: none" para impedir la selección. */
    -webkit-user-select: text !important;      /* 🌐 Hace lo mismo para Chrome, Edge, Brave, Opera y otros navegadores basados en Chromium/WebKit. */
    -moz-user-select: text !important;         /* 🦊 Compatibilidad con Firefox. */
    -ms-user-select: text !important;          /* 🖥 Compatibilidad con Internet Explorer y Edge Legacy. */
    -webkit-touch-callout: default !important; /* 📱 En Safari para iPhone/iPad vuelve a habilitar el menú al mantener presionado un texto (Copiar, Buscar, Compartir, etc.). */
  }
  input,
  textarea {
  user-select: text !important;         /*  ✏ Permite seleccionar texto dentro de cajas de texto e inputs, incluso si la página intenta bloquearlo. */
  -webkit-user-select: text !important; /* 🌐 Compatibilidad con Chrome, Edge, Brave y Opera para inputs y textareas. */
    }

`);

    const events = [

      "copy",         // 📋 Desbloquea Ctrl+C y la opción "Copiar" del menú contextual.
      "beforecopy",   // 📋 Evita que la página bloquee la copia antes de ejecutarla.
      "cut",          // ✂ Desbloquea Ctrl+X y evita restricciones al cortar.
      "paste",        // 📥 Evita bloqueos al pegar contenido (Ctrl+V).
      "contextmenu",  // 🖱 Desbloquea el menú contextual (clic derecho).
      "selectstart",  // 📝 Permite seleccionar texto libremente.
      "keydown",      // ⌨ Evita bloqueos de atajos como Ctrl+C, Ctrl+A, Ctrl+X, Ctrl+V.
      "keyup",        // ⌨ Complementa la protección de keydown y evita acciones al soltar la tecla.
      "mousedown",    // 🖱 Evita bloqueos al presionar el botón del mouse.
      "mouseup",      // 🖱 Evita bloqueos al soltar el botón del mouse.
      "dragstart",    // 📦 Permite arrastrar texto, enlaces e imágenes.
      "drag",         // 📦 Evita restricciones durante el arrastre.
      "dragend",      // 📦 Finaliza el arrastre sin interferencias.
      "select",       // 🔤 Evita que la página manipule la selección de texto.
      "auxclick",     // 🖱 Desbloquea el clic central y otros botones del mouse.
      "dblclick"      // 🖱 Evita bloqueos asociados al doble clic.

    ];

    events.forEach(ev => {

      document.addEventListener(ev, e => {

        // Detiene cualquier script de la página que intente bloquear esta acción.
        e.stopImmediatePropagation();

      }, true);

    });

    // Elimina bloqueos mediante propiedades del DOM.
    try {

      document.oncopy = null;
      document.oncut = null;
      document.onpaste = null;
      document.oncontextmenu = null;
      document.onselectstart = null;
      document.ondragstart = null;

      window.oncopy = null;
      window.oncut = null;
      window.onpaste = null;
      window.oncontextmenu = null;

    } catch {}

    console.log("✅ UltraUnlock ON");

  }

});

  /************************************************************
   * 🖼 IMAGE TOOLTIP + AUTO COPY
   ************************************************************/


register("imageTooltip", {
  title: "🖼 Image Tooltip Pro",
  desc: "Detecta imágenes y copia URL",

  enable() {

    if (this.active) return;
    this.active = true;

    const tip = document.createElement("div");

      const preview = document.createElement("img");

Object.assign(preview.style, {

    width: "220px",
    maxHeight: "160px",
    objectFit: "contain",
    display: "block",
    borderRadius: "6px",
    marginBottom: "6px"

});

tip.appendChild(preview);

const txt = document.createElement("div");

tip.appendChild(txt);

    Object.assign(tip.style, {

      position: "fixed",
      background: "rgba(0,0,0,0.85)",
      color: "#fff",
      padding: "6px 8px",
      borderRadius: "8px",
      fontSize: "12px",
      zIndex: 2147483646,
      display: "none",
      pointerEvents: "none",
      maxWidth: "60vw",
      wordBreak: "break-all"
    });

    document.documentElement.appendChild(tip);

    let lastUrl = "";
    let timer = null;
    let countdown = 10;
    let copied = false;

    const copyToClipboard = (text) => {

      try {
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(text);
        } else if (typeof GM_setClipboard !== "undefined") {
          GM_setClipboard(text, "text");
        } else {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
      } catch {}
    };



    const getImageUrlFrom = (el, e) => {
      if (!el) return "";

const extract = (node) => {

    while (node) {

        if (node.nodeType !== 1) {
            node = node.parentElement;
            continue;
        }

        const tag = node.tagName.toLowerCase();

        // IMG normal
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

        // SVG <image> (Facebook)
        if (tag === "image") {

            return (
                node.getAttribute("href") ||
                node.getAttribute("xlink:href") ||
                ""
            );

        }

        // Buscar imágenes dentro del nodo
        const child =
    node.querySelector?.("img")
    ||
    node.querySelector?.("image");


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
    (
        cs2.backgroundImage !== "none"
        &&
        cs2.backgroundImage.match(
            /url\(["']?(.*?)["']?\)/
        )?.[1]
    ) ||
    ""
);

        }

        // background-image
        const cs = getComputedStyle(node);

        if (
            cs.backgroundImage &&
            cs.backgroundImage !== "none"
        ) {

            const m = cs.backgroundImage.match(
                /url\(["']?(.*?)["']?\)/
            );

            if (m) return m[1];

        }

        node = node.parentElement;

    }

    return "";

};

      const stack = document.elementsFromPoint(
        e.clientX,
        e.clientY
      ) || [];


for (const node of stack) {

    const url = extract(node);

    if (url) return url;

}

return extract(el);

    };

    const startTimer = (url) => {
      clearInterval(timer);
      countdown = 10;
      copied = false;
      timer = setInterval(() => {
        if (!url || url !== lastUrl) {
          clearInterval(timer);
          return;
        }

        preview.src = url;

txt.textContent =
    `⏱ ${countdown}s`;

countdown--;

if (countdown < 0 && !copied) {

          copied = true;
          clearInterval(timer);
          copyToClipboard(url);
          txt.textContent = "✅ COPIADO";
          tip.style.background = "#00ff99";
          tip.style.color = "#000";
          setTimeout(() => {
            tip.style.background = "rgba(0,0,0,0.85)";
            tip.style.color = "#fff";
          }, 400);
        }
      }, 1000);
    };

    const onMove = (e) => {

          if (!tip.isConnected) {
    document.documentElement.appendChild(tip);
  }

      const el = document.elementFromPoint(
        e.clientX,
        e.clientY
      );

      const url = getImageUrlFrom(el, e);

      if (url) {
        if (url !== lastUrl) {
          lastUrl = url;
          startTimer(url);
        }
        tip.style.display = "block";
        tip.style.left = (e.clientX + 12) + "px";
        tip.style.top = (e.clientY + 12) + "px";
      } else {
        lastUrl = "";
        clearInterval(timer);
        tip.style.display = "none";
      }
    };

    document.addEventListener(
      "mousemove",
      onMove,
      true
    );

    this._cleanup = () => {
      document.removeEventListener(
        "mousemove",
        onMove,
        true
      );

      clearInterval(timer);
      tip.remove();
      this.active = false;
    };

  },

  disable() {

    this._cleanup?.();
  }

});

  /************************************************************
   * 🔗 LINK SELECT (RESTORED)
   ************************************************************/
register("linkSelect", {
  title: "🖼 Seleccionar link",

    enable() {

    const selection = window.getSelection();

    let state = "WAITING";
    let linkTarget = null;
    let initPos = [0, 0];
    let selectType = "new";
    let mousemoves = 0;

    // 📌 tracker ligero (como el original)
    const moves = [[0,0],[0,0],[0,0]];
    let index = 0;

    document.addEventListener("mousemove", e => {
      moves[index][0] = e.pageX;
      moves[index][1] = e.pageY;
      index = (index + 1) % 3;
    }, true);

    function tracker() {
      const out = [];
      for (let i = 0; i < 2; i++) {
        out.push(
          Math.abs(moves[index][i] - moves[(index+1)%3][i]) +
          Math.abs(moves[(index+1)%3][i] - moves[(index+2)%3][i])
        );
      }
      return out;
    }

    function findLink(el) {
      while (el && el.nodeName !== "A") el = el.parentNode;
      return el;
    }

    function caretFromPoint(x, y) {
      if (document.caretPositionFromPoint) {
        return document.caretPositionFromPoint(x, y);
      }
      const r = document.caretRangeFromPoint(x, y);
      return {
        offsetNode: r.startContainer,
        offset: r.startOffset
      };
    }

    function getInitPos() {
      return caretFromPoint(
        initPos[0] - window.scrollX,
        initPos[1] - window.scrollY
      );
    }

    function shouldStart(e) {
      const delta = tracker();
      return delta[0] >= delta[1];
    }

    function startWaiting() {
      if (linkTarget) linkTarget.classList.remove("select-text-inside-a-link");
      state = "WAITING";
      linkTarget = null;
    }

    function startSelecting(e) {
      const pos = getInitPos();

      if (selectType === "new") {
        selection.collapse(pos.offsetNode, pos.offset);
      } else if (selectType === "add") {
        const range = new Range();
        range.setStart(pos.offsetNode, pos.offset);
        selection.addRange(range);
      }

      state = "STARTED";
    }

    document.addEventListener("mousedown", e => {

      if (state !== "WAITING") return;
      if (e.button !== 0 || e.altKey) return;

      const link = findLink(e.target);
      if (!link || !link.href) return;

      selectType =
        e.ctrlKey ? "add" :
        e.shiftKey ? "extend" :
        "new";

      initPos = [e.pageX, e.pageY];
      mousemoves = 0;

      state = "STARTING";
      linkTarget = link;

      link.classList.add("select-text-inside-a-link");

    }, true);

    document.addEventListener("mousemove", e => {

      if (state === "STARTING") {
        mousemoves++;
        if (mousemoves >= 3) startSelecting(e);
      }

      if (state === "STARTED") {
        const caret = caretFromPoint(
          e.pageX - window.scrollX,
          e.pageY - window.scrollY
        );

        try {
          selection.extend(caret.offsetNode, caret.offset);
        } catch {}
      }

    }, true);

    document.addEventListener("mouseup", () => {
      if (state !== "WAITING") {
        state = "ENDING";
        setTimeout(startWaiting, 0);
      }
    }, true);

    document.addEventListener("click", e => {
      if (state === "ENDING" && linkTarget) {
        const clicked = findLink(e.target);
        if (clicked === linkTarget) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
        startWaiting();
      }
    }, true);

    document.addEventListener("dragstart", e => {
      if (state === "STARTED") {
        e.preventDefault();
      } else if (state === "STARTING") {
        startSelecting(e);
      }
    }, true);

    GM_addStyle(`
      .select-text-inside-a-link {
        user-select: text !important;
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
      }
    `);

  }
});

  /************************************************************
   * 🖱 CONTEXT MENU
   ************************************************************/
  register("contextMenu", {
  title: "🖼 Debloquear menu contextual",

      enable() {
      document.addEventListener("contextmenu", e => e.stopPropagation(), true);
    }
  });

  /************************************************************
   * 🧩 IFRAMES
   ************************************************************/
  register("iframeUnlock", {
  title: "🖼 Debloquear iframe",

      enable() {
      document.querySelectorAll("iframe").forEach(f => {
        f.style.pointerEvents = "auto";
      });
    }
  });


  /************************************************************
   * 🧩 Speed Button
   ************************************************************/
register("ytSpeedButton", {
  title: "⏩ Youtube: Agregar boton de velocidad",

  enable() {

    const isYT = () =>
      location.hostname.includes("youtube.com");

    if (!isYT()) return;

    let observer;
    let btn;

    const speeds = [1, 1.5, 2];
    let index = 0;

    const createButton = (controls) => {

      if (!controls) return;
      if (document.getElementById("vh-speed")) return;
      btn = document.createElement("button");
      btn.id = "vh-speed";
      btn.className = "ytp-button";
      btn.textContent = speeds[index] + "×";

      btn.style.cssText = `
        display:flex;
        align-items:center;
        justify-content:center;
        width:48px;
        height:100%;
        font-size:13px;
        font-weight:700;
        line-height:1;
        padding:0;
        margin:0;
        color:white;
        text-align:center;
      `;

      btn.onclick = () => {
        const v = document.querySelector("video");
        if (!v) return;
        index = (index + 1) % speeds.length;
        v.playbackRate = speeds[index];
        btn.textContent = speeds[index] + "×";
      };
      controls.prepend(btn);
    };

    const waitControls = setInterval(() => {
      const controls =
        document.querySelector(".ytp-right-controls");
      if (controls) {
        clearInterval(waitControls);
        createButton(controls);

        // observer para SPA YouTube (cuando cambia el video)
        observer = new MutationObserver(() => {

          const c =
            document.querySelector(".ytp-right-controls");

          if (c && !document.getElementById("vh-speed")) {
            createButton(c);
          }

        });

        observer.observe(document.body, {
          childList: true,
          subtree: true
        });

      }

    }, 500);

    this._cleanup = () => {
      clearInterval(waitControls);
      observer?.disconnect();
      btn?.remove();
      btn = null;
    };

  },

  disable() {
    this._cleanup?.();
  }
});


  /************************************************************
   * 🧩🔊 Volume Boost
   ************************************************************/
register("ytVolumeBoost", {
  title: "⏩ Youtube: Agregar Control de volumen avanzado",

  async enable() {
    if (!location.hostname.includes("youtube.com")) return;
    const VOL_KEY = "vh_volume_level";
    let ctx, source, gainNode;
    let slider, label, container;
    const setupAudio = (video) => {
      if (ctx) return;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      source = ctx.createMediaElementSource(video);
      gainNode = ctx.createGain();
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      gainNode.gain.value = 1;

    };

    const createUI = async (controls) => {
      if (!controls) return;
      if (document.getElementById("vh-volume")) return;

      const saved = parseFloat(
        localStorage.getItem(VOL_KEY) || "100"
      );

      container = document.createElement("div");
      container.id = "vh-volume";

      container.style.cssText = `
        display:flex;
        align-items:center;
        gap:6px;
        margin-right:10px;
      `;

      label = document.createElement("span");
      label.textContent = saved + "%";

      label.style.cssText = `
        font-size:12px;
        color:white;
        min-width:35px;
        text-align:center;
      `;

      slider = document.createElement("input");
      slider.type = "range";
      slider.min = "100";
      slider.max = "300";
      slider.value = saved;
      slider.style.width = "80px";

      slider.oninput = () => {

        const video =
          document.querySelector("video");

        if (!video) return;

        setupAudio(video);

        gainNode.gain.value =
          slider.value / 100;

        label.textContent =
          slider.value + "%";

        localStorage.setItem(
          VOL_KEY,
          slider.value
        );

      };

      container.append(label, slider);
      controls.prepend(container);

    };

    const wait = setInterval(() => {
      const controls =
        document.querySelector(".ytp-right-controls");

      if (controls) {
        clearInterval(wait);

        createUI(controls);

        const observer = new MutationObserver(() => {

          const c =
            document.querySelector(".ytp-right-controls");

          if (c && !document.getElementById("vh-volume")) {
            createUI(c);
          }

        });

        observer.observe(document.body, {
          childList: true,
          subtree: true
        });

        this._observer = observer;

      }

    }, 500);

    this._cleanup = () => {
      clearInterval(wait);
      this._observer?.disconnect();
      document.getElementById("vh-volume")?.remove();

      ctx?.close?.();
      ctx = null;
      source = null;
      gainNode = null;
    };
  },

  disable() {
    this._cleanup?.();
  }
});

  /************************************************************
   * 🧩🔊 Oculta/muestra comentarios
   ************************************************************/
register("ytToggleComments", {
  title: "Youtube: Agregar boton para Oculta/muestra comentarios",

  enable() {

    if (!location.hostname.includes("youtube.com")) return;

    const KEY = "vh_comments_enabled";

    let lastState = null;
    let scheduled = false;

    const apply = () => {

      const enabled =
        JSON.parse(localStorage.getItem(KEY) ?? "true");

      if (enabled === lastState) return;
      lastState = enabled;

      const c = document.querySelector("ytd-comments");

      if (!c) return;

      document.getElementById("vh-c-msg")?.remove();

      if (enabled) {
        c.style.display = "";
        return;
      }

      c.style.display = "none";

      const msg = document.createElement("div");

      msg.id = "vh-c-msg";

      msg.textContent = "💬 Comentarios desactivados";

      msg.style.cssText = `
        margin:30px auto;
        text-align:center;
        font-size:20px;
        color:#aaa;
      `;

      c.parentElement?.insertBefore(msg, c);

    };

    const safeApply = () => {

      if (scheduled) return;

      scheduled = true;

      requestAnimationFrame(() => {

        apply();

        scheduled = false;

      });

    };

    const toggle = () => {

      const current =
        JSON.parse(localStorage.getItem(KEY) ?? "true");

      localStorage.setItem(KEY, JSON.stringify(!current));

      safeApply();

    };

    // botón YouTube
    const wait = setInterval(() => {

      const controls =
        document.querySelector(".ytp-right-controls");

      if (!controls) return;

      if (document.getElementById("vh-comments-btn")) return;

      clearInterval(wait);

      const btn = document.createElement("button");

      btn.id = "vh-comments-btn";
      btn.className = "ytp-button";
      btn.textContent = "💬";
      btn.onclick = toggle;

        btn.style.cssText = `
  display:flex;
  align-items:center;
  justify-content:center;

  width:48px;
  height:100%;

  padding:0;
  margin:0;

  font-size:16px;
  line-height:48px;

  box-sizing:border-box;
  color:white;
`;
      controls.prepend(btn);

      safeApply();

      // 🔥 IMPORTANTE: observer LIMITADO (NO global pesado)
      const obs = new MutationObserver(() => {
        safeApply();
      });

      const target =
        document.querySelector("#page-manager") ||
        document.body;

      obs.observe(target, {
        childList: true,
        subtree: false   // 👈 CLAVE: evita lag
      });

      this._obs = obs;

    }, 1000);

    this._cleanup = () => {

      clearInterval(wait);

      this._obs?.disconnect();

      document.getElementById("vh-comments-btn")?.remove();

      document.getElementById("vh-c-msg")?.remove();

    };

  },

  disable() {

    this._cleanup?.();

  }

});



})();
