"""
Lógica de autenticación sobre Supabase Auth.

Las contraseñas NUNCA se manejan ni se guardan en nuestras tablas:
todo el registro/login de credenciales lo hace Supabase Auth
(auth.users). La tabla "usuarios" solo guarda el perfil de negocio
(negocio_id, rol, activo) enlazado por el mismo id (uuid) del usuario
de auth.
"""

from services.supabase_client import get_anon_client, get_admin_client


class AuthError(Exception):
    def __init__(self, mensaje, status_code=400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status_code = status_code


def registrar_negocio_y_admin(nombre_negocio, ruc, nombre_completo, email, password):
    """
    Flujo de registro inicial:
    1. Crea el usuario en Supabase Auth (anon client).
    2. Con el cliente admin (bypassa RLS) crea el negocio.
    3. Crea el perfil en "usuarios" con rol=admin para ese negocio.

    Si el paso 2 o 3 falla, se intenta no dejar un usuario de Auth
    huérfano (se revierte con el cliente admin).
    """
    anon = get_anon_client()
    admin = get_admin_client()

    auth_resp = anon.auth.sign_up({"email": email, "password": password})
    if not auth_resp.user:
        raise AuthError("No se pudo crear la cuenta. Verifica el correo.", 400)

    usuario_id = auth_resp.user.id

    try:
        negocio = (
            admin.table("negocios")
            .insert({"nombre": nombre_negocio, "ruc": ruc})
            .execute()
        )
        negocio_id = negocio.data[0]["id"]

        admin.table("usuarios").insert(
            {
                "id": usuario_id,
                "negocio_id": negocio_id,
                "nombre_completo": nombre_completo,
                "rol": "admin",
                "activo": True,
            }
        ).execute()
    except Exception as exc:
        # Revertir el usuario de Auth para no dejar cuentas huérfanas.
        try:
            admin.auth.admin.delete_user(usuario_id)
        except Exception:
            pass
        raise AuthError(f"No se pudo completar el registro: {exc}", 400)

    return {"usuario_id": usuario_id, "negocio_id": negocio_id}


def iniciar_sesion(email, password):
    anon = get_anon_client()
    try:
        auth_resp = anon.auth.sign_in_with_password(
            {"email": email, "password": password}
        )
    except Exception:
        raise AuthError("Correo o contraseña incorrectos.", 401)

    if not auth_resp.session:
        raise AuthError("Correo o contraseña incorrectos.", 401)

    perfil = obtener_perfil(auth_resp.user.id)
    if not perfil:
        raise AuthError("La cuenta no tiene un perfil de negocio asociado.", 403)
    if not perfil.get("activo", False):
        raise AuthError("Esta cuenta está desactivada. Contacta al administrador.", 403)

    return {
        "access_token": auth_resp.session.access_token,
        "refresh_token": auth_resp.session.refresh_token,
        "usuario": {
            "id": perfil["id"],
            "negocio_id": perfil["negocio_id"],
            "nombre_completo": perfil["nombre_completo"],
            "rol": perfil["rol"],
        },
    }


def cerrar_sesion(access_token):
    anon = get_anon_client()
    try:
        anon.auth.sign_out()
    except Exception:
        # El logout es best-effort: aunque falle, el frontend igual
        # debe borrar la sesión local.
        pass


def obtener_perfil(usuario_id):
    admin = get_admin_client()
    resp = (
        admin.table("usuarios")
        .select("id, negocio_id, nombre_completo, rol, activo")
        .eq("id", usuario_id)
        .maybe_single()
        .execute()
    )
    return resp.data if resp else None
