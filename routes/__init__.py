from routes.auth import auth_bp
from routes.productos import productos_bp, categorias_bp
from routes.clientes import clientes_bp
from routes.ventas import ventas_bp
from routes.inventario import inventario_bp
from routes.dashboard import dashboard_bp
from routes.reportes import reportes_bp


def registrar_blueprints(app):
    app.register_blueprint(auth_bp)
    app.register_blueprint(productos_bp)
    app.register_blueprint(categorias_bp)
    app.register_blueprint(clientes_bp)
    app.register_blueprint(ventas_bp)
    app.register_blueprint(inventario_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(reportes_bp)
