let categorias = [];
let productos = [];

function estadoStock(producto) {
  if (producto.stock === 0) return { clase: "agotado", texto: "Agotado" };
  if (producto.stock <= producto.stock_minimo) return { clase: "bajo", texto: "Stock bajo" };
  return { clase: "normal", texto: "Normal" };
}

function nombreCategoria(categoriaId) {
  const categoria = categorias.find((c) => c.id === categoriaId);
  return categoria ? categoria.nombre : "Sin categoría";
}

function pintarSelectCategorias() {
  const filtro = document.getElementById("filtro-categoria");
  const delFormulario = document.getElementById("p-categoria");

  const opciones = categorias
    .map((c) => `<option value="${c.id}">${c.nombre}</option>`)
    .join("");

  filtro.innerHTML = '<option value="">Todas</option>' + opciones;
  delFormulario.innerHTML = '<option value="">Sin categoría</option>' + opciones;
}

function pintarTablaProductos() {
  const tabla = document.querySelector("[data-tabla-productos]");
  const texto = document.getElementById("buscar-producto").value.trim().toLowerCase();
  const categoriaId = document.getElementById("filtro-categoria").value;

  const filtrados = productos.filter((p) => {
    const coincideTexto = !texto || p.nombre.toLowerCase().includes(texto);
    const coincideCategoria = !categoriaId || p.categoria_id === categoriaId;
    return coincideTexto && coincideCategoria;
  });

  if (!productos.length) {
    pintarFilaVacia(tabla, 6, "Aún no tienes productos en tu catálogo.", {
      textoBoton: "Agregar el primer producto",
      accion: () => abrirDialogoProducto(),
    });
    return;
  }

  if (!filtrados.length) {
    pintarFilaVacia(tabla, 6, "No hay productos que coincidan con ese filtro.");
    return;
  }

  tabla.innerHTML = filtrados
    .map((producto) => {
      const estado = estadoStock(producto);
      return `
        <tr>
          <td>${producto.nombre}</td>
          <td>${nombreCategoria(producto.categoria_id)}</td>
          <td class="num">${formatearMoneda(producto.precio)}</td>
          <td class="num">${producto.stock}</td>
          <td><span class="insignia insignia--${estado.clase}">${estado.texto}</span></td>
          <td class="solo-admin">
            <div class="acciones-fila">
              <button class="boton boton--fantasma boton--pequeno" data-editar="${producto.id}" type="button">Editar</button>
              <button class="boton boton--peligro boton--pequeno" data-desactivar="${producto.id}" type="button">Desactivar</button>
            </div>
          </td>
        </tr>`;
    })
    .join("");
}

async function cargarCategorias() {
  categorias = await API.get("/categorias");
  pintarSelectCategorias();
}

async function cargarProductos() {
  const tabla = document.querySelector("[data-tabla-productos]");
  pintarSkeletonTabla(tabla, 6, 4);
  productos = await API.get("/productos");
  pintarTablaProductos();
}

function abrirDialogoProducto(producto = null) {
  const dialogo = document.querySelector("[data-dialogo-producto]");
  const formulario = document.getElementById("form-producto");
  formulario.reset();

  const esEdicion = Boolean(producto);
  document.querySelector("[data-titulo-producto]").textContent = esEdicion
    ? "Editar producto"
    : "Nuevo producto";
  document.querySelector("[data-solo-nuevo]").classList.toggle("oculto", esEdicion);

  formulario.elements.id.value = esEdicion ? producto.id : "";
  if (esEdicion) {
    formulario.elements.nombre.value = producto.nombre;
    formulario.elements.categoria_id.value = producto.categoria_id || "";
    formulario.elements.descripcion.value = producto.descripcion || "";
    formulario.elements.precio.value = producto.precio;
    formulario.elements.stock_minimo.value = producto.stock_minimo;
  }

  dialogo.showModal();
}

async function guardarProducto(formulario) {
  const id = formulario.elements.id.value;
  const cuerpoBase = {
    nombre: formulario.elements.nombre.value.trim(),
    categoria_id: formulario.elements.categoria_id.value || null,
    descripcion: formulario.elements.descripcion.value.trim(),
    precio: Number(formulario.elements.precio.value),
    stock_minimo: Number(formulario.elements.stock_minimo.value),
  };

  if (id) {
    await API.put(`/productos/${id}`, cuerpoBase);
    notificar("exito", `"${cuerpoBase.nombre}" se actualizó correctamente.`);
  } else {
    await API.post("/productos", { ...cuerpoBase, stock: Number(formulario.elements.stock.value) });
    notificar("exito", `"${cuerpoBase.nombre}" se agregó al catálogo.`);
  }
  document.querySelector("[data-dialogo-producto]").close();
  await cargarProductos();
}

async function guardarCategoria(formulario) {
  const nombre = formulario.elements.nombre.value.trim();
  await API.post("/categorias", {
    nombre,
    descripcion: formulario.elements.descripcion.value.trim(),
  });
  notificar("exito", `Categoría "${nombre}" creada.`);
  document.querySelector("[data-dialogo-categoria]").close();
  formulario.reset();
  await cargarCategorias();
  pintarTablaProductos();
}

(async function iniciar() {
  const usuario = await protegerPagina();
  if (!usuario) return;

  const errorEl = document.querySelector("[data-error]");

  try {
    await cargarCategorias();
    await cargarProductos();
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove("oculto");
    notificar("error", "No se pudo cargar el catálogo: " + error.message);
    return;
  }

  document.getElementById("buscar-producto").addEventListener("input", pintarTablaProductos);
  document.getElementById("filtro-categoria").addEventListener("change", pintarTablaProductos);

  document.querySelector("[data-abrir-producto]")?.addEventListener("click", () => abrirDialogoProducto());
  document.querySelector("[data-cerrar-producto]").addEventListener("click", () =>
    document.querySelector("[data-dialogo-producto]").close()
  );

  const formProducto = document.getElementById("form-producto");
  const botonProducto = formProducto.querySelector('button[type="submit"]');
  const enviarProducto = conBotonCargando(botonProducto, async () => {
    try {
      await guardarProducto(formProducto);
    } catch (error) {
      notificar("error", error.message);
    }
  });
  formProducto.addEventListener("submit", (evento) => {
    evento.preventDefault();
    enviarProducto();
  });

  document.querySelector("[data-abrir-categoria]")?.addEventListener("click", () =>
    document.querySelector("[data-dialogo-categoria]").showModal()
  );
  document.querySelector("[data-cerrar-categoria]").addEventListener("click", () =>
    document.querySelector("[data-dialogo-categoria]").close()
  );

  const formCategoria = document.getElementById("form-categoria");
  const botonCategoria = formCategoria.querySelector('button[type="submit"]');
  const enviarCategoria = conBotonCargando(botonCategoria, async () => {
    try {
      await guardarCategoria(formCategoria);
    } catch (error) {
      notificar("error", error.message);
    }
  });
  formCategoria.addEventListener("submit", (evento) => {
    evento.preventDefault();
    enviarCategoria();
  });

  document.querySelector("[data-tabla-productos]").addEventListener("click", async (evento) => {
    const idEditar = evento.target.dataset.editar;
    const idDesactivar = evento.target.dataset.desactivar;

    if (idEditar) {
      const producto = productos.find((p) => p.id === idEditar);
      abrirDialogoProducto(producto);
    }

    if (idDesactivar) {
      if (!confirm("¿Desactivar este producto? Ya no aparecerá para nuevas ventas.")) return;
      try {
        await API.delete(`/productos/${idDesactivar}`);
        notificar("exito", "Producto desactivado.");
        await cargarProductos();
      } catch (error) {
        notificar("error", error.message);
      }
    }
  });
})();
