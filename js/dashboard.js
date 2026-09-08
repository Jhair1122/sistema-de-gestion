(async function iniciar() {
  const usuario = await protegerPagina();
  if (!usuario) return;

  const errorEl = document.querySelector("[data-error]");
  const tabla = document.querySelector("[data-tabla-recientes]");
  pintarSkeletonTabla(tabla, 3, 4);

  try {
    const resumen = await API.get("/dashboard/resumen");

    animarContador(document.querySelector("[data-ventas-hoy-total]"), resumen.ventas_hoy.total, { prefijo: "S/ ", decimales: 2 });
    animarContador(document.querySelector("[data-ventas-mes-total]"), resumen.ventas_mes.total, { prefijo: "S/ ", decimales: 2 });
    animarContador(document.querySelector("[data-total-productos]"), resumen.total_productos);
    animarContador(document.querySelector("[data-stock-bajo]"), resumen.productos_stock_bajo);
    animarContador(document.querySelector("[data-total-clientes]"), resumen.total_clientes);

    if (!resumen.ventas_recientes.length) {
      pintarFilaVacia(tabla, 3, "Todavía no registras ventas.", {
        textoBoton: "Registrar la primera venta",
        accion: () => (window.location.href = "/ventas.html"),
      });
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
    notificar("error", "No se pudo cargar el panel: " + error.message);
  }
})();
