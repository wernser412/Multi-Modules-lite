// translateSelect.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "translateSelect",
    mod: {
      title: "🌐 Traducir selección",
      desc: "Al seleccionar texto aparece un ícono para traducirlo a tu idioma, alternar español/inglés y escucharlo",
      category: "General",

      enable() {

        if (this.active) return;
        this.active = true;

        // ---------- Config ----------
        const LS_KEY = "mml_ts_target_lang";
        // Idioma "de casa": todo lo que selecciones se traduce a este
        // idioma por defecto (esté en el idioma que esté el original).
        const HOME_LANG = ((navigator.language || "es").slice(0, 2).toLowerCase()) || "es";
        // Idioma alterno fijo para el botón "↺ traducir al...": siempre
        // alterna entre español e inglés, sin importar cuál sea HOME_LANG.
        const OTHER_LANG = HOME_LANG === "en" ? "es" : "en";

        GM_addStyle(`
          .mml-tr-icon {
            position: fixed;
            width: 26px;
            height: 26px;
            border-radius: 50%;
            background: #1e1e1e;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            cursor: pointer;
            z-index: 2147483000;
            box-shadow: 0 2px 6px rgba(0,0,0,.35);
            user-select: none;
          }
          .mml-tr-icon:hover { transform: scale(1.08); }
          .mml-tr-bubble {
            position: fixed;
            max-width: 300px;
            background: #1e1e1e;
            color: #fff;
            padding: 10px 12px;
            border-radius: 8px;
            font-size: 13px;
            line-height: 1.4;
            white-space: pre-line;
            z-index: 2147483001;
            box-shadow: 0 4px 14px rgba(0,0,0,.4);
            cursor: pointer;
            user-select: none;
          }
          .mml-tr-bubble .mml-tr-lang {
            display: block;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: .04em;
            opacity: .7;
            margin-bottom: 4px;
          }
          .mml-tr-bubble .mml-tr-text { word-break: break-word; }
          .mml-tr-actions {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 8px;
          }
          .mml-tr-actions span {
            opacity: .75;
            text-decoration: underline;
            cursor: pointer;
            font-size: 11px;
          }
          .mml-tr-actions span:hover { opacity: 1; }
          .mml-tr-bubble small {
            display: block;
            opacity: .55;
            font-size: 10.5px;
            margin-top: 6px;
          }
        `);

        // Nombres legibles para los idiomas más comunes; si no está en la
        // lista, se muestra el código tal cual (ej: "ja", "ko").
        const LANG_NAMES = {
          es: "español", en: "inglés", pt: "portugués", fr: "francés",
          de: "alemán", it: "italiano", nl: "neerlandés", ru: "ruso",
          ja: "japonés", ko: "coreano", zh: "chino", zh_cn: "chino",
          ar: "árabe", hi: "hindi", tr: "turco", pl: "polaco",
          sv: "sueco", el: "griego", he: "hebreo", id: "indonesio"
        };
        const langName = (code) => LANG_NAMES[code?.toLowerCase()] || code;

        // Locales para la síntesis de voz (SpeechSynthesis pide BCP-47,
        // no solo el código de 2 letras que usa Google Translate).
        const SPEECH_LOCALES = {
          es: "es-ES", en: "en-US", pt: "pt-PT", fr: "fr-FR",
          de: "de-DE", it: "it-IT", nl: "nl-NL", ru: "ru-RU",
          ja: "ja-JP", ko: "ko-KR", zh: "zh-CN", ar: "ar-SA",
          hi: "hi-IN", tr: "tr-TR", pl: "pl-PL", sv: "sv-SE",
          el: "el-GR", he: "he-IL", id: "id-ID"
        };

        const speak = (text, langCode) => {
          try {
            if (!window.speechSynthesis) return;
            window.speechSynthesis.cancel(); // corta cualquier lectura anterior
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = SPEECH_LOCALES[langCode] || langCode;
            window.speechSynthesis.speak(utter);
          } catch {}
        };

        // ---------- Traducción (Google Translate, endpoint público) ----------
        const translate = (text, targetLang) => new Promise((resolve, reject) => {
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;

          const onResponse = (res) => {
            try {
              const data = JSON.parse(res.responseText);
              const translated = (data[0] || []).map((seg) => seg[0]).join("");
              if (!translated) throw new Error("Respuesta vacía");
              resolve({ translated });
            } catch (err) {
              reject(err);
            }
          };

          if (typeof GM_xmlhttpRequest !== "undefined") {
            GM_xmlhttpRequest({
              method: "GET",
              url,
              onload: onResponse,
              onerror: () => reject(new Error("Fallo de red")),
              ontimeout: () => reject(new Error("Timeout")),
              timeout: 10000
            });
          } else {
            fetch(url)
              .then((r) => r.text())
              .then((text2) => onResponse({ responseText: text2 }))
              .catch(reject);
          }
        });

        // ---------- UI flotante ----------
        let icon = null;
        let bubble = null;

        const removeIcon = () => { icon?.remove(); icon = null; };
        const removeBubble = () => { bubble?.remove(); bubble = null; };
        const removeAll = () => { removeIcon(); removeBubble(); };

        const showIcon = (rect, text) => {
          removeAll();

          icon = document.createElement("div");
          icon.className = "mml-tr-icon";
          icon.textContent = "🌐";
          icon.title = "Traducir selección";
          icon.style.left = `${Math.min(rect.right + 6, window.innerWidth - 32)}px`;
          icon.style.top = `${Math.max(rect.top - 4, 4)}px`;

          icon.addEventListener("mousedown", (e) => e.preventDefault()); // no perder la selección
          icon.addEventListener("click", (e) => {
            e.stopPropagation();
            const target = GM_getValue(LS_KEY, HOME_LANG);
            runTranslation(text, target);
          });

          document.body.appendChild(icon);
        };

        const positionBubble = () => {
          const iconRect = icon?.getBoundingClientRect();
          const top = iconRect ? iconRect.bottom + 6 : 20;
          const left = iconRect ? Math.min(iconRect.left, window.innerWidth - 310) : 20;
          bubble.style.top = `${top}px`;
          bubble.style.left = `${Math.max(left, 4)}px`;
        };

        const showLoading = () => {
          removeBubble();
          bubble = document.createElement("div");
          bubble.className = "mml-tr-bubble";
          bubble.innerHTML = `<span class="mml-tr-text">Traduciendo…</span>`;
          bubble.addEventListener("mousedown", (e) => e.preventDefault());
          document.body.appendChild(bubble);
          positionBubble();
        };

        const showError = () => {
          if (!bubble) return;
          bubble.innerHTML = `<span class="mml-tr-text">⚠️ No se pudo traducir</span><small>Click para cerrar</small>`;
          bubble.onclick = removeAll;
        };

        const escapeHtml = (s) => String(s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

        // Siempre traduce el texto seleccionado AL idioma pedido, sin
        // importar en qué idioma esté el original (si ya está en ese
        // idioma, Google devuelve el mismo texto — y eso está bien).
        const runTranslation = async (text, targetLang) => {
          showLoading();
          try {
            const { translated } = await translate(text, targetLang);
            if (!bubble) return; // se cerró mientras esperaba

            const swapTo = targetLang === OTHER_LANG ? HOME_LANG : OTHER_LANG;

            bubble.innerHTML = `
              <span class="mml-tr-lang">🌐 Traducción al ${escapeHtml(langName(targetLang))}</span>
              <span class="mml-tr-text">${escapeHtml(translated)}</span>
              <div class="mml-tr-actions">
                <span class="mml-tr-swap" data-lang="${escapeHtml(swapTo)}">↺ traducir al ${escapeHtml(langName(swapTo))}</span>
                <span class="mml-tr-speak">🔊 Escuchar</span>
              </div>
              <small>Click para copiar</small>
            `;

            bubble.onclick = async (e) => {
              if (e.target.closest(".mml-tr-swap, .mml-tr-speak")) return; // manejados aparte
              try {
                await navigator.clipboard.writeText(translated);
                bubble.innerHTML = "✅ Copiado";
                setTimeout(removeAll, 700);
              } catch {}
            };

            bubble.querySelector(".mml-tr-swap")?.addEventListener("click", (e) => {
              e.stopPropagation();
              const lang = e.currentTarget.dataset.lang;
              GM_setValue(LS_KEY, lang);
              runTranslation(text, lang);
            });

            bubble.querySelector(".mml-tr-speak")?.addEventListener("click", (e) => {
              e.stopPropagation();
              speak(translated, targetLang);
            });
          } catch {
            showError();
          }
        };

        // ---------- Detección de selección ----------
        const onSelectionUp = (e) => {
          // Si el mouseup ocurrió sobre el ícono o la burbuja, no reprocesar
          // la selección: eso destruiría y recrearía el ícono antes de que
          // el navegador llegue a disparar el evento "click" sobre él.
          if (icon?.contains(e.target) || bubble?.contains(e.target)) return;

          const sel = window.getSelection();
          const text = sel?.toString().trim();

          if (!text || text.length > 2000) {
            removeAll();
            return;
          }

          try {
            const range = sel.getRangeAt(0);
            const rects = range.getClientRects();
            const rect = rects[rects.length - 1] || range.getBoundingClientRect();
            if (!rect || (rect.width === 0 && rect.height === 0)) return;
            showIcon(rect, text);
          } catch {
            removeAll();
          }
        };

        const onMouseDown = (e) => {
          if (icon?.contains(e.target) || bubble?.contains(e.target)) return;
          removeAll();
        };

        const onKeyDown = (e) => {
          if (e.key === "Escape") removeAll();
        };

        const onScrollOrResize = () => removeAll();

        document.addEventListener("mouseup", onSelectionUp);
        document.addEventListener("mousedown", onMouseDown, true);
        document.addEventListener("keydown", onKeyDown);
        window.addEventListener("scroll", onScrollOrResize, true);
        window.addEventListener("resize", onScrollOrResize);

        this._cleanup = () => {
          document.removeEventListener("mouseup", onSelectionUp);
          document.removeEventListener("mousedown", onMouseDown, true);
          document.removeEventListener("keydown", onKeyDown);
          window.removeEventListener("scroll", onScrollOrResize, true);
          window.removeEventListener("resize", onScrollOrResize);
          try { window.speechSynthesis?.cancel(); } catch {}
          removeAll();
          this.active = false;
        };
      },

      disable() {
        this._cleanup?.();
      }
    }
  });
})();
