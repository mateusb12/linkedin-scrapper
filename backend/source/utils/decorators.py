import time
from functools import wraps


def execution_time(func):
    """Print how long the wrapped function takes."""

    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        duration = time.perf_counter() - start
        print(f"⏱️  {func.__name__} finished in {duration:.3f} s")
        return result

    return wrapper
