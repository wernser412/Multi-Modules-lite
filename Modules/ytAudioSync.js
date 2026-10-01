// ytAudioSync.js
// Corrige videos de YouTube cuyo audio va ADELANTADO respecto a la imagen,
// atrasando el audio unos milisegundos. El ajuste se recuerda por video.
//
// Este archivo incluye también la cadena de audio compartida (window.__MML_AUDIO).
// Un <video> solo admite UN MediaElementSource, así que ytAudioSync (retraso) y
// ytVolumeBoost (volumen) comparten esta cadena:
//
//     video → delay → gain → salida
//
// Se define al cargar el archivo (aunque el módulo esté apagado), por eso
// ytVolumeBoost.js depende de que este archivo esté en los @require.

/********************************************************
 CADENA DE AUDIO COMPARTIDA
********************************************************/
(function () {
  if (window.__MML_AUDIO) return;

  const MAX_DELAY_SEC = 5;

  let ctx = null;
  let delayNode = null;
  let gainNode = null;
  let lastDelay = 0;
  let gestureBound = false;
  const wired = new WeakSet();

  const resume = () => {
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  };

  const ensureCtx = () => {
    if (ctx && ctx.state !== "closed") return true;

    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;

    ctx = new AC();
    delayNode = ctx.createDelay(MAX_DELAY_SEC);
    gainNode = ctx.createGain();
    delayNode.connect(gainNode);
    gainNode.connect(ctx.destination);
    lastDelay = 0;

    // Si el contexto nace "suspended" (política de autoplay) y el video ya
    // está enganchado, el audio queda mudo. Se reanuda con el primer gesto.
    if (!gestureBound) {
      gestureBound = true;
      ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
        document.addEventListener(ev, resume, true)
      );
    }
    return true;
  };

  window.__MML_AUDIO = {
    maxDelayMs: MAX_DELAY_SEC * 1000,

    isWired(video) {
      return !!video && wired.has(video);
    },

    // Engancha el video a la cadena (idempotente). false si no se pudo,
    // p. ej. porque otra extensión ya capturó el audio de ese <video>.
    attach(video) {
      if (!video || !ensureCtx()) return false;

      if (!wired.has(video)) {
        try {
          ctx.createMediaElementSource(video).connect(delayNode);
          wired.add(video);
          video.addEventListener("play", resume);
        } catch (e) {
          return false;
        }
      }
      resume();
      return true;
    },

    setGain(value) {
      if (gainNode) gainNode.gain.value = value;
    },

    // Retraso del audio en milisegundos (0 = sin retraso).
    setDelayMs(ms) {
      if (!delayNode) return;
      const sec = Math.min(Math.max(ms, 0) / 1000, MAX_DELAY_SEC);
      if (sec === lastDelay) return;
      lastDelay = sec;
      // Transición suave para evitar chasquidos al mover el slider.
      delayNode.delayTime.setTargetAtTime(sec, ctx.currentTime, 0.03);
    },

    resume
  };
})();

/********************************************************
 MÓDULO
********************************************************/
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "ytAudioSync",
    mod: {
      title: "🎧 Sincronizar audio",
      desc: "Atrasa el audio si va adelantado al video. Se recuerda por video",
      category: "YouTube",

      enable() {

        if (!location.hostname.includes("youtube.com")) return;

        const graph = window.__MML_AUDIO;
        if (!graph) {
          console.warn("[ytAudioSync] No se creó la cadena de audio compartida.");
          return;
        }

        const STORE_KEY = "mml_yt_audio_delay";
        const MAX_ENTRIES = 500;
        const MAX_MS = 2000;
        const STEP = 10;

        let btn, popup, slider, valueLabel, statusLabel;
        let controlsObserver, outsideClickHandler, tickTimer, waitTimer;
        let videoId = null;
        let delayMs = 0;
        let attachFailed = false;

        /* ---------- almacenamiento por video ---------- */

        const loadMap = () => {
          try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
          catch { return {}; }
        };

        const persist = () => {
          if (!videoId) return;
          const map = loadMap();
          delete map[videoId];                 // reinserta al final (más reciente)
          if (delayMs > 0) map[videoId] = delayMs;
          const keys = Object.keys(map);
          if (keys.length > MAX_ENTRIES) {
            keys.slice(0, keys.length - MAX_ENTRIES).forEach((k) => delete map[k]);
          }
          try { localStorage.setItem(STORE_KEY, JSON.stringify(map)); } catch {}
        };

        const getVideoId = () => {
          const u = new URL(location.href);
          const v = u.searchParams.get("v");
          if (v) return v;
          const m = u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{6,})/);
          return m ? m[1] : null;
        };

        // Durante los anuncios el audio ya viene sincronizado: no se atrasa.
        const isAd = () => !!document.querySelector(".html5-video-player.ad-showing");

        /* ---------- aplicar retraso ---------- */

        const applyDelay = () => {
          const effective = isAd() ? 0 : delayMs;
          const video = document.querySelector("video");
          if (!video) return;

          // Solo se captura el audio del video si hace falta (retraso > 0 o
          // ya estaba capturado), para no tocar videos que no lo necesitan.
          if (effective > 0 || graph.isWired(video)) {
            attachFailed = !graph.attach(video);
            if (!attachFailed) graph.setDelayMs(effective);
            if (statusLabel) {
              statusLabel.textContent = attachFailed
                ? "No se pudo enganchar el audio (¿otra extensión lo usa?)"
                : "";
            }
          }
        };

        /* ---------- UI ---------- */

        const refreshUI = () => {
          if (btn) {
            btn.textContent = delayMs > 0 ? delayMs + "ms" : "⏱";
            btn.style.color = delayMs > 0 ? "#3ea6ff" : "white";
            btn.style.fontSize = delayMs > 0 ? "12px" : "16px";
          }
          if (slider) slider.value = delayMs;
          if (valueLabel) valueLabel.textContent = delayMs + " ms";
        };

        const setDelay = (ms) => {
          delayMs = Math.min(Math.max(Math.round(ms / STEP) * STEP, 0), MAX_MS);
          persist();
          applyDelay();
          refreshUI();
        };

        const closePopup = () => {
          popup?.remove();
          popup = slider = valueLabel = statusLabel = null;
          if (outsideClickHandler) {
            document.removeEventListener("click", outsideClickHandler, true);
            outsideClickHandler = null;
          }
        };

        const makeBtn = (text, onClick) => {
          const b = document.createElement("button");
          b.textContent = text;
          b.style.cssText = `
            flex:1; padding:5px 0; font-size:12px; color:white; cursor:pointer;
            background:rgba(255,255,255,.12); border:none; border-radius:5px;
          `;
          b.onmouseenter = () => (b.style.background = "rgba(255,255,255,.25)");
          b.onmouseleave = () => (b.style.background = "rgba(255,255,255,.12)");
          b.onclick = (e) => { e.stopPropagation(); onClick(); };
          return b;
        };

        const openPopup = () => {
          if (popup) { closePopup(); return; }

          const rect = btn.getBoundingClientRect();
          const W = 236;
          const left = Math.min(
            Math.max(rect.left + rect.width / 2 - W / 2, 8),
            window.innerWidth - W - 8
          );

          popup = document.createElement("div");
          popup.id = "mml-audiosync-popup";
          popup.style.cssText = `
            position:fixed;
            bottom:${window.innerHeight - rect.top + 6}px;
            left:${left}px;
            width:${W}px;
            box-sizing:border-box;
            padding:10px 12px 12px;
            background:rgba(28,28,28,.97);
            color:white;
            border-radius:8px;
            box-shadow:0 4px 14px rgba(0,0,0,.5);
            font-family:Roboto,Arial,sans-serif;
            z-index:2147483647;
          `;

          const head = document.createElement("div");
          head.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;";
          const title = document.createElement("span");
          title.textContent = "Retraso del audio";
          title.style.cssText = "font-size:12px; font-weight:700;";
          valueLabel = document.createElement("span");
          valueLabel.style.cssText = "font-size:12px; color:#3ea6ff; font-weight:700;";
          head.append(title, valueLabel);

          slider = document.createElement("input");
          slider.type = "range";
          slider.min = "0";
          slider.max = String(MAX_MS);
          slider.step = String(STEP);
          slider.style.cssText = "width:100%; cursor:pointer; margin:0 0 8px;";
          slider.oninput = () => setDelay(Number(slider.value));

          const row = document.createElement("div");
          row.style.cssText = "display:flex; gap:4px; margin-bottom:8px;";
          [-50, -10, 10, 50].forEach((d) =>
            row.appendChild(makeBtn((d > 0 ? "+" : "−") + Math.abs(d), () => setDelay(delayMs + d)))
          );

          const reset = makeBtn("Quitar retraso", () => setDelay(0));
          reset.style.cssText += "width:100%; flex:none; margin-bottom:8px;";

          const hint = document.createElement("div");
          hint.textContent = "Si el audio suena antes que la imagen, súbelo hasta que coincidan. Se guarda para este video.";
          hint.style.cssText = "font-size:10.5px; color:#aaa; line-height:1.35;";

          statusLabel = document.createElement("div");
          statusLabel.style.cssText = "font-size:10.5px; color:#ff8a80; margin-top:6px;";
          statusLabel.textContent = attachFailed
            ? "No se pudo enganchar el audio (¿otra extensión lo usa?)"
            : "";

          popup.append(head, slider, row, reset, hint, statusLabel);

          // Evita que las teclas/clicks del popup lleguen al reproductor
          // (flechas = saltar, click = pausar) cuando está en pantalla completa.
          ["keydown", "keyup", "click", "dblclick"].forEach((ev) =>
            popup.addEventListener(ev, (e) => e.stopPropagation())
          );

          // En pantalla completa solo se ve lo que está dentro del elemento
          // en fullscreen (top layer).
          (document.fullscreenElement || document.body).appendChild(popup);
          refreshUI();

          outsideClickHandler = (e) => {
            if (popup && !popup.contains(e.target) && e.target !== btn) closePopup();
          };
          setTimeout(() => {
            document.addEventListener("click", outsideClickHandler, true);
          }, 0);
        };

        const createButton = (controls) => {
          if (!controls) return;
          if (document.getElementById("mml-audiosync-btn")) return;

          btn = document.createElement("button");
          btn.id = "mml-audiosync-btn";
          btn.className = "ytp-button";
          btn.title = "Sincronizar audio (atrasar el audio)";
          btn.style.cssText = `
            display:flex; align-items:center; justify-content:center;
            width:48px; height:100%; padding:0; margin:0;
            font-weight:700; line-height:1; text-align:center;
            background:transparent; border:none;
          `;
          btn.onclick = (e) => {
            e.stopPropagation();
            openPopup();
          };

          controls.prepend(btn);
          refreshUI();
        };

        /* ---------- ciclo de vida ---------- */

        // Detecta cambio de video (navegación SPA), anuncios y reemplazo del
        // elemento <video>, y reaplica el retraso guardado.
        const tick = () => {
          const id = getVideoId();
          if (id !== videoId) {
            videoId = id;
            delayMs = id ? loadMap()[id] || 0 : 0;
            refreshUI();
          }
          applyDelay();
        };

        const onFullscreen = () => closePopup();
        document.addEventListener("fullscreenchange", onFullscreen);

        tick();
        tickTimer = setInterval(tick, 1000);

        waitTimer = setInterval(() => {
          const controls = document.querySelector(".ytp-right-controls");
          if (!controls) return;
          clearInterval(waitTimer);

          createButton(controls);

          controlsObserver = new MutationObserver(() => {
            const c = document.querySelector(".ytp-right-controls");
            if (c && !document.getElementById("mml-audiosync-btn")) createButton(c);
          });
          controlsObserver.observe(document.body, { childList: true, subtree: true });
        }, 500);

        this._cleanup = () => {
          clearInterval(tickTimer);
          clearInterval(waitTimer);
          controlsObserver?.disconnect();
          document.removeEventListener("fullscreenchange", onFullscreen);
          closePopup();
          document.getElementById("mml-audiosync-btn")?.remove();
          btn = null;
          // El audio sigue pasando por la cadena compartida, solo sin retraso.
          graph.setDelayMs(0);
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
