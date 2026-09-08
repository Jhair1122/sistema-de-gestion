function construirQuery() {
  const desde = document.getElementById("r-desde").value;
  const hasta = document.getElementById("r-hasta").value;
  const parametros = new URLSearchParams();
  if (desde) parametros.set("desde", desde);
  if (hasta) parametros.set("hasta", hasta);
  const cadena = parametros.toString();
  return cadena ? `?${cadena}` : "";
}

async function cargarReporteVentas() {
  const tabla = document.querySelector("[data-tabla-reporte-ventas]");
  pintarSkeletonTabla(tabla, 3, 3);

  const query = construirQuery();
  const datos = await API.get(`/reportes/ventas${query}`);

  animarContador(document.querySelector("[data-cantidad-ventas]"), datos.cantidad_ventas);
  animarContador(document.querySelector("[data-total-periodo]"), datos.total_periodo, { prefijo: "S/ ", decimales: 2 });

  if (!datos.ventas.length) {
    pintarFilaVacia(tabla, 3, "No hay ventas en este periodo.");
    return;
  }

  tabla.innerHTML = datos.ventas
    .map(
      (venta) => `
        <tr>
          <td>${formatearFecha(venta.creado_en)}</td>
          <td class="num">${formatearMoneda(venta.total)}</td>
          <td><span class="insignia insignia--${venta.estado}">${venta.estado}</span></td>
        </tr>`
    )
    .join("");
}

async function cargarProductosMasVendidos() {
  const tabla = document.querySelector("[data-tabla-top-productos]");
  pintarSkeletonTabla(tabla, 3, 3);

  const query = construirQuery();
  const datos = await API.get(`/reportes/productos-mas-vendidos${query}`);

  if (!datos.length) {
    pintarFilaVacia(tabla, 3, "No hay ventas en este periodo.");
    return;
  }

  tabla.innerHTML = datos
    .map(
      (item) => `
        <tr>
          <td>${item.nombre}</td>
          <td class="num">${item.cantidad_vendida}</td>
          <td class="num">${formatearMoneda(item.total_vendido)}</td>
        </tr>`
    )
    .join("");
}

async function cargarReporteInventario() {
  const tabla = document.querySelector("[data-tabla-reporte-inventario]");
  pintarSkeletonTabla(tabla, 4, 3);

  const query = construirQuery();
  const datos = await API.get(`/reportes/inventario${query}`);

  if (!datos.length) {
    pintarFilaVacia(tabla, 4, "No hay movimientos en este periodo.");
    return;
  }

  tabla.innerHTML = datos
    .slice(0, 50)
    .map(
      (mov) => `
        <tr>
          <td>${formatearFecha(mov.creado_en)}</td>
          <td>${mov.tipo}</td>
          <td class="num">${mov.cantidad}</td>
          <td class="num">${mov.stock_resultante}</td>
        </tr>`
    )
    .join("");
}

async function cargarTodo() {
  const errorEl = document.querySelector("[data-error]");
  errorEl.classList.add("oculto");
  try {
    await Promise.all([cargarReporteVentas(), cargarProductosMasVendidos(), cargarReporteInventario()]);
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove("oculto");
    notificar("error", "No se pudo cargar el reporte: " + error.message);
  }
}

(async function iniciar() {
  const usuario = await protegerPagina();
  if (!usuario) return;

  await cargarTodo();

  const botonFiltro = document.querySelector("[data-aplicar-filtro]");
  const aplicarFiltro = conBotonCargando(botonFiltro, cargarTodo);
  botonFiltro.addEventListener("click", aplicarFiltro);
})();
