let clientes = [];

function pintarTablaClientes() {
  const tabla = document.querySelector("[data-tabla-clientes]");
  const texto = document.getElementById("buscar-cliente").value.trim().toLowerCase();
  const filtrados = clientes.filter((c) => !texto || c.nombre.toLowerCase().includes(texto));

  if (!clientes.length) {
    pintarFilaVacia(tabla, 5, "Todavía no registras clientes.", {
      textoBoton: "Agregar el primer cliente",
      accion: () => abrirDialogoCliente(),
    });
    return;
  }

  if (!filtrados.length) {
    pintarFilaVacia(tabla, 5, "No hay clientes que coincidan con esa búsqueda.");
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
  const tabla = document.querySelector("[data-tabla-clientes]");
  pintarSkeletonTabla(tabla, 5, 4);
  clientes = await API.get("/clientes");
  pintarTablaClientes();
}

function abrirDialogoCliente(cliente = null) {
  const dialogo = document.querySelector("[data-dialogo-cliente]");
  const formulario = document.getElementById("form-cliente");
  formulario.reset();

  document.querySelector("[data-titulo-cliente]").textContent = cliente ? "Editar cliente" : "Nuevo cliente";

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

async function guardarCliente(formulario) {
  const id = formulario.elements.id.value;
  const cuerpo = {
    nombre: formulario.elements.nombre.value.trim(),
    documento: formulario.elements.documento.value.trim(),
    telefono: formulario.elements.telefono.value.trim(),
    email: formulario.elements.email.value.trim(),
    direccion: formulario.elements.direccion.value.trim(),
  };

  if (id) {
    await API.put(`/clientes/${id}`, cuerpo);
    notificar("exito", `"${cuerpo.nombre}" se actualizó correctamente.`);
  } else {
    await API.post("/clientes", cuerpo);
    notificar("exito", `"${cuerpo.nombre}" se agregó a tus clientes.`);
  }
  document.querySelector("[data-dialogo-cliente]").close();
  await cargarClientes();
}

async function abrirHistorial(clienteId) {
  const cliente = clientes.find((c) => c.id === clienteId);
  const dialogo = document.querySelector("[data-dialogo-historial]");
  const tabla = document.querySelector("[data-tabla-historial]");
  document.querySelector("[data-titulo-historial]").textContent = `Historial de ${cliente.nombre}`;
  pintarSkeletonTabla(tabla, 3, 2);
  dialogo.showModal();

  try {
    const ventas = await API.get(`/clientes/${clienteId}/ventas`);
    if (!ventas.length) {
      pintarFilaVacia(tabla, 3, "Este cliente todavía no tiene compras registradas.");
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
    pintarFilaVacia(tabla, 3, error.message);
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
    notificar("error", "No se pudo cargar la lista de clientes: " + error.message);
    return;
  }

  document.getElementById("buscar-cliente").addEventListener("input", pintarTablaClientes);

  document.querySelector("[data-abrir-cliente]").addEventListener("click", () => abrirDialogoCliente());
  document.querySelector("[data-cerrar-cliente]").addEventListener("click", () =>
    document.querySelector("[data-dialogo-cliente]").close()
  );

  const formCliente = document.getElementById("form-cliente");
  const botonCliente = formCliente.querySelector('button[type="submit"]');
  const enviarCliente = conBotonCargando(botonCliente, async () => {
    try {
      await guardarCliente(formCliente);
    } catch (error) {
      notificar("error", error.message);
    }
  });
  formCliente.addEventListener("submit", (evento) => {
    evento.preventDefault();
    enviarCliente();
  });

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
        notificar("exito", "Cliente desactivado.");
        await cargarClientes();
      } catch (error) {
        notificar("error", error.message);
      }
    }
  });
})();
