# ⚙️ Multi Modules Lite

**Última actualización:** 15 de junio de 2026

![Tampermonkey](https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/GUI.png)

**Multi Modules Lite** es un framework modular para Tampermonkey que permite activar y desactivar funciones independientes desde un panel flotante.

Incluye herramientas para desbloquear páginas web, seleccionar texto dentro de enlaces, detectar imágenes protegidas y agregar funciones extra a YouTube.

---

## ✨ Características

### 🔓 Ultra Unlock

Restaura funciones bloqueadas por páginas web:

* Permite seleccionar texto.
* Elimina `user-select: none`.
* Habilita copiar contenido protegido.
* Desbloquea eventos comunes como:

  * `copy`
  * `cut`
  * `paste`
  * `contextmenu`
  * `selectstart`

---

### 🖼 Image Tooltip Pro

Detecta imágenes incluso cuando están protegidas.

Características:

* Detecta imágenes `<img>`.
* Detecta imágenes SVG.
* Detecta `background-image`.
* Muestra la URL real.
* Cuenta regresiva visual.
* Copia automática al portapapeles después de 10 segundos.
* Confirmación visual al copiar.

---

### 🔗 Link Select

Permite seleccionar texto dentro de enlaces sin abrirlos.

Características:

* Selección estilo Opera.
* Compatible con:

  * Ctrl + selección
  * Shift + selección
  * Selección extendida
* Evita clics accidentales al seleccionar.

---

### 🖱 Context Menu

* Restaura el clic derecho.
* Evita bloqueos simples del menú contextual.

---

### 🧩 Iframe Unlock

* Permite interactuar con iframes.
* Restaura eventos del mouse sobre contenido embebido.

---

# 🎬 Módulos para YouTube

### ⏩ Speed Button

Agrega un botón para cambiar la velocidad de reproducción:

* 1×
* 1.5×
* 2×

Integrado directamente en los controles de YouTube.

---

### 🔊 Volume Boost

Control de volumen avanzado:

* Ajustable entre 100% y 300%.
* Usa Web Audio API.
* Guarda la configuración automáticamente.
* Funciona entre cambios de video.

---

### 💬 Toggle Comments

Permite ocultar o mostrar comentarios con un solo botón.

Características:

* Botón integrado en YouTube.
* Guarda el estado.
* Compatible con la navegación SPA de YouTube.

---

## 🛠 Instalación

1. Instala Tampermonkey.
2. Instala el script:

👉 **[Descargar Script](https://github.com/wernser412/Multi-Modules-lite/raw/refs/heads/main/Multi%20Modules%20Lite.user.js)**

---

## ⚙ Panel Modular

El script incluye un panel flotante con:

* Activación/desactivación por módulo.
* Configuración persistente.
* Diseño minimalista.
* Apertura mediante botón ⚙.

---

## 📦 Módulos incluidos

| Módulo                  | Estado |
| ----------------------- | ------ |
| Ultra Unlock            | ✔      |
| Image Tooltip Pro       | ✔      |
| Link Select             | ✔      |
| Context Menu            | ✔      |
| Iframe Unlock           | ✔      |
| YouTube Speed Button    | ✔      |
| YouTube Volume Boost    | ✔      |
| YouTube Toggle Comments | ✔      |

---

## 🧠 Notas técnicas

* Ejecuta en `document-start`.
* Arquitectura modular.
* Configuración persistente mediante `GM_getValue` y `GM_setValue`.
* Compatible con navegación SPA.
* Zero tracking.

---

## 📄 Licencia

MIT

---

## 💬 Autor

**wernser412**

Un solo script, múltiples módulos.
Activa solo lo que necesites.
