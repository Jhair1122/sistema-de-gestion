/*
  Utilidades compartidas por todas las páginas:
  - API: envoltorio de fetch que agrega credenciales, arma el JSON y
    homogeniza errores según el formato {ok, data, error} del backend.
  - protegerPagina(): confirma sesión activa (GET /api/auth/me) y,
    opcionalmente, restringe por rol. Redirige a login si no hay sesión.
  - configurarLogout()/marcarNavActivo(): comportamiento común del layout.
*/

const API = {
  async request(ruta, opciones = {}) {
    const config = {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(opciones.headers || {}) },
      ...opciones,
    };
    if (config.body && typeof config.body !== "string") {
      config.body = JSON.stringify(config.body);
    }

    const respuesta = await fetch(`/api${ruta}`, config);

    let cuerpo = null;
    try {
      cuerpo = await respuesta.json();
    } catch (_) {
      cuerpo = null;
    }

    if (respuesta.status === 401) {
      window.location.href = "/login.html";
      throw new Error("Sesión expirada.");
    }

    if (!respuesta.ok || !cuerpo || cuerpo.ok === false) {
      const mensaje = (cuerpo && cuerpo.error) || "Ocurrió un error inesperado.";
      throw new Error(mensaje);
    }

    return cuerpo.data;
  },

  get(ruta) {
    return this.request(ruta);
  },
  post(ruta, cuerpo) {
    return this.request(ruta, { method: "POST", body: cuerpo });
  },
  put(ruta, cuerpo) {
    return this.request(ruta, { method: "PUT", body: cuerpo });
  },
  delete(ruta) {
    return this.request(ruta, { method: "DELETE" });
  },
};

function marcarNavActivo() {
  const actual = window.location.pathname.replace(/^\//, "").replace(".html", "") || "index";
  document.querySelectorAll("[data-nav]").forEach((enlace) => {
    if (enlace.dataset.nav === actual) enlace.classList.add("activo");
  });
}

function configurarLogout() {
  const boton = document.querySelector("[data-logout]");
  if (!boton) return;
  boton.addEventListener("click", async () => {
    try {
      await API.post("/auth/logout");
    } catch (_) {
      /* aunque falle la llamada, igual se saca al usuario localmente */
    }
    window.location.href = "/login.html";
  });
}

/**
 * Confirma que hay sesión activa y pinta el nombre del usuario en el
 * layout. Si `rolesPermitidos` se especifica y el rol del usuario no
 * está incluido, lo manda al panel principal en vez de a esta página.
 */
async function protegerPagina(rolesPermitidos = null) {
  try {
    const { usuario } = await API.get("/auth/me");

    if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
      window.location.href = "/dashboard.html";
      return null;
    }

    document.body.classList.add(`rol-${usuario.rol}`);
    document.querySelectorAll("[data-usuario-nombre]").forEach((el) => {
      el.textContent = usuario.nombre_completo;
    });

    return usuario;
  } catch (_) {
    window.location.href = "/login.html";
    return null;
  }
}

function formatearMoneda(valor) {
  const numero = Number(valor) || 0;
  return `S/ ${numero.toFixed(2)}`;
}

function formatearFecha(iso) {
  if (!iso) return "—";
  const fecha = new Date(iso);
  return fecha.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }) + " " + fecha.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

document.addEventListener("DOMContentLoaded", () => {
  marcarNavActivo();
  configurarLogout();
});
