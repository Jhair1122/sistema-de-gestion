from flask import Blueprint, request, session, g

from services.auth_service import (
    registrar_negocio_y_admin,
    iniciar_sesion,
    cerrar_sesion,
    AuthError,
)
from utils.helpers import respuesta_ok, respuesta_error, validar_campos, login_requerido

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/register")
def register():
    body = request.get_json(silent=True) or {}
    faltantes = validar_campos(
        body, ["nombre_negocio", "nombre_completo", "email", "password"]
    )
    if faltantes:
        return respuesta_error(f"Faltan campos: {', '.join(faltantes)}")

    if len(body["password"]) < 8:
        return respuesta_error("La contraseña debe tener al menos 8 caracteres.")

    try:
        resultado = registrar_negocio_y_admin(
            nombre_negocio=body["nombre_negocio"].strip(),
            ruc=body.get("ruc", "").strip(),
            nombre_completo=body["nombre_completo"].strip(),
            email=body["email"].strip().lower(),
            password=body["password"],
        )
    except AuthError as err:
        return respuesta_error(err.mensaje, err.status_code)

    return respuesta_ok(resultado, status=201)


@auth_bp.post("/login")
def login():
    body = request.get_json(silent=True) or {}
    faltantes = validar_campos(body, ["email", "password"])
    if faltantes:
        return respuesta_error(f"Faltan campos: {', '.join(faltantes)}")

    try:
        resultado = iniciar_sesion(body["email"].strip().lower(), body["password"])
    except AuthError as err:
        return respuesta_error(err.mensaje, err.status_code)

    # Guardamos SOLO lo necesario en la sesión de Flask (cookie firmada).
    session["access_token"] = resultado["access_token"]
    session["refresh_token"] = resultado["refresh_token"]
    session["usuario"] = resultado["usuario"]
    session.permanent = True

    return respuesta_ok({"usuario": resultado["usuario"]})


@auth_bp.post("/logout")
def logout():
    access_token = session.get("access_token")
    if access_token:
        cerrar_sesion(access_token)
    session.clear()
    return respuesta_ok({"mensaje": "Sesión cerrada."})


@auth_bp.get("/me")
@login_requerido
def me():
    return respuesta_ok({"usuario": g.usuario})
