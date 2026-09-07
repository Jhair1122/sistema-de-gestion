(async function iniciar() {
  const usuario = await protegerPagina();
  if (!usuario) return;

  const errorEl = document.querySelector("[data-error]");
  const tabla = document.querySelector("[data-tabla-recientes]");

  try {
    const resumen = await API.get("/dashboard/resumen");

    document.querySelector("[data-ventas-hoy-total]").textContent = formatearMoneda(
      resumen.ventas_hoy.total
    );
    document.querySelector("[data-ventas-mes-total]").textContent = formatearMoneda(
      resumen.ventas_mes.total
    );
    document.querySelector("[data-total-productos]").textContent = resumen.total_productos;
    document.querySelector("[data-stock-bajo]").textContent = resumen.productos_stock_bajo;
    document.querySelector("[data-total-clientes]").textContent = resumen.total_clientes;

    if (!resumen.ventas_recientes.length) {
      tabla.innerHTML = '<tr class="tabla-vacia"><td colspan="3">Todavía no registras ventas.</td></tr>';
      return;
    }

    tabla.innerHTML = resumen.ventas_recientes
      .map(
        (venta) => `
          <tr>
            <td>${formatearFecha(venta.creado_en)}</td>
            <td class="num">${formatearMoneda(venta.total)}</td>
            <td><span class="insignia insignia--${venta.estado}">${venta.estado}</span></td>
          </tr>`
      )
      .join("");
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove("oculto");
  }
})();
