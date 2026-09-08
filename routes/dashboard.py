from datetime import datetime, timedelta, timezone

from flask import Blueprint, g

from utils.helpers import respuesta_ok, login_requerido

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


def _inicio_del_dia_utc():
    ahora = datetime.now(timezone.utc)
    return ahora.replace(hour=0, minute=0, second=0, microsecond=0)


def _inicio_del_mes_utc():
    ahora = datetime.now(timezone.utc)
    return ahora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


@dashboard_bp.get("/resumen")
@login_requerido
def resumen():
    inicio_dia = _inicio_del_dia_utc().isoformat()
    inicio_mes = _inicio_del_mes_utc().isoformat()

    ventas_hoy = (
        g.supabase.table("ventas")
        .select("total", count="exact")
        .eq("estado", "completada")
        .gte("creado_en", inicio_dia)
        .execute()
    )
    ventas_mes = (
        g.supabase.table("ventas")
        .select("total", count="exact")
        .eq("estado", "completada")
        .gte("creado_en", inicio_mes)
        .execute()
    )

    total_ventas_hoy = sum(v["total"] for v in (ventas_hoy.data or []))
    total_ventas_mes = sum(v["total"] for v in (ventas_mes.data or []))

    productos = (
        g.supabase.table("productos")
        .select("id, stock, stock_minimo", count="exact")
        .eq("activo", True)
        .execute()
    )
    productos_data = productos.data or []
    stock_bajo = [
        p for p in productos_data if p["stock"] <= p["stock_minimo"]
    ]

    total_clientes = (
        g.supabase.table("clientes")
        .select("id", count="exact")
        .eq("activo", True)
        .execute()
    )

    recientes = (
        g.supabase.table("ventas")
        .select("id, total, estado, creado_en")
        .order("creado_en", desc=True)
        .limit(5)
        .execute()
    )

    return respuesta_ok(
        {
            "ventas_hoy": {"cantidad": ventas_hoy.count or 0, "total": total_ventas_hoy},
            "ventas_mes": {"cantidad": ventas_mes.count or 0, "total": total_ventas_mes},
            "total_productos": productos.count or 0,
            "productos_stock_bajo": len(stock_bajo),
            "total_clientes": total_clientes.count or 0,
            "ventas_recientes": recientes.data,
        }
    )
