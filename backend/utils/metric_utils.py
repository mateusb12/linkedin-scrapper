import sys
import time
from datetime import datetime, timedelta


class JobConsoleProgress:
    """
    Tracks and prints progress in-place without flooding the terminal.
    Make the instance *callable* so you can write `progress(done)`.
    """

    def __init__(self, total: int, min_interval: float = 0.25):
        self.total = total
        self.min_interval = min_interval
        self.start_ts = time.time()
        self.last_update = 0.0

    # allow `progress(idx)`
    def __call__(self, done: int) -> None:
        now = time.time()
        if done < self.total and (now - self.last_update) < self.min_interval:
            return                     # too soon, skip print

        self.last_update = now
        elapsed = now - self.start_ts or 1e-6
        avg_per_job = elapsed / done
        remaining = self.total - done
        remaining_sec = remaining * avg_per_job
        eta = datetime.now() + timedelta(seconds=remaining_sec)

        line = (
            f"\rparsing {done}/{self.total} jobs | "
            f"remaining: {remaining} | "
            f"time per job: {avg_per_job:.2f}s | "
            f"jobs/min: {60/avg_per_job:.1f} | "
            f"remaining time: {timedelta(seconds=int(remaining_sec))} | "
            f"ETA: {eta:%H:%M:%S}"
        )
        sys.stdout.write(line.ljust(120))
        sys.stdout.flush()