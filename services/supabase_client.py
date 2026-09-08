"""
Helpers para crear clientes de Supabase.

Se usan 3 formas de cliente:

- get_anon_client(): usa la anon key. Sirve para operaciones de Auth
  (registro / login) que no requieren estar autenticado todavía.
- get_client_as_user(access_token): usa la anon key pero autenticado
  con el JWT del usuario logueado. Todas las consultas a las tablas
  pasan por las políticas RLS de ese usuario (solo ve su negocio).
- get_admin_client(): usa la service role key, que se salta RLS.
  Se usa SOLO para operaciones administrativas puntuales del propio
  backend (ej. crear el registro en "usuarios" al momento del
  registro). Nunca se expone al frontend.
"""

import os
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")


def _validar_config():
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise RuntimeError(
            "Faltan SUPABASE_URL o SUPABASE_ANON_KEY en las variables de entorno."
        )


def get_anon_client() -> Client:
    _validar_config()
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def get_admin_client() -> Client:
    _validar_config()
    if not SUPABASE_SERVICE_KEY:
        raise RuntimeError("Falta SUPABASE_SERVICE_KEY en las variables de entorno.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def get_client_as_user(access_token: str, refresh_token: str = None) -> Client:
    """
    Devuelve un cliente que actúa como el usuario dueño del access_token.
    Las consultas quedan sujetas a las políticas RLS de ese usuario.
    """
    _validar_config()
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    # Adjunta el JWT del usuario a las peticiones PostgREST y de Storage.
    client.postgrest.auth(access_token)
    return client
