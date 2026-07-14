// ytVolumeBoost.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "ytVolumeBoost",
    mod: {
      title: "🔊 Volumen avanzado",
      desc: "Hasta 300%, se re-aplica al cambiar de video",
      category: "YouTube",

      enable() {

        if (!location.hostname.includes("youtube.com")) return;

        const VOL_KEY = "vh_volume_level";
        let ctx, gainNode;
        let slider, label, container;
        let videoObserver, controlsObserver;

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

        const createUI = (controls) => {
          if (!controls) return;
          if (document.getElementById("vh-volume")) return;

          const saved = getSaved();

          container = document.createElement("div");
          container.id = "vh-volume";
          container.style.cssText = "display:flex;align-items:center;gap:6px;margin-right:10px;";

          label = document.createElement("span");
          label.textContent = saved + "%";
          label.style.cssText = "font-size:12px;color:white;min-width:35px;text-align:center;";

          slider = document.createElement("input");
          slider.type = "range";
          slider.min = "100";
          slider.max = "300";
          slider.value = saved;
          slider.style.width = "80px";

          slider.oninput = () => {
            const video = document.querySelector("video");
            connectVideo(video);
            if (gainNode) gainNode.gain.value = slider.value / 100;
            label.textContent = slider.value + "%";
            localStorage.setItem(VOL_KEY, slider.value);
          };

          container.append(label, slider);
          controls.prepend(container);

          connectVideo(document.querySelector("video"));
        };

        const wait = setInterval(() => {
          const controls = document.querySelector(".ytp-right-controls");
          if (!controls) return;
          clearInterval(wait);

          createUI(controls);

          controlsObserver = new MutationObserver(() => {
            const c = document.querySelector(".ytp-right-controls");
            if (c && !document.getElementById("vh-volume")) createUI(c);
          });
          controlsObserver.observe(document.body, { childList: true, subtree: true });

          videoObserver = new MutationObserver(() => connectVideo(document.querySelector("video")));
          videoObserver.observe(document.body, { childList: true, subtree: true });
        }, 500);

        this._cleanup = () => {
          clearInterval(wait);
          controlsObserver?.disconnect();
          videoObserver?.disconnect();
          document.getElementById("vh-volume")?.remove();
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
