let clientes = [];

function pintarTablaClientes() {
  const tabla = document.querySelector("[data-tabla-clientes]");
  const texto = document.getElementById("buscar-cliente").value.trim().toLowerCase();

  const filtrados = clientes.filter((c) => !texto || c.nombre.toLowerCase().includes(texto));

  if (!filtrados.length) {
    tabla.innerHTML = '<tr class="tabla-vacia"><td colspan="5">No hay clientes que coincidan.</td></tr>';
    return;
  }

  tabla.innerHTML = filtrados
    .map(
      (cliente) => `
        <tr>
          <td>${cliente.nombre}</td>
          <td>${cliente.documento || "—"}</td>
          <td>${cliente.telefono || "—"}</td>
          <td>${cliente.email || "—"}</td>
          <td>
            <div class="acciones-fila">
              <button class="boton boton--fantasma boton--pequeno" data-historial="${cliente.id}" type="button">Historial</button>
              <button class="boton boton--fantasma boton--pequeno" data-editar="${cliente.id}" type="button">Editar</button>
              <button class="boton boton--peligro boton--pequeno solo-admin" data-desactivar="${cliente.id}" type="button">Desactivar</button>
            </div>
          </td>
        </tr>`
    )
    .join("");
}

async function cargarClientes() {
  clientes = await API.get("/clientes");
  pintarTablaClientes();
}

function abrirDialogoCliente(cliente = null) {
  const dialogo = document.querySelector("[data-dialogo-cliente]");
  const formulario = document.getElementById("form-cliente");
  formulario.reset();

  document.querySelector("[data-titulo-cliente]").textContent = cliente
    ? "Editar cliente"
    : "Nuevo cliente";

  formulario.elements.id.value = cliente ? cliente.id : "";
  if (cliente) {
    formulario.elements.nombre.value = cliente.nombre;
    formulario.elements.documento.value = cliente.documento || "";
    formulario.elements.telefono.value = cliente.telefono || "";
    formulario.elements.email.value = cliente.email || "";
    formulario.elements.direccion.value = cliente.direccion || "";
  }

  dialogo.showModal();
}

async function manejarEnvioCliente(evento) {
  evento.preventDefault();
  const formulario = evento.target;
  const id = formulario.elements.id.value;
  const errorEl = document.querySelector("[data-error]");
  errorEl.classList.add("oculto");

  const cuerpo = {
    nombre: formulario.elements.nombre.value.trim(),
    documento: formulario.elements.documento.value.trim(),
    telefono: formulario.elements.telefono.value.trim(),
    email: formulario.elements.email.value.trim(),
    direccion: formulario.elements.direccion.value.trim(),
  };

  try {
    if (id) {
      await API.put(`/clientes/${id}`, cuerpo);
    } else {
      await API.post("/clientes", cuerpo);
    }
    document.querySelector("[data-dialogo-cliente]").close();
    await cargarClientes();
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove("oculto");
  }
}

async function abrirHistorial(clienteId) {
  const cliente = clientes.find((c) => c.id === clienteId);
  const dialogo = document.querySelector("[data-dialogo-historial]");
  const tabla = document.querySelector("[data-tabla-historial]");
  document.querySelector("[data-titulo-historial]").textContent = `Historial de ${cliente.nombre}`;
  tabla.innerHTML = '<tr class="tabla-vacia"><td colspan="3">Cargando…</td></tr>';
  dialogo.showModal();

  try {
    const ventas = await API.get(`/clientes/${clienteId}/ventas`);
    if (!ventas.length) {
      tabla.innerHTML = '<tr class="tabla-vacia"><td colspan="3">Este cliente no tiene compras registradas.</td></tr>';
      return;
    }
    tabla.innerHTML = ventas
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
    tabla.innerHTML = `<tr class="tabla-vacia"><td colspan="3">${error.message}</td></tr>`;
  }
}

(async function iniciar() {
  const usuario = await protegerPagina();
  if (!usuario) return;

  const errorEl = document.querySelector("[data-error]");

  try {
    await cargarClientes();
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove("oculto");
    return;
  }

  document.getElementById("buscar-cliente").addEventListener("input", pintarTablaClientes);

  document.querySelector("[data-abrir-cliente]").addEventListener("click", () => abrirDialogoCliente());
  document.querySelector("[data-cerrar-cliente]").addEventListener("click", () =>
    document.querySelector("[data-dialogo-cliente]").close()
  );
  document.getElementById("form-cliente").addEventListener("submit", manejarEnvioCliente);
  document.querySelector("[data-cerrar-historial]").addEventListener("click", () =>
    document.querySelector("[data-dialogo-historial]").close()
  );

  document.querySelector("[data-tabla-clientes]").addEventListener("click", async (evento) => {
    const idHistorial = evento.target.dataset.historial;
    const idEditar = evento.target.dataset.editar;
    const idDesactivar = evento.target.dataset.desactivar;

    if (idHistorial) await abrirHistorial(idHistorial);

    if (idEditar) {
      const cliente = clientes.find((c) => c.id === idEditar);
      abrirDialogoCliente(cliente);
    }

    if (idDesactivar) {
      if (!confirm("¿Desactivar este cliente?")) return;
      try {
        await API.delete(`/clientes/${idDesactivar}`);
        await cargarClientes();
      } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove("oculto");
      }
    }
  });
})();
