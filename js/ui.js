/*
  Utilidades de interfaz compartidas por todas las páginas. Cada una
  responde a algo real que está pasando (una petición, un error, una
  carga de datos) — ninguna es solo decoración.
*/

/* ---------------------- Notificaciones (toast) ---------------------- */
/* Reemplazan los antiguos banners estáticos: aparecen cuando algo pasa
   de verdad (una venta se registró, un guardado falló) y se apilan si
   hay varias, en vez de competir por el mismo espacio fijo. */

function asegurarPilaToasts() {
  let pila = document.querySelector("[data-toast-pila]");
  if (!pila) {
    pila = document.createElement("div");
    pila.className = "toast-pila";
    pila.setAttribute("data-toast-pila", "");
    document.body.appendChild(pila);
  }
  return pila;
}

const ICONOS_TOAST = { exito: "✓", error: "⚠", info: "ℹ" };

function notificar(tipo, mensaje, duracionMs = 4200) {
  const pila = asegurarPilaToasts();
  const toast = document.createElement("div");
  toast.className = `toast toast--${tipo === "exito" ? "exito" : tipo}`;
  toast.innerHTML = `
    <span class="toast__icono">${ICONOS_TOAST[tipo] || ICONOS_TOAST.info}</span>
    <span class="toast__texto"></span>
    <button class="toast__cerrar" type="button" aria-label="Cerrar">×</button>
  `;
  toast.querySelector(".toast__texto").textContent = mensaje;

  const quitar = () => {
    toast.classList.add("saliendo");
    setTimeout(() => toast.remove(), 250);
  };
  toast.querySelector(".toast__cerrar").addEventListener("click", quitar);
  const temporizador = setTimeout(quitar, duracionMs);
  toast.addEventListener("mouseenter", () => clearTimeout(temporizador));

  pila.appendChild(toast);
}

/* ---------------------- Estado de carga en botones ---------------------- */
/* Bloquea el botón y muestra un spinner mientras espera al servidor:
   evita envíos duplicados y confirma que el clic se registró, algo
   importante cuando el backend gratuito tarda en "despertar". */

function conBotonCargando(boton, tareaAsync) {
  return async (...args) => {
    if (!boton || boton.hasAttribute("data-cargando")) return;
    boton.setAttribute("data-cargando", "");
    boton.disabled = true;
    try {
      return await tareaAsync(...args);
    } finally {
      boton.removeAttribute("data-cargando");
      boton.disabled = false;
    }
  };
}

/* ---------------------- Onda al hacer clic ---------------------- */

function activarOndaBotones() {
  document.addEventListener("click", (evento) => {
    const boton = evento.target.closest(".boton");
    if (!boton) return;
    const rect = boton.getBoundingClientRect();
    const onda = document.createElement("span");
    const lado = Math.max(rect.width, rect.height);
    onda.className = "onda";
    onda.style.width = onda.style.height = `${lado}px`;
    onda.style.left = `${evento.clientX - rect.left - lado / 2}px`;
    onda.style.top = `${evento.clientY - rect.top - lado / 2}px`;
    boton.appendChild(onda);
    setTimeout(() => onda.remove(), 650);
  });
}

/* ---------------------- Inclinación 3D en tarjetas clave ---------------------- */
/* Solo para los bloques protagonistas (marcados con data-tilt): el
   resumen del panel y la vitrina de la portada. */

function activarInclinacion3D() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.querySelectorAll("[data-tilt]").forEach((tarjeta) => {
    tarjeta.addEventListener("mousemove", (evento) => {
      const rect = tarjeta.getBoundingClientRect();
      const x = (evento.clientX - rect.left) / rect.width - 0.5;
      const y = (evento.clientY - rect.top) / rect.height - 0.5;
      tarjeta.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
    });
    tarjeta.addEventListener("mouseleave", () => {
      tarjeta.style.transform = "";
    });
  });
}

/* ---------------------- Contador animado ---------------------- */
/* Anima un número REAL ya obtenido del servidor, de 0 hasta su valor
   final — no es un dato inventado, solo la forma en que aparece. */

function animarContador(elemento, valorFinal, { prefijo = "", decimales = 0 } = {}) {
  if (!elemento) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    elemento.textContent = `${prefijo}${valorFinal.toFixed(decimales)}`;
    return;
  }
  const duracion = 700;
  const inicio = performance.now();
  const desde = 0;

  function paso(ahora) {
    const progreso = Math.min((ahora - inicio) / duracion, 1);
    const suavizado = 1 - Math.pow(1 - progreso, 3);
    const valorActual = desde + (valorFinal - desde) * suavizado;
    elemento.textContent = `${prefijo}${valorActual.toFixed(decimales)}`;
    if (progreso < 1) requestAnimationFrame(paso);
  }
  requestAnimationFrame(paso);
}

/* ---------------------- Skeletons de carga ---------------------- */
/* Sustituye el "Cargando…" por filas de placeholder mientras llega la
   respuesta real; si la respuesta tarda, la persona ve que algo se
   está cargando en vez de una tabla congelada. */

function filaSkeleton(columnas) {
  const celdas = Array.from({ length: columnas })
    .map(() => `<td><span class="skeleton skeleton-linea"></span></td>`)
    .join("");
  return `<tr class="skeleton-fila">${celdas}</tr>`;
}

function pintarSkeletonTabla(tbody, columnas, filas = 3) {
  if (!tbody) return;
  tbody.innerHTML = Array.from({ length: filas }).map(() => filaSkeleton(columnas)).join("");
}

/* ---------------------- Estado vacío con acción ---------------------- */
/* Una fila vacía nunca es solo un texto: siempre sugiere qué hacer. */

function filaVacia(columnas, mensaje, { textoBoton = null, accion = null } = {}) {
  const boton = textoBoton
    ? `<div style="margin-top:0.9rem"><button type="button" class="boton boton--pequeno" data-accion-vacio>${textoBoton}</button></div>`
    : "";
  const html = `<tr><td colspan="${columnas}"><div class="tabla-vacia"><p>${mensaje}</p>${boton}</div></td></tr>`;
  return { html, accion };
}

function pintarFilaVacia(tbody, columnas, mensaje, opciones = {}) {
  if (!tbody) return;
  const { html, accion } = filaVacia(columnas, mensaje, opciones);
  tbody.innerHTML = html;
  if (accion) {
    tbody.querySelector("[data-accion-vacio]")?.addEventListener("click", accion);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  activarOndaBotones();
  activarInclinacion3D();
});
