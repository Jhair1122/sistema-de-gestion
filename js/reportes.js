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
  const query = construirQuery();
  const datos = await API.get(`/reportes/ventas${query}`);

  document.querySelector("[data-cantidad-ventas]").textContent = datos.cantidad_ventas;
  document.querySelector("[data-total-periodo]").textContent = formatearMoneda(datos.total_periodo);

  const tabla = document.querySelector("[data-tabla-reporte-ventas]");
  if (!datos.ventas.length) {
    tabla.innerHTML = '<tr class="tabla-vacia"><td colspan="3">No hay ventas en este periodo.</td></tr>';
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
  const query = construirQuery();
  const datos = await API.get(`/reportes/productos-mas-vendidos${query}`);

  const tabla = document.querySelector("[data-tabla-top-productos]");
  if (!datos.length) {
    tabla.innerHTML = '<tr class="tabla-vacia"><td colspan="3">No hay ventas en este periodo.</td></tr>';
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
  const query = construirQuery();
  const datos = await API.get(`/reportes/inventario${query}`);

  const tabla = document.querySelector("[data-tabla-reporte-inventario]");
  if (!datos.length) {
    tabla.innerHTML = '<tr class="tabla-vacia"><td colspan="4">No hay movimientos en este periodo.</td></tr>';
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
    await Promise.all([
      cargarReporteVentas(),
      cargarProductosMasVendidos(),
      cargarReporteInventario(),
    ]);
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove("oculto");
  }
}

(async function iniciar() {
  const usuario = await protegerPagina();
  if (!usuario) return;

  await cargarTodo();

  document.querySelector("[data-aplicar-filtro]").addEventListener("click", cargarTodo);
})();
