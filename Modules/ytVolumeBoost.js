// ytVolumeBoost.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "ytVolumeBoost",
    mod: {
      title: "🔊 Volumen avanzado",
      desc: "Hasta 300%, slider vertical como el de YouTube, se re-aplica al cambiar de video",
      category: "YouTube",

      enable() {

        if (!location.hostname.includes("youtube.com")) return;

        const VOL_KEY = "vh_volume_level";
        let ctx, gainNode;
        let btn, popup, label, slider;
        let videoObserver, controlsObserver, outsideClickHandler;

        const connected = new WeakSet();

        const getSaved = () => parseFloat(localStorage.getItem(VOL_KEY) || "100");

        const connectVideo = (video) => {
          if (!video || connected.has(video)) return;
          if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
          if (!gainNode) {
            gainNode = ctx.createGain();
            gainNode.connect(ctx.destination);
          }
          try {
            const source = ctx.createMediaElementSource(video);
            source.connect(gainNode);
            connected.add(video);
            gainNode.gain.value = getSaved() / 100;
          } catch {
            // El video ya tiene un source node (p.ej. otra extensión); lo ignoramos.
          }
        };

        const applyValue = (val) => {
          const video = document.querySelector("video");
          connectVideo(video);
          if (gainNode) gainNode.gain.value = val / 100;
          if (label) label.textContent = val + "%";
          localStorage.setItem(VOL_KEY, val);
        };

        const closePopup = () => {
          popup?.remove();
          popup = null;
          if (outsideClickHandler) {
            document.removeEventListener("click", outsideClickHandler, true);
            outsideClickHandler = null;
          }
        };

        const openPopup = () => {
          if (popup) {
            closePopup();
            return;
          }

          const rect = btn.getBoundingClientRect();
          const saved = getSaved();

          popup = document.createElement("div");
          popup.id = "vh-volume-popup";
          popup.style.cssText = `
            position:fixed;
            bottom:${window.innerHeight - rect.top + 6}px;
            left:${rect.left + rect.width / 2 - 24}px;
            width:48px;
            height:130px;
            background:rgba(28,28,28,.97);
            border-radius:8px;
            display:flex;
            flex-direction:column;
            align-items:center;
            padding:10px 0;
            box-shadow:0 4px 14px rgba(0,0,0,.5);
            z-index:2147483647;
          `;

          label = document.createElement("span");
          label.textContent = saved + "%";
          label.style.cssText = "font-size:11px;color:white;margin-bottom:8px;user-select:none;";

          slider = document.createElement("input");
          slider.type = "range";
          slider.min = "0";
          slider.max = "300";
          slider.value = saved;
          slider.title = "Volumen (0%-300%)";

          // Slider vertical: soportado nativamente en Chrome/Edge/Opera con
          // -webkit-appearance:slider-vertical. Firefox usa orient="vertical".
          slider.setAttribute("orient", "vertical");
          slider.style.cssText = `
            -webkit-appearance: slider-vertical;
            writing-mode: vertical-lr;
            direction: rtl;
            width: 6px;
            height: 90px;
            cursor: pointer;
          `;

          slider.oninput = () => applyValue(slider.value);

          popup.append(label, slider);
          document.body.appendChild(popup);

          outsideClickHandler = (e) => {
            if (popup && !popup.contains(e.target) && e.target !== btn) {
              closePopup();
            }
          };
          setTimeout(() => {
            document.addEventListener("click", outsideClickHandler, true);
          }, 0);
        };

        const createUI = (controls) => {
          if (!controls) return;
          if (document.getElementById("vh-volume-btn")) return;

          btn = document.createElement("button");
          btn.id = "vh-volume-btn";
          btn.className = "ytp-button";
          btn.title = "Volumen avanzado (hasta 300%)";
          btn.textContent = "🔊";
          btn.style.cssText = `
            display:flex; align-items:center; justify-content:center;
            width:40px; height:100%; font-size:16px; padding:0; margin:0;
            color:white; background:transparent; border:none;
          `;

          btn.onclick = (e) => {
            e.stopPropagation();
            openPopup();
          };

          controls.prepend(btn);

          connectVideo(document.querySelector("video"));
        };

        const wait = setInterval(() => {
          const controls = document.querySelector(".ytp-right-controls");
          if (!controls) return;
          clearInterval(wait);

          createUI(controls);

          controlsObserver = new MutationObserver(() => {
            const c = document.querySelector(".ytp-right-controls");
            if (c && !document.getElementById("vh-volume-btn")) createUI(c);
          });
          controlsObserver.observe(document.body, { childList: true, subtree: true });

          videoObserver = new MutationObserver(() => connectVideo(document.querySelector("video")));
          videoObserver.observe(document.body, { childList: true, subtree: true });
        }, 500);

        this._cleanup = () => {
          clearInterval(wait);
          controlsObserver?.disconnect();
          videoObserver?.disconnect();
          closePopup();
          document.getElementById("vh-volume-btn")?.remove();
          ctx?.close?.();
          ctx = null;
          gainNode = null;
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
