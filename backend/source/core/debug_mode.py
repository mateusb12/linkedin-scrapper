# backend/source/core/debug_mode.py

import os
from functools import lru_cache
from dotenv import load_dotenv

# Carrega o .env apenas uma vez
load_dotenv()


@lru_cache(maxsize=1)
def is_debug() -> bool:
    """
    Singleton que retorna o valor do DEBUG do .env.
    Convertido para bool. Default: False.
    """
    raw = os.getenv("DEBUG", "").strip().lower()

    # Aceita múltiplas formas
    truthy = {"1", "true", "yes", "on"}
    falsy = {"0", "false", "no", "off"}

    if raw in truthy:
        return True
    if raw in falsy:
        return False

    # valor inválido → assume False
    return False
