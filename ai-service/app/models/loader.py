"""
Loads the TensorFlow SavedModel and its tokenizer at application startup.
Falls back gracefully when model files are not yet present (dev/test mode).
"""
import os
import pickle
import logging

logger = logging.getLogger(__name__)

MODEL_VERSION = "2.0"
MAX_SEQUENCE_LENGTH = 128


class ModelLoader:
    def __init__(self, model_path: str):
        self.model_path    = model_path
        self.model         = None
        self.tokenizer     = None
        self.model_version = MODEL_VERSION
        self._load()

    def _load(self):
        """Attempt to load TensorFlow model and tokenizer."""
        try:
            import tensorflow as tf  # noqa: F401 – optional dependency

            saved_model_dir = self.model_path
            if not os.path.isdir(saved_model_dir):
                logger.warning(
                    "Model directory not found at '%s'. "
                    "Running in keyword-heuristic mode.",
                    saved_model_dir,
                )
                return

            self.model = tf.saved_model.load(saved_model_dir)
            logger.info("TF model loaded from %s", saved_model_dir)

            tokenizer_path = os.path.join(saved_model_dir, "tokenizer.pkl")
            if os.path.isfile(tokenizer_path):
                with open(tokenizer_path, "rb") as f:
                    self.tokenizer = pickle.load(f)
                logger.info("Tokenizer loaded from %s", tokenizer_path)
            else:
                logger.warning("tokenizer.pkl not found — inference will use heuristics.")

        except ImportError:
            logger.warning(
                "TensorFlow not installed. Running in keyword-heuristic mode."
            )
        except Exception as exc:
            logger.error("Failed to load model: %s", exc)

    @property
    def is_ready(self) -> bool:
        return self.model is not None and self.tokenizer is not None
