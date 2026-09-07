from flask import Blueprint, request, g

from utils.helpers import respuesta_ok, respuesta_error, validar_campos, login_requerido

ventas_bp = Blueprint("ventas", __name__, url_prefix="/api/ventas")


@ventas_bp.get("")
@login_requerido
def listar():
    resp = (
        g.supabase.table("ventas")
        .select("id, cliente_id, usuario_id, total, estado, creado_en")
        .order("creado_en", desc=True)
        .execute()
    )
    return respuesta_ok(resp.data)


@ventas_bp.get("/<venta_id>")
@login_requerido
def obtener(venta_id):
    venta = (
        g.supabase.table("ventas")
        .select("*")
        .eq("id", venta_id)
        .maybe_single()
        .execute()
    )
    if not venta or not venta.data:
        return respuesta_error("Venta no encontrada.", 404)

    detalle = (
        g.supabase.table("detalle_ventas")
        .select("id, producto_id, cantidad, precio_unitario, subtotal")
        .eq("venta_id", venta_id)
        .execute()
    )
    data = venta.data
    data["detalle"] = detalle.data
    return respuesta_ok(data)


@ventas_bp.post("")
@login_requerido
def registrar():
    """
    Registra una venta completa mediante la función RPC
    `registrar_venta` de Postgres (ver docs/base-de-datos.sql):
    valida stock, calcula el total con el precio real del producto
    (nunca el que mande el frontend), descuenta stock y crea el
    movimiento de inventario, todo en una sola transacción atómica.

    Body esperado:
    {
      "cliente_id": "uuid" | null,
      "items": [{"producto_id": "uuid", "cantidad": 2}, ...]
    }
    """
    body = request.get_json(silent=True) or {}
    items = body.get("items")
    if not items or not isinstance(items, list):
        return respuesta_error("Debes enviar al menos un producto en 'items'.")

    for item in items:
        faltantes = validar_campos(item, ["producto_id", "cantidad"])
        if faltantes:
            return respuesta_error("Cada item necesita producto_id y cantidad.")
        try:
            if int(item["cantidad"]) <= 0:
                return respuesta_error("La cantidad debe ser mayor a 0.")
        except (TypeError, ValueError):
            return respuesta_error("La cantidad debe ser un número entero.")

    try:
        resp = g.supabase.rpc(
            "registrar_venta",
            {
                "p_cliente_id": body.get("cliente_id"),
                "p_usuario_id": g.usuario["id"],
                "p_items": items,
            },
        ).execute()
    except Exception as exc:
        return respuesta_error(f"No se pudo registrar la venta: {exc}", 400)

    return respuesta_ok(resp.data, status=201)


@ventas_bp.post("/<venta_id>/anular")
@login_requerido
def anular(venta_id):
    """Anula una venta (no la borra). El stock se repone vía movimiento
    de tipo DEVOLUCION, gestionado por la función RPC `anular_venta`."""
    try:
        resp = g.supabase.rpc(
            "anular_venta",
            {"p_venta_id": venta_id, "p_usuario_id": g.usuario["id"]},
        ).execute()
    except Exception as exc:
        return respuesta_error(f"No se pudo anular la venta: {exc}", 400)

    return respuesta_ok(resp.data)
