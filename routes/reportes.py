from collections import defaultdict

from flask import Blueprint, request, g

from utils.helpers import respuesta_ok, respuesta_error, login_requerido

reportes_bp = Blueprint("reportes", __name__, url_prefix="/api/reportes")


def _rango_fechas():
    """Lee ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD de la query string."""
    desde = request.args.get("desde")
    hasta = request.args.get("hasta")
    return desde, hasta


@reportes_bp.get("/ventas")
@login_requerido
def reporte_ventas():
    desde, hasta = _rango_fechas()
    consulta = (
        g.supabase.table("ventas")
        .select("id, cliente_id, usuario_id, total, estado, creado_en")
        .order("creado_en", desc=True)
    )
    if desde:
        consulta = consulta.gte("creado_en", desde)
    if hasta:
        consulta = consulta.lte("creado_en", hasta)

    resp = consulta.execute()
    ventas = resp.data or []

    completadas = [v for v in ventas if v["estado"] == "completada"]
    total_periodo = sum(v["total"] for v in completadas)

    return respuesta_ok(
        {
            "ventas": ventas,
            "cantidad_ventas": len(completadas),
            "total_periodo": total_periodo,
        }
    )


@reportes_bp.get("/productos-mas-vendidos")
@login_requerido
def productos_mas_vendidos():
    desde, hasta = _rango_fechas()
    limite = request.args.get("limite", default=10, type=int)

    ventas_consulta = g.supabase.table("ventas").select("id").eq(
        "estado", "completada"
    )
    if desde:
        ventas_consulta = ventas_consulta.gte("creado_en", desde)
    if hasta:
        ventas_consulta = ventas_consulta.lte("creado_en", hasta)
    ventas_ids = [v["id"] for v in (ventas_consulta.execute().data or [])]

    if not ventas_ids:
        return respuesta_ok([])

    detalle = (
        g.supabase.table("detalle_ventas")
        .select("producto_id, cantidad, subtotal")
        .in_("venta_id", ventas_ids)
        .execute()
    )

    acumulado = defaultdict(lambda: {"cantidad": 0, "total": 0.0})
    for fila in detalle.data or []:
        acumulado[fila["producto_id"]]["cantidad"] += fila["cantidad"]
        acumulado[fila["producto_id"]]["total"] += fila["subtotal"]

    if not acumulado:
        return respuesta_ok([])

    productos = (
        g.supabase.table("productos")
        .select("id, nombre")
        .in_("id", list(acumulado.keys()))
        .execute()
    )
    nombres = {p["id"]: p["nombre"] for p in (productos.data or [])}

    resultado = [
        {
            "producto_id": pid,
            "nombre": nombres.get(pid, "(producto eliminado)"),
            "cantidad_vendida": datos["cantidad"],
            "total_vendido": datos["total"],
        }
        for pid, datos in acumulado.items()
    ]
    resultado.sort(key=lambda r: r["cantidad_vendida"], reverse=True)
    return respuesta_ok(resultado[:limite])


@reportes_bp.get("/inventario")
@login_requerido
def reporte_inventario():
    desde, hasta = _rango_fechas()
    tipo = request.args.get("tipo")

    consulta = (
        g.supabase.table("movimientos_inventario")
        .select("id, producto_id, tipo, cantidad, stock_resultante, motivo, creado_en")
        .order("creado_en", desc=True)
    )
    if desde:
        consulta = consulta.gte("creado_en", desde)
    if hasta:
        consulta = consulta.lte("creado_en", hasta)
    if tipo:
        tipo_normalizado = tipo.upper()
        tipos_validos = {"ENTRADA", "SALIDA", "AJUSTE", "VENTA", "DEVOLUCION"}
        if tipo_normalizado not in tipos_validos:
            return respuesta_error(
                f"Tipo inválido. Debe ser uno de: {', '.join(tipos_validos)}"
            )
        consulta = consulta.eq("tipo", tipo_normalizado)

    resp = consulta.execute()
    return respuesta_ok(resp.data)
