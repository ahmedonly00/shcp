"""Flask application factory."""
from flask import Flask
from flask_cors import CORS
from flasgger import Swagger

from app.extensions import limiter
from app.routes.analysis import analysis_bp

_SWAGGER_CONFIG = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec",
            "route": "/apispec.json",
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/docs/",
}

_SWAGGER_TEMPLATE = {
    "info": {
        "title": "SHCP AI Symptom Checker",
        "description": (
            "AI-powered multilingual symptom analysis for the Smart Health Care Platform. "
            "Supports English, French, and Kinyarwanda. "
            "Returns disease predictions with ICD-10 codes, urgency classification, "
            "age-appropriate care pathways, and SHAP-based explaining factors."
        ),
        "version": "2.0.0",
        "contact": {"email": "support@shcp.rw"},
    },
    "schemes": ["https", "http"],
    "securityDefinitions": {},
    "tags": [
        {"name": "Symptom Analysis", "description": "Core symptom checking endpoints"},
        {"name": "Health",           "description": "Service liveness and metadata"},
    ],
}


def create_app() -> Flask:
    app = Flask(__name__)

    CORS(app, origins=["http://localhost:5173", "https://shcp.rw"])

    # Rate limiting
    limiter.init_app(app)

    # Swagger UI at /docs/
    Swagger(app, config=_SWAGGER_CONFIG, template=_SWAGGER_TEMPLATE)

    app.register_blueprint(analysis_bp, url_prefix="")

    return app
