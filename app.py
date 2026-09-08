import os

from flask import Flask, send_from_directory, abort, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from routes import registrar_blueprints

load_dotenv()

# Páginas HTML servidas en la raíz del sitio (mismo nombre que el archivo,
# sin ".html", tal como están en la carpeta del proyecto).
PAGINAS_PERMITIDAS = {
    "index",
    "login",
    "register",
    "dashboard",
    "productos",
    "clientes",
    "inventario",
    "ventas",
    "reportes",
}

RAIZ_PROYECTO = os.path.dirname(os.path.abspath(__file__))


def create_app():
    app = Flask(__name__, static_folder=None)

    app.config["SECRET_KEY"] = os.environ.get(
        "FLASK_SECRET_KEY", "cambia-esto-en-produccion"
    )
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    # En Render (HTTPS) esto debe ir en True. En local (http) Flask lo
    # ignora igual si no estás sirviendo por https.
    app.config["SESSION_COOKIE_SECURE"] = os.environ.get("FLASK_ENV") != "development"

    # CORS restrictivo: en producción el mismo Flask sirve el frontend,
    # así que normalmente no se necesita ningún origen extra. En
    # desarrollo se permite servir el HTML con Live Server u otro puerto.
    origenes = os.environ.get("CORS_ORIGINS", "")
    origenes_permitidos = [o.strip() for o in origenes.split(",") if o.strip()]
    if origenes_permitidos:
        CORS(app, supports_credentials=True, origins=origenes_permitidos)

    registrar_blueprints(app)

    @app.after_request
    def agregar_cabeceras_seguridad(response):
        # CSP adaptada a este proyecto: todo el JS/CSS es propio (mismo
        # origen) y se conecta solo a Supabase por REST desde el propio
        # backend (el navegador solo llama a /api/... de este mismo sitio).
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "img-src 'self' data:; "
            "font-src 'self' https://fonts.gstatic.com; "
            "connect-src 'self'; "
            "frame-src 'none'; "
            "object-src 'none'"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        return response

    @app.get("/api/health")
    def salud():
        return jsonify({"ok": True, "servicio": "sistema-de-gestion"})

    # --- Archivos estáticos propios (css/js), sin exponer el resto del repo ---
    @app.get("/css/<path:nombre_archivo>")
    def servir_css(nombre_archivo):
        return send_from_directory(os.path.join(RAIZ_PROYECTO, "css"), nombre_archivo)

    @app.get("/js/<path:nombre_archivo>")
    def servir_js(nombre_archivo):
        return send_from_directory(os.path.join(RAIZ_PROYECTO, "js"), nombre_archivo)

    # Carpeta para las imágenes que agregues tú mismo (ver img/LEEME.txt).
    # Si el archivo pedido no existe todavía, Flask responde 404 y el
    # navegador simplemente no muestra nada (no rompe el diseño porque
    # las imágenes se usan como fondo CSS con degradado detrás, o con
    # onerror en las etiquetas <img>).
    @app.get("/img/<path:nombre_archivo>")
    def servir_img(nombre_archivo):
        return send_from_directory(os.path.join(RAIZ_PROYECTO, "img"), nombre_archivo)

    # --- Páginas HTML ---
    @app.get("/")
    def portada():
        return send_from_directory(RAIZ_PROYECTO, "index.html")

    @app.get("/<pagina>.html")
    def paginas_html(pagina):
        if pagina not in PAGINAS_PERMITIDAS:
            abort(404)
        return send_from_directory(RAIZ_PROYECTO, f"{pagina}.html")

    @app.errorhandler(404)
    def no_encontrado(_error):
        return jsonify({"ok": False, "error": "Recurso no encontrado."}), 404

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_ENV") == "development", port=5000)
