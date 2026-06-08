"""Shared Flask extensions — instantiated here, initialised in create_app()."""
import os

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Use Redis when available (production) so rate-limit state is shared across
# Gunicorn workers.  Falls back to in-process memory for local development.
# NOTE: in-memory storage is NOT shared across workers, so limits will be
# per-worker rather than per-IP when running with multiple Gunicorn workers
# and no REDIS_URL is set.
_storage_uri = os.environ.get("REDIS_URL", "memory://")

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "60 per minute"],
    storage_uri=_storage_uri,
)
