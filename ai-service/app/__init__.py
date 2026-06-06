"""Flask application factory."""
import logging

from flask import Flask
from flask_cors import CORS
from flasgger import Swagger

from app.extensions import limiter
from app.routes.analysis import analysis_bp

_log = logging.getLogger(__name__)

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

    # Eagerly load ML models so the /health endpoint reports model_ready=true
    # immediately after Gunicorn starts (preload_app=True propagates via fork).
    # Without this, models load lazily on the first /analyze request, which can
    # take 30–60 s and exceed the Spring Boot RestTemplate read timeout.
    try:
        from services.predictor import preload_models
        preload_models()
        _log.info("AI models pre-loaded successfully")
    except Exception as exc:
        _log.error("Failed to pre-load AI models at startup — service will degrade: %s", exc)

    return app
