// ── Apilado de íconos de selección ─────────────────────────────────────
// Los módulos "Resolver selección mate", "Buscar selección en Google" y
// "Traducir selección" muestran un ícono junto al texto seleccionado.
// Esta función (compartida por los tres, se define una sola vez) los
// acomoda uno al lado del otro para que no se encimen.
(function () {
  if (window.__mmlStackIcons) return;
  let timer = null;
  window.__mmlStackIcons = function () {
    clearTimeout(timer);
    // setTimeout 0: corre cuando ya terminaron TODOS los handlers de mouseup.
    timer = setTimeout(() => {
      const selectors = [".mml-math-icon", "#mml-gs-icon.mml-gs-visible", ".mml-tr-icon"];
      const els = selectors.map(q => document.querySelector(q)).filter(Boolean);
      if (els.length < 2) return;
      const GAP = 34;
      let x = parseFloat(els[0].dataset.mmlX);
      const y = parseFloat(els[0].dataset.mmlY);
      if (isNaN(x) || isNaN(y)) return;
      x = Math.max(4, Math.min(x, window.innerWidth - els.length * GAP - 4));
      els.forEach((el, i) => {
        const abs = getComputedStyle(el).position === "absolute";
        el.style.left = `${x + i * GAP + (abs ? window.scrollX : 0)}px`;
        el.style.top = `${y + (abs ? window.scrollY : 0)}px`;
      });
    }, 0);
  };
})();

// mathSelectSolve.js
(function () {
  window.__MML_QUEUE = window.__MML_QUEUE || [];

  window.__MML_QUEUE.push({
    name: "mathSelectSolve",
    mod: {
      title: "🧮 Resolver selección matemática",
      desc: "Al seleccionar texto aparece 🧮: calcula operaciones (4+5, √9, sen30) y resuelve ecuaciones (2x+3=11, x²-5x+6=0, sistemas)",
      category: "General",

      enable() {

        if (this.active) return;
        this.active = true;

        GM_addStyle(`
          .mml-math-icon {
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
          .mml-math-icon:hover { transform: scale(1.08); }
          .mml-math-bubble {
            position: fixed;
            max-width: 260px;
            background: #1e1e1e;
            color: #fff;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 13px;
            line-height: 1.4;
            white-space: pre-line;
            z-index: 2147483001;
            box-shadow: 0 4px 14px rgba(0,0,0,.4);
            cursor: pointer;
            user-select: none;
          }
          .mml-math-bubble small {
            display: block;
            opacity: .6;
            font-size: 11px;
            margin-top: 2px;
          }
        `);

        // ---------- Parser matemático seguro (sin eval/Function) ----------
        // Soporta: + - * / % ^ (potencia), paréntesis, decimales, signo
        // unario, constantes (pi, e) y funciones (sin, cos, sqrt, log...),
        // igual que el evaluador en AHK puro (EvaluarExpresionAHK).
        const tokenize = (str) => {
          const tokens = [];
          let i = 0;
          while (i < str.length) {
            const c = str[i];
            if (/\s/.test(c)) { i++; continue; }
            if (/[0-9.]/.test(c)) {
              let j = i;
              while (j < str.length && /[0-9.]/.test(str[j])) j++;
              const raw = str.slice(i, j);
              if ((raw.match(/\./g) || []).length > 1) throw new Error("Número inválido");
              tokens.push({ t: "num", v: parseFloat(raw) });
              i = j;
              continue;
            }
            if (/[a-z]/i.test(c)) {
              let j = i + 1;
              while (j < str.length && /[a-z0-9]/i.test(str[j])) j++;
              tokens.push({ t: "id", v: str.slice(i, j).toLowerCase() });
              i = j;
              continue;
            }
            if ("+-*/^%(),".includes(c)) {
              tokens.push({ t: c });
              i++;
              continue;
            }
            throw new Error("Carácter inválido");
          }
          return tokens;
        };

        const MATH_CONSTANTS = { pi: Math.PI, e: Math.E };

        const factorial = (n) => {
          if (n < 0 || !Number.isInteger(n)) throw new Error("factorial() solo acepta enteros no negativos");
          let r = 1;
          for (let k = 2; k <= n; k++) r *= k;
          return r;
        };

        // Reemplaza a "from math import *": mismas funciones que soporta
        // el evaluador AHK (sqrt, sin, cos, tan, asin, acos, atan, ln,
        // log, log10, exp, abs, floor, ceil, round, factorial).
        const callFunction = (name, args) => {
          const need = (n) => {
            if (args.length !== n) throw new Error(`${name}() esperaba ${n} argumento(s), recibió ${args.length}`);
          };
          switch (name) {
            case "sqrt": need(1); return Math.sqrt(args[0]);
            case "sin": need(1); return Math.sin(args[0]);
            case "cos": need(1); return Math.cos(args[0]);
            case "tan": need(1); return Math.tan(args[0]);
            case "asin": need(1); return Math.asin(args[0]);
            case "acos": need(1); return Math.acos(args[0]);
            case "atan": need(1); return Math.atan(args[0]);
            case "ln": need(1); return Math.log(args[0]);
            case "log":
              if (args.length === 1) return Math.log(args[0]);
              need(2);
              return Math.log(args[0]) / Math.log(args[1]);
            case "log10": need(1); return Math.log10(args[0]);
            case "exp": need(1); return Math.exp(args[0]);
            case "abs": need(1); return Math.abs(args[0]);
            case "floor": need(1); return Math.floor(args[0]);
            case "ceil": need(1); return Math.ceil(args[0]);
            case "round":
              if (args.length === 1) return Math.round(args[0]);
              need(2);
              { const f = Math.pow(10, args[1]); return Math.round(args[0] * f) / f; }
            case "factorial": need(1); return factorial(args[0]);
            default:
              throw new Error(`Función desconocida: ${name}(). Soportadas: sqrt, sin, cos, tan, asin, acos, atan, ln, log, log10, exp, abs, floor, ceil, round, factorial`);
          }
        };

        const parseExpr = (tokens) => {
          let pos = 0;
          const peek = () => tokens[pos];
          const next = () => tokens[pos++];

          const parsePrimary = () => {
            const tok = peek();
            if (!tok) throw new Error("Expresión incompleta");
            if (tok.t === "num") { next(); return tok.v; }
            if (tok.t === "id") {
              next();
              const name = tok.v;
              if (peek() && peek().t === "(") {
                next();
                const args = [];
                if (!(peek() && peek().t === ")")) {
                  args.push(parseAdd());
                  while (peek() && peek().t === ",") { next(); args.push(parseAdd()); }
                }
                if (!(peek() && peek().t === ")")) throw new Error(`Falta paréntesis de cierre en ${name}(...)`);
                next();
                return callFunction(name, args);
              }
              if (name in MATH_CONSTANTS) return MATH_CONSTANTS[name];
              throw new Error(`Identificador desconocido: ${name}`);
            }
            if (tok.t === "(") {
              next();
              const val = parseAdd();
              if (!peek() || peek().t !== ")") throw new Error("Falta paréntesis");
              next();
              return val;
            }
            throw new Error("Expresión inválida");
          };

          const parseUnary = () => {
            if (peek() && (peek().t === "+" || peek().t === "-")) {
              const op = next().t;
              const val = parseUnary();
              return op === "-" ? -val : val;
            }
            return parsePrimary();
          };

          const parsePow = () => {
            const base = parseUnary();
            if (peek() && peek().t === "^") {
              next();
              const exp = parsePow(); // asociatividad derecha
              return Math.pow(base, exp);
            }
            return base;
          };

          const parseMul = () => {
            let val = parsePow();
            while (peek() && (peek().t === "*" || peek().t === "/" || peek().t === "%")) {
              const op = next().t;
              const rhs = parsePow();
              if (op === "*") val *= rhs;
              else if (op === "/") val /= rhs;
              else val %= rhs;
            }
            return val;
          };

          const parseAdd = () => {
            let val = parseMul();
            while (peek() && (peek().t === "+" || peek().t === "-")) {
              const op = next().t;
              const rhs = parseMul();
              val = op === "+" ? val + rhs : val - rhs;
            }
            return val;
          };

          const result = parseAdd();
          if (pos !== tokens.length) throw new Error("Expresión inválida");
          return result;
        };

        const solve = (text) => parseExpr(tokenize(text));

        // ---------- Normalización tipo AHK (NormalizarExpresionMatematica) ----------
        // Traduce notación "humana" en español y símbolos Unicode a la
        // sintaxis que entiende el parser de arriba: ÷ × • → /  * ,
        // "sen"/"π" → sin/pi, √ ∛ → potencias fraccionarias, superíndices
        // (x²) → ^, coma/punto y coma decimales → punto, etc.
        const SUPERSCRIPTS = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "⁺": "+" };

        const normalizeExpression = (text) => {
          let b = text.replace(/ /g, "");
          b = b.replace(/\u200B/g, "");   // espacio de ancho cero
          b = b.replace(/[\u2013\u2014\u2212]/g, "-"); // guion medio/largo, signo menos matemático
          b = b.toLowerCase();

          b = b.replace(/[;,]/g, ".");    // coma/punto y coma decimal (notación en español)
          b = b.replace(/[÷:]/g, "/");
          b = b.replace(/[•×]/g, "*");
          b = b.replace(/x/g, "*");       // ninguna función soportada contiene "x"
          b = b.replace(/log10/g, "log\u0000ten"); // protege el "0" de log10 antes de la multiplicación implícita
          b = b.replace(/[\[{]/g, "(");
          b = b.replace(/[\]}]/g, ")");
          b = b.replace(/\)\(/g, ")*(");
          b = b.replace(/(\d)\(/g, "$1*(");
          b = b.replace(/log\u0000ten/g, "log10");

          // Trigonometría en español → inglés, con o sin paréntesis
          b = b.replace(/sen(\d+)/g, "sin($1)");
          b = b.replace(/sen\((\d+)\)/g, "sin($1)");
          b = b.replace(/(sin|cos|tan)(\d+)/g, "$1($2)");

          // π
          b = b.replace(/π/g, "pi");
          b = b.replace(/(\d)\**pi/g, "$1*pi");

          // Raíces
          b = b.replace(/√(\d+)/g, "($1^(1/2))");
          b = b.replace(/∛(\d+)/g, "($1^(1/3))");
          b = b.replace(/√\((\d+)\)/g, "($1^(1/2))");
          b = b.replace(/∛\((\d+)\)/g, "($1^(1/3))");

          // Superíndices (2³, (2)³, π²)
          b = b.replace(/(\d+|\(-?\d+\)|pi)([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+)/g, "($1)^($2)");
          b = b.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]/g, (ch) => SUPERSCRIPTS[ch]);

          return b;
        };

        const MATH_FUNCTION_NAMES = ["asin", "acos", "atan", "sin", "cos", "tan", "sen", "ln", "log10", "log", "sqrt", "exp", "abs", "floor", "ceil", "round", "factorial"];

        // Filtro rápido antes de intentar parsear: solo caracteres válidos
        // y que "se vea" como una operación (con operador, función, raíz,
        // potencia o pi) — así no reacciona a un número o palabra sueltos.
        const looksLikeMath = (text) => {
          if (!text || text.length > 200) return false;
          const t = text.trim();
          if (!/\d/.test(t)) return false;
          if (!/^[0-9a-zA-Z.,;:()[\]{}+\-*/^%×÷•π√∛⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻\s\u2013\u2014\u2212]+$/.test(t)) return false;

          const lower = t.toLowerCase();
          const hasOperator = /[+\-*/^%×÷•]/.test(t);
          const hasFn = new RegExp(`\\b(${MATH_FUNCTION_NAMES.join("|")})(?=\\d|\\()`).test(lower);
          const hasRootOrPow = /[√∛⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]/.test(t) || /\bpi\b|π/.test(lower);
          const hasXMultiply = /\d\s*x\s*\d/i.test(t);
          return hasOperator || hasFn || hasRootOrPow || hasXMultiply;
        };

        // Una selección puede traer VARIAS operaciones a la vez (una por
        // línea, o separadas por dos o más espacios). Ya NO se corta por
        // coma/punto y coma: esos ahora son separadores decimales (3,5 = 3.5),
        // igual que en la normalización de AHK.
        const extractExpressions = (text) => {
          const parts = text
            .split(/[\r\n]+|\s{2,}/)
            .map((s) => s.trim())
            .filter(Boolean);

          const candidates = parts.length ? parts : [text.trim()];
          const exprs = candidates.filter(looksLikeMath);

          // Si nada individual "parece math" pero la selección completa sí
          // (ej: una sola operación con espacios simples, "4 + 5"), la
          // usamos entera como única expresión.
          if (!exprs.length && looksLikeMath(text)) return [text.trim()];
          return exprs;
        };

        // ---------- Ecuaciones y álgebra (librería nerdamer, sin API ni internet) ----------
        // nerdamer se carga con @require desde el userscript principal.
        const getNerd = () => (typeof nerdamer !== "undefined" ? nerdamer : window.nerdamer);

        const FN_WORDS = /(asin|acos|atan|sinh|cosh|tanh|sin|cos|tan|sqrt|cbrt|log10|log|ln|exp|abs|floor|ceil|round|factorial|pi)/g;
        const EQ_CHARSET = /^[0-9a-zA-Z.,;:()[\]{}+\-*/^%×÷•·π√∛⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻=\s\u2013\u2014\u2212]+$/;

        // Notación "humana" -> sintaxis de nerdamer (conserva las letras como variables).
        const normalizeEquation = (text) => {
          let b = text.replace(/\u200B/g, "").replace(/[\u2013\u2014\u2212]/g, "-");
          b = b.replace(/[×•·]/g, "*").replace(/÷/g, "/").replace(/π/g, "pi");
          b = b.replace(/√\(/g, "sqrt(").replace(/√(\d+(?:\.\d+)?|[a-z])/gi, "sqrt($1)");
          b = b.replace(/(\d+|[a-z]|\))([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+)/gi,
            (m, base, sup) => `${base}^(${[...sup].map((c) => SUPERSCRIPTS[c]).join("")})`);
          b = b.replace(/sen/gi, "sin");
          b = b.replace(/(\d),(\d)/g, "$1.$2");
          b = b.replace(/\s+/g, "");
          b = b.replace(/[\[{]/g, "(").replace(/[\]}]/g, ")");
          return b;
        };

        // Variables de una expresión ya normalizada. null = no parece matemática
        // (hay "palabras" de 2+ letras que no son funciones).
        const getVars = (norm) => {
          const rest = norm.toLowerCase().replace(FN_WORDS, "");
          if (/[a-z]{2,}/.test(rest)) return null;
          return [...new Set(rest.match(/[a-z]/g) || [])];
        };

        // "3 x 4" es multiplicación, no la variable x.
        const stripTimesX = (t) => t.replace(/(\d)\s*x\s*(?=\d)/gi, "$1*");

        const hasVariable = (text) => {
          if (!EQ_CHARSET.test(text) || text.length > 200) return false;
          const vars = getVars(normalizeEquation(stripTimesX(text)));
          return !!(vars && vars.length);
        };

        // Líneas que son ecuaciones: exactamente un "=" con algo a cada lado.
        const getEquationLines = (text) =>
          text.split(/[\r\n]+/).map((l) => l.trim()).filter((l) => {
            if (l.length > 200 || !EQ_CHARSET.test(l)) return false;
            const parts = l.split("=");
            if (parts.length !== 2) return false;
            if (!parts[0].trim() || !parts[1].trim()) return false;
            return getVars(normalizeEquation(l)) !== null;
          });

        const splitTop = (str) => {
          const out = []; let depth = 0, cur = "";
          for (const ch of str) {
            if (ch === "(" || ch === "[") depth++;
            if (ch === ")" || ch === "]") depth--;
            if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
          }
          if (cur) out.push(cur);
          return out.map((x) => x.trim()).filter(Boolean);
        };

        const stripOuterParens = (str) => {
          let t = str.trim();
          while (t.startsWith("(") && t.endsWith(")")) {
            let depth = 0, ok = true;
            for (let i = 0; i < t.length - 1; i++) {
              if (t[i] === "(") depth++;
              if (t[i] === ")") depth--;
              if (depth === 0) { ok = false; break; }
            }
            if (!ok) break;
            t = t.slice(1, -1);
          }
          return t;
        };

        const fmtNum = (n) => String(Number(n.toPrecision(10)));
        const isComplexStr = (str) => /(^|[^a-z])i([^a-z]|$)/i.test(str);

        const toDecimal = (nerd, str) => {
          try { return parseFloat(nerd(str).evaluate().text()); } catch { return NaN; }
        };

        // Muestra una solución: exacta si es "corta", y decimal si no es entera.
        const fmtSolution = (nerd, v, str) => {
          // Si la solución todavía depende de otras variables, no hay decimal:
          // solo se muestra expandida (ej: x = 3-3/2·y).
          if (/[a-z]/i.test(str.replace(FN_WORDS, ""))) {
            let ex = str;
            try { ex = String(nerd(str).expand()); } catch {}
            ex = stripOuterParens(ex).replace(/\*/g, "·");
            return { line: `${v} = ${ex}`, value: ex };
          }
          const exact = stripOuterParens(str).replace(/\*/g, "·");
          const dec = toDecimal(nerd, str);
          if (/^-?\d+$/.test(exact)) return { line: `${v} = ${exact}`, value: exact };
          if (Number.isFinite(dec)) {
            const bigFraction = /\d{7,}/.test(exact);
            const line = bigFraction ? `${v} ≈ ${fmtNum(dec)}` : `${v} = ${exact} ≈ ${fmtNum(dec)}`;
            return { line, value: fmtNum(dec) };
          }
          return { line: `${v} = ${exact}`, value: exact };
        };

        const solveSingleEquation = (nerd, raw) => {
          const norm = normalizeEquation(raw);
          const vars = getVars(norm);
          const [lhsRaw, rhsRaw] = raw.split("=");

          if (!vars.length) {
            const a = solveOne(lhsRaw).value, b = solveOne(rhsRaw).value;
            if (a === null || b === null) return [{ line: `${raw} → no pude interpretar`, value: null }];
            const ok = Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
            return [{ line: `${raw.trim()}  →  ${ok ? "✅ verdadero" : "❌ falso"}`, value: null }];
          }
          if (/sin|cos|tan/.test(norm)) {
            return [{ line: `${raw.trim()} → las ecuaciones trigonométricas aún no están soportadas`, value: null }];
          }

          const v = vars.includes("x") ? "x" : vars[0];
          const [lhs, rhs] = norm.split("=");
          const diff = `(${lhs})-(${rhs})`;
          const residual = (val) => {
            try { return Math.abs(parseFloat(nerd(diff, { [v]: String(val) }).evaluate().text())); }
            catch { return NaN; }
          };

          // Identidad (se cumple siempre): prueba con valores cualquiera
          if (vars.length === 1 && residual(1.7) < 1e-9 && residual(-2.9) < 1e-9 && residual(5.3) < 1e-9) {
            return [{ line: `${raw.trim()}  →  se cumple para cualquier ${v} (identidad)`, value: null }];
          }

          let sols;
          try {
            const res = nerd.solve(norm, v);
            sols = splitTop(String(res).replace(/^\[|\]$/g, ""));
          } catch (e) {
            if (/does not equal/i.test(String(e?.message))) {
              return [{ line: `${raw.trim()}  →  no tiene solución`, value: null }];
            }
            return [{ line: `${raw.trim()} → no pude resolverla`, value: null }];
          }

          const out = [];
          const seen = new Set();
          let sawComplex = false;
          for (const s of sols) {
            if (isComplexStr(s)) { sawComplex = true; continue; }
            // Si solo hay una variable, comprueba la solución sustituyéndola (descarta basura numérica)
            if (vars.length === 1) {
              const r = residual(`(${s})`);
              if (!(r < 1e-6)) continue;
            }
            const f = fmtSolution(nerd, v, s);
            const key = f.line;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(f);
          }
          if (!out.length) {
            return [{ line: `${raw.trim()}  →  ${sawComplex ? "no tiene solución real" : "no pude resolverla"}`, value: null }];
          }
          if (vars.length > 1) out.push({ line: `(despejado para ${v}; hay otras variables)`, value: null });
          return out;
        };

        const solveEquations = (eqLines) => {
          const nerd = getNerd();
          if (!nerd) return [{ line: "⚠️ Falta la librería nerdamer (revisa el @require en el userscript)", value: null }];

          const norms = eqLines.map(normalizeEquation);
          const allVars = [...new Set(norms.flatMap((n) => getVars(n) || []))];

          // Sistema: 2+ ecuaciones y 2+ variables
          if (eqLines.length >= 2 && allVars.length >= 2) {
            try {
              const res = nerd.solveEquations(norms);
              const pairs = Array.isArray(res[0]) ? res : [];
              if (!pairs.length) throw new Error("sin pares");
              return pairs.map(([name, val]) => fmtSolution(nerd, name, String(val)));
            } catch {
              return [{ line: "Sistema sin solución única o no pude resolverlo", value: null }];
            }
          }
          return eqLines.flatMap((l) => solveSingleEquation(nerd, l));
        };

        // Expresión algebraica sin "=" (ej: 2x+3x, (x+1)², x²-4)
        const simplifyAlgebra = (text) => {
          const nerd = getNerd();
          if (!nerd) return [{ line: "⚠️ Falta la librería nerdamer (revisa el @require en el userscript)", value: null }];
          try {
            const norm = normalizeEquation(stripTimesX(text));
            const simp = String(nerd(norm)).replace(/\*/g, "·");
            const expanded = String(nerd(norm).expand()).replace(/\*/g, "·");
            const factored = String(nerd(`factor(${norm})`)).replace(/\*/g, "·");
            const lines = [{ line: `Simplificada: ${simp}`, value: simp }];
            if (expanded !== simp) lines.push({ line: `Expandida: ${expanded}`, value: expanded });
            if (factored !== simp && factored !== expanded) lines.push({ line: `Factorizada: ${factored}`, value: factored });
            return lines;
          } catch {
            return [{ line: `${text.trim()} → no pude interpretar`, value: null }];
          }
        };

        // ---------- UI flotante ----------
        let icon = null;
        let bubble = null;

        const removeIcon = () => { icon?.remove(); icon = null; };
        const removeBubble = () => { bubble?.remove(); bubble = null; };
        const removeAll = () => { removeIcon(); removeBubble(); };

        const showIcon = (rect, text, expressions) => {
          removeAll();
          icon = document.createElement("div");
          icon.className = "mml-math-icon";
          icon.textContent = expressions.length > 1 ? "🧮×" + expressions.length : "🧮";
          icon.title = "Calcular / resolver selección";
          icon.style.left = `${Math.min(rect.right + 6, window.innerWidth - 32)}px`;
          icon.style.top = `${Math.max(rect.top - 4, 4)}px`;
          icon.dataset.mmlX = String(Math.min(rect.right + 6, window.innerWidth - 32));
          icon.dataset.mmlY = String(Math.max(rect.top - 4, 4));

          icon.addEventListener("mousedown", (e) => e.preventDefault()); // no perder la selección
          icon.addEventListener("click", (e) => {
            e.stopPropagation();
            analyzeAndShow(text);
          });

          document.body.appendChild(icon);
          window.__mmlStackIcons();
        };

        // Un double de JS solo garantiza ~15-17 cifras significativas. Si
        // algún número de la expresión trae más cifras que eso, o el
        // resultado supera el rango de enteros "seguros", el cálculo puede
        // no ser exacto — avisamos en vez de mostrarlo como si lo fuera.
        const hasPrecisionRisk = (expression, result) => {
          const nums = expression.match(/\d*\.?\d+/g) || [];
          for (const n of nums) {
            const digits = n.replace(".", "").replace(/^0+(?=\d)/, "");
            if (digits.length > 15) return true;
          }
          return Number.isFinite(result) && Math.abs(result) > Number.MAX_SAFE_INTEGER;
        };

        // Resuelve una sola expresión y arma su línea de resultado
        // + el valor numérico limpio (o null si no se pudo calcular).
        const solveOne = (expression) => {
          try {
            const normalized = normalizeExpression(expression);
            const result = solve(normalized);
            if (Number.isNaN(result)) throw new Error("No calculable");
            if (!Number.isFinite(result)) {
              return { line: `${expression.trim()} = no se puede calcular (¿÷0?)`, value: null };
            }
            // Limpia el ruido de punto flotante (ej: 0.1+0.2 = 0.30000000000000004)
            // redondeando a 12 cifras SIGNIFICATIVAS en vez de decimales fijos,
            // así funciona igual de bien con números chicos y grandes.
            const clean = Number.isInteger(result) ? result : parseFloat(result.toPrecision(12));
            let line = `${expression.trim()} = ${clean}`;
            if (hasPrecisionRisk(normalized, result)) line += " ⚠️";
            return { line, value: clean };
          } catch {
            return { line: `${expression.trim()} → no pude interpretar`, value: null };
          }
        };

        // Muestra una burbuja con varias líneas. `values` = lo que se copia al hacer click.
        const showBubble = (lines, values, plural) => {
          removeBubble();

          const text = lines.join("\n");
          const copyLabel = plural ? "Click para copiar los resultados" : "Click para copiar el resultado";

          bubble = document.createElement("div");
          bubble.className = "mml-math-bubble";
          const resultText = document.createElement("span");
          resultText.textContent = text;
          bubble.appendChild(resultText);
          if (values.length) {
            const resultSmall = document.createElement("small");
            resultSmall.textContent = copyLabel;
            bubble.appendChild(resultSmall);
          }

          const iconRect = icon?.getBoundingClientRect();
          const top = iconRect ? iconRect.bottom + 6 : 20;
          const left = iconRect ? Math.min(iconRect.left, window.innerWidth - 270) : 20;
          bubble.style.top = `${top}px`;
          bubble.style.left = `${Math.max(left, 4)}px`;

          bubble.addEventListener("mousedown", (e) => e.preventDefault());
          bubble.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (!values.length) return;
            try {
              await navigator.clipboard.writeText(values.join("\n"));
              bubble.textContent = "✅ Copiado";
              setTimeout(removeAll, 700);
            } catch {}
          });

          document.body.appendChild(bubble);
        };

        const showResult = (expressions) => {
          const results = expressions.map(solveOne);
          showBubble(
            results.map((r) => r.line),
            results.filter((r) => r.value !== null).map((r) => r.value),
            results.length > 1
          );
        };

        // Decide qué hacer con la selección: ecuación -> resolver; letras (álgebra)
        // -> simplificar; operación numérica -> calcular; otra cosa -> avisar.
        const cleanTrailingEquals = (t) => t.replace(/[ \t]*=[ \t]*\??[ \t]*$/gm, "");

        const analyzeAndShow = (text) => {
          const eqLines = getEquationLines(text);
          if (eqLines.length) {
            const res = solveEquations(eqLines);
            showBubble(res.map((r) => r.line), res.filter((r) => r.value !== null).map((r) => r.value), res.length > 1);
            return;
          }

          const cleaned = cleanTrailingEquals(text);
          if (hasVariable(cleaned)) {
            const res = simplifyAlgebra(cleaned);
            showBubble(res.map((r) => r.line), res.filter((r) => r.value !== null).map((r) => r.value), res.length > 1);
            return;
          }

          const expressions = extractExpressions(cleaned);
          if (expressions.length) {
            showResult(expressions);
            return;
          }

          showBubble(["No encontré una operación ni una ecuación en la selección"], [], false);
        };

        // ---------- Detección de selección ----------
        const onSelectionUp = (e) => {
          // Si el mouseup ocurrió sobre el ícono o la burbuja, no reprocesar
          // la selección: eso destruiría y recrearía el ícono antes de que
          // el navegador llegue a disparar el evento "click" sobre él.
          if (icon?.contains(e.target) || bubble?.contains(e.target)) return;

          const sel = window.getSelection();
          const text = sel?.toString().trim();

          // Ahora el ícono sale con CUALQUIER texto seleccionado; al hacer click
          // se decide si es operación, ecuación, expresión algebraica u otra cosa.
          if (!text || text.length > 2000) {
            removeAll();
            return;
          }

          try {
            const range = sel.getRangeAt(0);
            const rects = range.getClientRects();
            const rect = rects[rects.length - 1] || range.getBoundingClientRect();
            if (!rect || (rect.width === 0 && rect.height === 0)) return;
            showIcon(rect, text, extractExpressions(cleanTrailingEquals(text)));
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
