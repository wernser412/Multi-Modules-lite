// imageTooltip.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "imageTooltip",
    mod: {
      title: "🖼 Image Tooltip Pro",
      desc: "Detecta imágenes y copia URL",
      category: "General",

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
          wordBreak: "break-all",
          transition: "background .2s ease, color .2s ease"
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

        const extract = (node) => {
          while (node) {
            if (node.nodeType !== 1) {
              node = node.parentElement;
              continue;
            }

            const tag = node.tagName.toLowerCase();

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

            if (tag === "image") {
              return (
                node.getAttribute("href") ||
                node.getAttribute("xlink:href") ||
                ""
              );
            }

            const child = node.querySelector?.("img") || node.querySelector?.("image");

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
                (cs2.backgroundImage !== "none" &&
                  cs2.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1]) ||
                ""
              );
            }

            const cs = getComputedStyle(node);
            if (cs.backgroundImage && cs.backgroundImage !== "none") {
              const m = cs.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
              if (m) return m[1];
            }

            node = node.parentElement;
          }
          return "";
        };

        const getImageUrlFrom = (el, e) => {
          if (!el) return "";
          const stack = document.elementsFromPoint(e.clientX, e.clientY) || [];
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
            txt.textContent = `⏱ ${countdown}s`;
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
          if (!tip.isConnected) document.documentElement.appendChild(tip);

          const el = document.elementFromPoint(e.clientX, e.clientY);
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

        document.addEventListener("mousemove", onMove, true);

        this._cleanup = () => {
          document.removeEventListener("mousemove", onMove, true);
          clearInterval(timer);
          tip.remove();
          this.active = false;
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
