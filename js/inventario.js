let productosInventario = [];

function insigniaEstado(producto) {
  if (producto.stock === 0) return { clase: "agotado", texto: "Agotado" };
  if (producto.stock <= producto.stock_minimo) return { clase: "bajo", texto: "Stock bajo" };
  return { clase: "normal", texto: "Normal" };
}

async function cargarResumen() {
  const tabla = document.querySelector("[data-tabla-stock]");
  pintarSkeletonTabla(tabla, 4, 4);

  const resumen = await API.get("/inventario/resumen");
  productosInventario = [...resumen.agotado, ...resumen.bajo, ...resumen.normal];

  animarContador(document.querySelector("[data-total-productos]"), resumen.total_productos);
  animarContador(document.querySelector("[data-total-bajo]"), resumen.bajo.length);
  animarContador(document.querySelector("[data-total-agotado]"), resumen.agotado.length);

  if (!productosInventario.length) {
    pintarFilaVacia(tabla, 4, "Todavía no tienes productos registrados.", {
      textoBoton: "Ir a Productos",
      accion: () => (window.location.href = "/productos.html"),
    });
  } else {
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
  }

  const selectProducto = document.getElementById("m-producto");
  selectProducto.innerHTML = productosInventario
    .map((p) => `<option value="${p.id}">${p.nombre} (stock actual: ${p.stock})</option>`)
    .join("");
}

async function cargarMovimientos() {
  const tabla = document.querySelector("[data-tabla-movimientos]");
  pintarSkeletonTabla(tabla, 6, 4);

  const movimientos = await API.get("/inventario/movimientos");
  const nombres = Object.fromEntries(productosInventario.map((p) => [p.id, p.nombre]));

  if (!movimientos.length) {
    pintarFilaVacia(tabla, 6, "Todavía no hay movimientos registrados.");
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

async function registrarMovimiento(formulario) {
  await API.post("/inventario/movimientos", {
    producto_id: formulario.elements.producto_id.value,
    tipo: formulario.elements.tipo.value,
    cantidad: Number(formulario.elements.cantidad.value),
    motivo: formulario.elements.motivo.value.trim(),
  });
  document.querySelector("[data-dialogo-movimiento]").close();
  formulario.reset();
  notificar("exito", "Movimiento registrado y stock actualizado.");
  await cargarResumen();
  await cargarMovimientos();
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
    notificar("error", "No se pudo cargar el inventario: " + error.message);
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

  const formMovimiento = document.getElementById("form-movimiento");
  const botonMovimiento = formMovimiento.querySelector('button[type="submit"]');
  const enviarMovimiento = conBotonCargando(botonMovimiento, async () => {
    try {
      await registrarMovimiento(formMovimiento);
    } catch (error) {
      notificar("error", error.message);
    }
  });
  formMovimiento.addEventListener("submit", (evento) => {
    evento.preventDefault();
    enviarMovimiento();
  });
})();
