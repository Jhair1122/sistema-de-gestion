from flask import Blueprint, request, g

from utils.helpers import (
    respuesta_ok,
    respuesta_error,
    validar_campos,
    login_requerido,
    rol_requerido,
)

clientes_bp = Blueprint("clientes", __name__, url_prefix="/api/clientes")


@clientes_bp.get("")
@login_requerido
def listar():
    busqueda = request.args.get("q", "").strip()
    consulta = g.supabase.table("clientes").select("*").eq("activo", True)
    if busqueda:
        consulta = consulta.ilike("nombre", f"%{busqueda}%")
    resp = consulta.order("nombre").execute()
    return respuesta_ok(resp.data)


@clientes_bp.get("/<cliente_id>")
@login_requerido
def obtener(cliente_id):
    resp = (
        g.supabase.table("clientes")
        .select("*")
        .eq("id", cliente_id)
        .maybe_single()
        .execute()
    )
    if not resp or not resp.data:
        return respuesta_error("Cliente no encontrado.", 404)
    return respuesta_ok(resp.data)


@clientes_bp.get("/<cliente_id>/ventas")
@login_requerido
def historial_compras(cliente_id):
    """Historial de compras del cliente (para admin y vendedor)."""
    resp = (
        g.supabase.table("ventas")
        .select("id, total, estado, creado_en")
        .eq("cliente_id", cliente_id)
        .order("creado_en", desc=True)
        .execute()
    )
    return respuesta_ok(resp.data)


@clientes_bp.post("")
@login_requerido
def crear():
    body = request.get_json(silent=True) or {}
    faltantes = validar_campos(body, ["nombre"])
    if faltantes:
        return respuesta_error(f"Faltan campos: {', '.join(faltantes)}")

    nuevo = {
        "negocio_id": g.usuario["negocio_id"],
        "nombre": body["nombre"].strip(),
        "documento": body.get("documento", "").strip(),
        "telefono": body.get("telefono", "").strip(),
        "email": body.get("email", "").strip(),
        "direccion": body.get("direccion", "").strip(),
        "activo": True,
    }
    resp = g.supabase.table("clientes").insert(nuevo).execute()
    return respuesta_ok(resp.data[0], status=201)


@clientes_bp.put("/<cliente_id>")
@login_requerido
def actualizar(cliente_id):
    body = request.get_json(silent=True) or {}
    campos_actualizables = ["nombre", "documento", "telefono", "email", "direccion"]
    cambios = {c: body[c] for c in campos_actualizables if c in body}
    if not cambios:
        return respuesta_error("No enviaste ningún campo para actualizar.")

    resp = (
        g.supabase.table("clientes").update(cambios).eq("id", cliente_id).execute()
    )
    if not resp.data:
        return respuesta_error("Cliente no encontrado.", 404)
    return respuesta_ok(resp.data[0])


@clientes_bp.delete("/<cliente_id>")
@rol_requerido("admin")
def eliminar(cliente_id):
    resp = (
        g.supabase.table("clientes")
        .update({"activo": False})
        .eq("id", cliente_id)
        .execute()
    )
    if not resp.data:
        return respuesta_error("Cliente no encontrado.", 404)
    return respuesta_ok({"mensaje": "Cliente desactivado."})
