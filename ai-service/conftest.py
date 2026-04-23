"""Root conftest — adds ai-service/ to sys.path so pytest can find services/."""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
