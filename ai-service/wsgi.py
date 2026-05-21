import sys
import os

# Ensure the ai-service root is always on sys.path so that both `services.*`
# (root-level) and `app.*` (package-level) imports resolve correctly regardless
# of the directory Gunicorn is invoked from.
_root = os.path.dirname(os.path.abspath(__file__))
if _root not in sys.path:
    sys.path.insert(0, _root)

from app import create_app
application = create_app()
