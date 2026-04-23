"""Flask application factory."""
from flask import Flask
from flask_cors import CORS

from app.routes.analysis import analysis_bp


def create_app():
    app = Flask(__name__)
    CORS(app, origins=["http://localhost:5173", "https://shcp.rw"])
    app.register_blueprint(analysis_bp, url_prefix="")
    return app
