from flask import Blueprint, request, g

from utils.helpers import (
    respuesta_ok,
    respuesta_error,
    validar_campos,
    numero_valido,
    login_requerido,
    rol_requerido,
)

productos_bp = Blueprint("productos", __name__, url_prefix="/api/productos")

# El README no contempla un archivo routes/categorias.py aparte, así que
# las categorías (muy ligadas a productos) se manejan aquí mismo, bajo
# su propio blueprint y prefijo /api/categorias.
categorias_bp = Blueprint("categorias", __name__, url_prefix="/api/categorias")


@productos_bp.get("")
@login_requerido
def listar():
    """Lista productos activos del negocio. Admin y vendedor pueden ver."""
    incluir_inactivos = request.args.get("incluir_inactivos") == "1"
    consulta = g.supabase.table("productos").select(
        "id, nombre, descripcion, precio, stock, stock_minimo, activo, categoria_id"
    )
    if not incluir_inactivos:
        consulta = consulta.eq("activo", True)
    resp = consulta.order("nombre").execute()
    return respuesta_ok(resp.data)


@productos_bp.get("/<producto_id>")
@login_requerido
def obtener(producto_id):
    resp = (
        g.supabase.table("productos")
        .select("*")
        .eq("id", producto_id)
        .maybe_single()
        .execute()
    )
    if not resp or not resp.data:
        return respuesta_error("Producto no encontrado.", 404)
    return respuesta_ok(resp.data)


@productos_bp.post("")
@rol_requerido("admin")
def crear():
    body = request.get_json(silent=True) or {}
    faltantes = validar_campos(body, ["nombre", "precio"])
    if faltantes:
        return respuesta_error(f"Faltan campos: {', '.join(faltantes)}")

    if not numero_valido(body["precio"], minimo=0):
        return respuesta_error("El precio debe ser un número mayor o igual a 0.")

    stock_inicial = body.get("stock", 0)
    if not numero_valido(stock_inicial, minimo=0):
        return respuesta_error("El stock inicial debe ser un número mayor o igual a 0.")

    nuevo = {
        "negocio_id": g.usuario["negocio_id"],
        "categoria_id": body.get("categoria_id"),
        "nombre": body["nombre"].strip(),
        "descripcion": body.get("descripcion", "").strip(),
        "precio": float(body["precio"]),
        "stock": int(stock_inicial),
        "stock_minimo": int(body.get("stock_minimo", 0)),
        "activo": True,
    }
    resp = g.supabase.table("productos").insert(nuevo).execute()
    return respuesta_ok(resp.data[0], status=201)


@productos_bp.put("/<producto_id>")
@rol_requerido("admin")
def actualizar(producto_id):
    body = request.get_json(silent=True) or {}
    campos_actualizables = [
        "nombre",
        "descripcion",
        "precio",
        "stock_minimo",
        "categoria_id",
    ]
    cambios = {c: body[c] for c in campos_actualizables if c in body}

    if "precio" in cambios and not numero_valido(cambios["precio"], minimo=0):
        return respuesta_error("El precio debe ser un número mayor o igual a 0.")

    if not cambios:
        return respuesta_error("No enviaste ningún campo para actualizar.")

    resp = (
        g.supabase.table("productos")
        .update(cambios)
        .eq("id", producto_id)
        .execute()
    )
    if not resp.data:
        return respuesta_error("Producto no encontrado.", 404)
    return respuesta_ok(resp.data[0])


@productos_bp.delete("/<producto_id>")
@rol_requerido("admin")
def eliminar(producto_id):
    """Baja lógica: no se borra el registro, se marca como inactivo."""
    resp = (
        g.supabase.table("productos")
        .update({"activo": False})
        .eq("id", producto_id)
        .execute()
    )
    if not resp.data:
        return respuesta_error("Producto no encontrado.", 404)
    return respuesta_ok({"mensaje": "Producto desactivado."})


# ---------------------------------------------------------------------
# Categorías (comparten archivo con productos por la estructura del repo)
# ---------------------------------------------------------------------


@categorias_bp.get("")
@login_requerido
def listar_categorias():
    resp = (
        g.supabase.table("categorias")
        .select("id, nombre, descripcion, activo")
        .eq("activo", True)
        .order("nombre")
        .execute()
    )
    return respuesta_ok(resp.data)


@categorias_bp.post("")
@rol_requerido("admin")
def crear_categoria():
    body = request.get_json(silent=True) or {}
    faltantes = validar_campos(body, ["nombre"])
    if faltantes:
        return respuesta_error(f"Faltan campos: {', '.join(faltantes)}")

    nueva = {
        "negocio_id": g.usuario["negocio_id"],
        "nombre": body["nombre"].strip(),
        "descripcion": body.get("descripcion", "").strip(),
        "activo": True,
    }
    resp = g.supabase.table("categorias").insert(nueva).execute()
    return respuesta_ok(resp.data[0], status=201)


@categorias_bp.put("/<categoria_id>")
@rol_requerido("admin")
def actualizar_categoria(categoria_id):
    body = request.get_json(silent=True) or {}
    cambios = {c: body[c] for c in ("nombre", "descripcion") if c in body}
    if not cambios:
        return respuesta_error("No enviaste ningún campo para actualizar.")

    resp = (
        g.supabase.table("categorias")
        .update(cambios)
        .eq("id", categoria_id)
        .execute()
    )
    if not resp.data:
        return respuesta_error("Categoría no encontrada.", 404)
    return respuesta_ok(resp.data[0])


@categorias_bp.delete("/<categoria_id>")
@rol_requerido("admin")
def eliminar_categoria(categoria_id):
    resp = (
        g.supabase.table("categorias")
        .update({"activo": False})
        .eq("id", categoria_id)
        .execute()
    )
    if not resp.data:
        return respuesta_error("Categoría no encontrada.", 404)
    return respuesta_ok({"mensaje": "Categoría desactivada."})
