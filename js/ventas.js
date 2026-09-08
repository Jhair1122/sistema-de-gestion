let productosDisponibles = [];
let contadorItems = 0;

function productoPorId(id) {
  return productosDisponibles.find((p) => p.id === id);
}

function crearFilaItem() {
  contadorItems += 1;
  const idFila = `item-${contadorItems}`;
  const contenedor = document.querySelector("[data-items]");

  const opciones = productosDisponibles
    .filter((p) => p.stock > 0)
    .map((p) => `<option value="${p.id}">${p.nombre} (stock: ${p.stock})</option>`)
    .join("");

  const fila = document.createElement("div");
  fila.className = "fila-item";
  fila.dataset.fila = idFila;
  fila.innerHTML = `
    <select data-campo="producto" required>
      <option value="">Selecciona un producto…</option>
      ${opciones}
    </select>
    <input data-campo="cantidad" type="number" min="1" value="1" required />
    <span class="nums" data-subtotal>S/ 0.00</span>
    <button type="button" class="boton boton--peligro boton--pequeno" data-quitar-item>Quitar</button>
  `;
  contenedor.appendChild(fila);
  actualizarTotales();
}

function actualizarTotales() {
  let total = 0;
  document.querySelectorAll("[data-fila]").forEach((fila) => {
    const productoId = fila.querySelector('[data-campo="producto"]').value;
    const cantidad = Number(fila.querySelector('[data-campo="cantidad"]').value) || 0;
    const producto = productoPorId(productoId);
    const subtotal = producto ? producto.precio * cantidad : 0;
    fila.querySelector("[data-subtotal]").textContent = formatearMoneda(subtotal);
    total += subtotal;
  });
  const totalEl = document.querySelector("[data-venta-total]");
  totalEl.textContent = formatearMoneda(total);
  totalEl.style.color = "var(--menta-suave)";
}

async function cargarClientesParaVenta() {
  const clientes = await API.get("/clientes");
  const select = document.getElementById("v-cliente");
  select.innerHTML =
    '<option value="">Sin cliente</option>' +
    clientes.map((c) => `<option value="${c.id}">${c.nombre}</option>`).join("");
}

async function cargarProductosParaVenta() {
  productosDisponibles = await API.get("/productos");
}

async function cargarVentas() {
  const tabla = document.querySelector("[data-tabla-ventas]");
  pintarSkeletonTabla(tabla, 5, 4);

  const ventas = await API.get("/ventas");
  const clientes = await API.get("/clientes");
  const nombresClientes = Object.fromEntries(clientes.map((c) => [c.id, c.nombre]));

  if (!ventas.length) {
    pintarFilaVacia(tabla, 5, "Todavía no hay ventas registradas. Arma la primera arriba.");
    return;
  }

  tabla.innerHTML = ventas
    .map(
      (venta) => `
        <tr>
          <td>${formatearFecha(venta.creado_en)}</td>
          <td>${venta.cliente_id ? nombresClientes[venta.cliente_id] || "—" : "Sin cliente"}</td>
          <td class="num">${formatearMoneda(venta.total)}</td>
          <td><span class="insignia insignia--${venta.estado}">${venta.estado}</span></td>
          <td>
            <div class="acciones-fila">
              <button class="boton boton--fantasma boton--pequeno" data-ver="${venta.id}" type="button">Detalle</button>
              ${
                venta.estado === "completada"
                  ? `<button class="boton boton--peligro boton--pequeno" data-anular="${venta.id}" type="button">Anular</button>`
                  : ""
              }
            </div>
          </td>
        </tr>`
    )
    .join("");
}

async function verDetalleVenta(ventaId) {
  const dialogo = document.querySelector("[data-dialogo-detalle]");
  const tabla = document.querySelector("[data-tabla-detalle]");
  pintarSkeletonTabla(tabla, 3, 2);
  dialogo.showModal();

  try {
    const venta = await API.get(`/ventas/${ventaId}`);
    if (!venta.detalle.length) {
      pintarFilaVacia(tabla, 3, "Esta venta no tiene productos.");
      return;
    }
    tabla.innerHTML = venta.detalle
      .map((linea) => {
        const producto = productoPorId(linea.producto_id);
        return `
          <tr>
            <td>${producto ? producto.nombre : "(producto eliminado)"}</td>
            <td class="num">${linea.cantidad}</td>
            <td class="num">${formatearMoneda(linea.subtotal)}</td>
          </tr>`;
      })
      .join("");
  } catch (error) {
    pintarFilaVacia(tabla, 3, error.message);
  }
}

async function registrarVenta() {
  const errorEl = document.querySelector("[data-error]");
  errorEl.classList.add("oculto");

  const filas = Array.from(document.querySelectorAll("[data-fila]"));
  if (!filas.length) {
    notificar("error", "Agrega al menos un producto a la venta.");
    return;
  }

  const items = filas.map((fila) => ({
    producto_id: fila.querySelector('[data-campo="producto"]').value,
    cantidad: Number(fila.querySelector('[data-campo="cantidad"]').value),
  }));

  if (items.some((item) => !item.producto_id || !item.cantidad)) {
    notificar("error", "Revisa que todos los productos y cantidades estén completos.");
    return;
  }

  const clienteId = document.getElementById("v-cliente").value || null;

  await API.post("/ventas", { cliente_id: clienteId, items });
  notificar("exito", "Venta registrada. El stock ya se actualizó.");

  document.querySelector("[data-items]").innerHTML = "";
  document.getElementById("v-cliente").value = "";
  crearFilaItem();

  await cargarProductosParaVenta();
  await cargarVentas();
}

(async function iniciar() {
  const usuario = await protegerPagina();
  if (!usuario) return;

  const errorEl = document.querySelector("[data-error]");

  try {
    await cargarProductosParaVenta();
    await cargarClientesParaVenta();
    await cargarVentas();
    crearFilaItem();
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove("oculto");
    notificar("error", "No se pudieron cargar los datos de ventas: " + error.message);
    return;
  }

  document.querySelector("[data-agregar-item]").addEventListener("click", crearFilaItem);

  document.querySelector("[data-items]").addEventListener("input", actualizarTotales);
  document.querySelector("[data-items]").addEventListener("change", actualizarTotales);
  document.querySelector("[data-items]").addEventListener("click", (evento) => {
    if (evento.target.dataset.quitarItem !== undefined) {
      evento.target.closest("[data-fila]").remove();
      actualizarTotales();
    }
  });

  const formVenta = document.getElementById("form-venta");
  const botonVenta = formVenta.querySelector('button[type="submit"]');
  const enviarVenta = conBotonCargando(botonVenta, async () => {
    try {
      await registrarVenta();
    } catch (error) {
      notificar("error", error.message);
    }
  });
  formVenta.addEventListener("submit", (evento) => {
    evento.preventDefault();
    enviarVenta();
  });

  document.querySelector("[data-cerrar-detalle]").addEventListener("click", () =>
    document.querySelector("[data-dialogo-detalle]").close()
  );

  document.querySelector("[data-tabla-ventas]").addEventListener("click", async (evento) => {
    const idVer = evento.target.dataset.ver;
    const idAnular = evento.target.dataset.anular;

    if (idVer) await verDetalleVenta(idVer);

    if (idAnular) {
      if (!confirm("¿Anular esta venta? El stock vendido se repondrá.")) return;
      try {
        await API.post(`/ventas/${idAnular}/anular`);
        notificar("exito", "Venta anulada y stock repuesto.");
        await cargarProductosParaVenta();
        await cargarVentas();
      } catch (error) {
        notificar("error", error.message);
      }
    }
  });
})();
