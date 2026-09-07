"""
Utilidades compartidas por las rutas:

- login_requerido: exige sesión activa y deja disponible en `g`:
    g.usuario         -> perfil (id, negocio_id, nombre_completo, rol)
    g.access_token    -> JWT de Supabase del usuario logueado
    g.supabase        -> cliente de Supabase autenticado como ese usuario
                         (respeta RLS: solo ve su negocio_id)
- rol_requerido("admin"): además exige que el rol esté en la lista dada.
- respuesta_ok / respuesta_error: formato JSON consistente para toda la API.
- validar_campos: valida presencia y tipo básico de campos del body.
"""

from functools import wraps
from flask import session, jsonify, g

from services.supabase_client import get_client_as_user


def respuesta_ok(data=None, status=200):
    return jsonify({"ok": True, "data": data}), status


def respuesta_error(mensaje, status=400):
    return jsonify({"ok": False, "error": mensaje}), status


def login_requerido(vista):
    @wraps(vista)
    def envoltura(*args, **kwargs):
        usuario = session.get("usuario")
        access_token = session.get("access_token")
        if not usuario or not access_token:
            return respuesta_error("Debes iniciar sesión.", 401)

        g.usuario = usuario
        g.access_token = access_token
        g.supabase = get_client_as_user(access_token)
        return vista(*args, **kwargs)

    return envoltura


def rol_requerido(*roles_permitidos):
    def decorador(vista):
        @wraps(vista)
        @login_requerido
        def envoltura(*args, **kwargs):
            if g.usuario.get("rol") not in roles_permitidos:
                return respuesta_error(
                    "No tienes permisos para realizar esta acción.", 403
                )
            return vista(*args, **kwargs)

        return envoltura

    return decorador


def validar_campos(body, campos_requeridos):
    """
    Verifica que `body` (dict) tenga todos los campos en
    `campos_requeridos` y que no vengan vacíos. Devuelve una lista de
    campos faltantes (vacía si todo está bien).
    """
    faltantes = []
    for campo in campos_requeridos:
        valor = body.get(campo) if body else None
        if valor is None or (isinstance(valor, str) and valor.strip() == ""):
            faltantes.append(campo)
    return faltantes


def numero_valido(valor, minimo=0):
    try:
        numero = float(valor)
    except (TypeError, ValueError):
        return False
    return numero >= minimo
