from flask import Blueprint, request, g

from utils.helpers import (
    respuesta_ok,
    respuesta_error,
    validar_campos,
    login_requerido,
    rol_requerido,
)

inventario_bp = Blueprint("inventario", __name__, url_prefix="/api/inventario")

TIPOS_MOVIMIENTO_MANUAL = {"ENTRADA", "SALIDA", "AJUSTE"}


@inventario_bp.get("/resumen")
@login_requerido
def resumen():
    """
    Devuelve los productos activos agrupados por estado de stock:
    normal, bajo (stock <= stock_minimo) y agotado (stock = 0).
    """
    resp = (
        g.supabase.table("productos")
        .select("id, nombre, stock, stock_minimo")
        .eq("activo", True)
        .execute()
    )
    productos = resp.data or []

    agotado = [p for p in productos if p["stock"] == 0]
    bajo = [p for p in productos if p["stock"] > 0 and p["stock"] <= p["stock_minimo"]]
    normal = [p for p in productos if p["stock"] > p["stock_minimo"]]

    return respuesta_ok(
        {
            "agotado": agotado,
            "bajo": bajo,
            "normal": normal,
            "total_productos": len(productos),
        }
    )


@inventario_bp.get("/movimientos")
@login_requerido
def listar_movimientos():
    producto_id = request.args.get("producto_id")
    consulta = (
        g.supabase.table("movimientos_inventario")
        .select("id, producto_id, tipo, cantidad, stock_resultante, motivo, creado_en")
        .order("creado_en", desc=True)
    )
    if producto_id:
        consulta = consulta.eq("producto_id", producto_id)
    resp = consulta.execute()
    return respuesta_ok(resp.data)


@inventario_bp.post("/movimientos")
@rol_requerido("admin")
def crear_movimiento():
    """
    Movimiento manual de inventario (ENTRADA, SALIDA o AJUSTE).
    Las VENTA/DEVOLUCION las genera el propio RPC de ventas, no este
    endpoint. Usa la función RPC `registrar_movimiento_inventario`
    para mantener stock y movimiento sincronizados de forma atómica.
    """
    body = request.get_json(silent=True) or {}
    faltantes = validar_campos(body, ["producto_id", "tipo", "cantidad"])
    if faltantes:
        return respuesta_error(f"Faltan campos: {', '.join(faltantes)}")

    tipo = body["tipo"].upper()
    if tipo not in TIPOS_MOVIMIENTO_MANUAL:
        return respuesta_error(
            f"Tipo inválido. Debe ser uno de: {', '.join(TIPOS_MOVIMIENTO_MANUAL)}"
        )

    try:
        cantidad = int(body["cantidad"])
        if cantidad <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return respuesta_error("La cantidad debe ser un entero mayor a 0.")

    try:
        resp = g.supabase.rpc(
            "registrar_movimiento_inventario",
            {
                "p_producto_id": body["producto_id"],
                "p_tipo": tipo,
                "p_cantidad": cantidad,
                "p_usuario_id": g.usuario["id"],
                "p_motivo": body.get("motivo", "").strip(),
            },
        ).execute()
    except Exception as exc:
        return respuesta_error(f"No se pudo registrar el movimiento: {exc}", 400)

    return respuesta_ok(resp.data, status=201)
