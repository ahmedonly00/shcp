"""Gunicorn configuration for the SHCP AI microservice."""
import os

# ── Binding ───────────────────────────────────────────────────────────────────
bind = f"0.0.0.0:{os.getenv('PORT', '5000')}"

# ── Workers ───────────────────────────────────────────────────────────────────
workers = int(os.getenv("GUNICORN_WORKERS", "2"))
worker_class = "sync"
threads = 1

# ── Preload ───────────────────────────────────────────────────────────────────
# Load the Flask app (and all pickle models) once in the master process before
# forking workers. Workers inherit loaded objects via OS copy-on-write, so
# models are loaded exactly once regardless of worker count.
preload_app = True

# ── Timeouts ─────────────────────────────────────────────────────────────────
# pickle model loading at startup takes ~60 s; 120 s gives comfortable headroom.
timeout = 120
graceful_timeout = 30
keepalive = 5

# ── Logging ───────────────────────────────────────────────────────────────────
accesslog  = "-"            # stdout
errorlog   = "-"            # stderr
loglevel   = os.getenv("LOG_LEVEL", "info")
access_log_format = '%(h)s "%(r)s" %(s)s %(b)s %(D)sµs'

# ── Process naming ────────────────────────────────────────────────────────────
proc_name = "shcp-ai-service"
