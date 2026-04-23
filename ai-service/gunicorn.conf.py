"""Gunicorn configuration for the SHCP AI microservice."""
import multiprocessing
import os

# ── Binding ───────────────────────────────────────────────────────────────────
bind = f"0.0.0.0:{os.getenv('PORT', '5000')}"

# ── Workers ───────────────────────────────────────────────────────────────────
# Each worker loads the TF model once; keep workers low to control memory.
workers = int(os.getenv("GUNICORN_WORKERS", max(2, multiprocessing.cpu_count())))
worker_class = "sync"
threads = 1                 # TF is not thread-safe per worker

# ── Timeouts ─────────────────────────────────────────────────────────────────
timeout = 30                # worker killed if silent for 30 s
graceful_timeout = 10       # worker gets 10 s to finish in-flight request on SIGTERM
keepalive = 5

# ── Logging ───────────────────────────────────────────────────────────────────
accesslog  = "-"            # stdout
errorlog   = "-"            # stderr
loglevel   = os.getenv("LOG_LEVEL", "info")
access_log_format = '%(h)s "%(r)s" %(s)s %(b)s %(D)sµs'

# ── Process naming ────────────────────────────────────────────────────────────
proc_name = "shcp-ai-service"
