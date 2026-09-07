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

function deshabilitarBoton(formulario, deshabilitado) {
  const boton = formulario.querySelector('button[type="submit"]');
  if (boton) boton.disabled = deshabilitado;
}

const formLogin = document.getElementById("form-login");
if (formLogin) {
  formLogin.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    ocultarError();
    deshabilitarBoton(formLogin, true);

    const datos = new FormData(formLogin);
    try {
      await API.post("/auth/login", {
        email: datos.get("email").trim().toLowerCase(),
        password: datos.get("password"),
      });
      window.location.href = "/dashboard.html";
    } catch (error) {
      mostrarError(error.message);
      deshabilitarBoton(formLogin, false);
    }
  });
}

const formRegister = document.getElementById("form-register");
if (formRegister) {
  formRegister.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    ocultarError();
    deshabilitarBoton(formRegister, true);

    const datos = new FormData(formRegister);
    try {
      await API.post("/auth/register", {
        nombre_negocio: datos.get("nombre_negocio").trim(),
        ruc: datos.get("ruc").trim(),
        nombre_completo: datos.get("nombre_completo").trim(),
        email: datos.get("email").trim().toLowerCase(),
        password: datos.get("password"),
      });
      window.location.href = "/login.html";
    } catch (error) {
      mostrarError(error.message);
      deshabilitarBoton(formRegister, false);
    }
  });
}
