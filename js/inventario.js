let productosInventario = [];

function insigniaEstado(producto) {
  if (producto.stock === 0) return { clase: "agotado", texto: "Agotado" };
  if (producto.stock <= producto.stock_minimo) return { clase: "bajo", texto: "Stock bajo" };
  return { clase: "normal", texto: "Normal" };
}

async function cargarResumen() {
  const resumen = await API.get("/inventario/resumen");
  productosInventario = [...resumen.agotado, ...resumen.bajo, ...resumen.normal];

  document.querySelector("[data-total-productos]").textContent = resumen.total_productos;
  document.querySelector("[data-total-bajo]").textContent = resumen.bajo.length;
  document.querySelector("[data-total-agotado]").textContent = resumen.agotado.length;

  const tabla = document.querySelector("[data-tabla-stock]");
  if (!productosInventario.length) {
    tabla.innerHTML = '<tr class="tabla-vacia"><td colspan="4">Todavía no tienes productos.</td></tr>';
    return;
  }

  const ordenados = [...resumen.agotado, ...resumen.bajo, ...resumen.normal];
  tabla.innerHTML = ordenados
    .map((producto) => {
      const estado = insigniaEstado(producto);
      return `
        <tr>
          <td>${producto.nombre}</td>
          <td class="num">${producto.stock}</td>
          <td class="num">${producto.stock_minimo}</td>
          <td><span class="insignia insignia--${estado.clase}">${estado.texto}</span></td>
        </tr>`;
    })
    .join("");

  const selectProducto = document.getElementById("m-producto");
  selectProducto.innerHTML = productosInventario
    .map((p) => `<option value="${p.id}">${p.nombre} (stock actual: ${p.stock})</option>`)
    .join("");
}

async function cargarMovimientos() {
  const movimientos = await API.get("/inventario/movimientos");
  const nombres = Object.fromEntries(productosInventario.map((p) => [p.id, p.nombre]));

  const tabla = document.querySelector("[data-tabla-movimientos]");
  if (!movimientos.length) {
    tabla.innerHTML = '<tr class="tabla-vacia"><td colspan="6">Todavía no hay movimientos registrados.</td></tr>';
    return;
  }

  tabla.innerHTML = movimientos
    .slice(0, 30)
    .map(
      (mov) => `
        <tr>
          <td>${formatearFecha(mov.creado_en)}</td>
          <td>${nombres[mov.producto_id] || "—"}</td>
          <td>${mov.tipo}</td>
          <td class="num">${mov.cantidad}</td>
          <td class="num">${mov.stock_resultante}</td>
          <td>${mov.motivo || "—"}</td>
        </tr>`
    )
    .join("");
}

function actualizarEtiquetaCantidad() {
  const tipo = document.getElementById("m-tipo").value;
  const etiqueta = document.querySelector("[data-etiqueta-cantidad]");
  etiqueta.textContent = tipo === "AJUSTE" ? "Nuevo stock exacto" : "Cantidad";
}

async function manejarEnvioMovimiento(evento) {
  evento.preventDefault();
  const formulario = evento.target;
  const errorEl = document.querySelector("[data-error]");
  const exitoEl = document.querySelector("[data-exito]");
  errorEl.classList.add("oculto");
  exitoEl.classList.add("oculto");

  try {
    await API.post("/inventario/movimientos", {
      producto_id: formulario.elements.producto_id.value,
      tipo: formulario.elements.tipo.value,
      cantidad: Number(formulario.elements.cantidad.value),
      motivo: formulario.elements.motivo.value.trim(),
    });
    document.querySelector("[data-dialogo-movimiento]").close();
    formulario.reset();
    exitoEl.textContent = "Movimiento registrado.";
    exitoEl.classList.remove("oculto");
    await cargarResumen();
    await cargarMovimientos();
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove("oculto");
  }
}

(async function iniciar() {
  const usuario = await protegerPagina();
  if (!usuario) return;

  const errorEl = document.querySelector("[data-error]");

  try {
    await cargarResumen();
    await cargarMovimientos();
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove("oculto");
    return;
  }

  document.querySelector("[data-abrir-movimiento]")?.addEventListener("click", () => {
    actualizarEtiquetaCantidad();
    document.querySelector("[data-dialogo-movimiento]").showModal();
  });
  document.querySelector("[data-cerrar-movimiento]").addEventListener("click", () =>
    document.querySelector("[data-dialogo-movimiento]").close()
  );
  document.getElementById("m-tipo").addEventListener("change", actualizarEtiquetaCantidad);
  document.getElementById("form-movimiento").addEventListener("submit", manejarEnvioMovimiento);
})();
