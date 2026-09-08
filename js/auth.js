function mostrarError(mensaje) {
  const contenedor = document.querySelector("[data-error]");
  if (!contenedor) return;
  contenedor.textContent = mensaje;
  contenedor.classList.remove("oculto");
}

function ocultarError() {
  const contenedor = document.querySelector("[data-error]");
  if (contenedor) contenedor.classList.add("oculto");
}

const formLogin = document.getElementById("form-login");
if (formLogin) {
  const botonLogin = formLogin.querySelector('button[type="submit"]');
  const enviarLogin = conBotonCargando(botonLogin, async () => {
    ocultarError();
    const datos = new FormData(formLogin);
    try {
      await API.post("/auth/login", {
        email: datos.get("email").trim().toLowerCase(),
        password: datos.get("password"),
      });
      notificar("exito", "Sesión iniciada. Cargando tu panel…");
      window.location.href = "/dashboard.html";
    } catch (error) {
      mostrarError(error.message);
    }
  });
  formLogin.addEventListener("submit", (evento) => {
    evento.preventDefault();
    enviarLogin();
  });
}

const formRegister = document.getElementById("form-register");
if (formRegister) {
  const botonRegister = formRegister.querySelector('button[type="submit"]');
  const enviarRegister = conBotonCargando(botonRegister, async () => {
    ocultarError();
    const datos = new FormData(formRegister);
    try {
      await API.post("/auth/register", {
        nombre_negocio: datos.get("nombre_negocio").trim(),
        ruc: datos.get("ruc").trim(),
        nombre_completo: datos.get("nombre_completo").trim(),
        email: datos.get("email").trim().toLowerCase(),
        password: datos.get("password"),
      });
      notificar("exito", "Negocio creado. Ahora inicia sesión.");
      window.location.href = "/login.html";
    } catch (error) {
      mostrarError(error.message);
    }
  });
  formRegister.addEventListener("submit", (evento) => {
    evento.preventDefault();
    enviarRegister();
  });
}
