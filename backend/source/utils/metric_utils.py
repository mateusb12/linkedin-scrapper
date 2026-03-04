import sys
import time
from datetime import datetime, timedelta


class JobConsoleProgress:
    """
    In‑place progress printer that also shows the current LLM status.
    """

    def __init__(self, total: int, min_interval: float = 0.25):
        self.total = total
        self.min_interval = min_interval
        self.start_ts = time.time()
        self.last_update = 0.0
        self.status = ""  # current LLM status text
        self._prev_len = 0  # length of previous line (unused with ANSI clear)
        # initialize last values so set_status can refresh safely
        self._last_done = 0
        self._last_urn = ""

    def set_status(self, txt: str) -> None:
        """Update the tail text immediately."""
        self.status = txt
        # force an immediate refresh even if < min_interval
        self.last_update = 0.0
        self.__call__(self._last_done, self._last_urn)

    def __call__(self, done: int, urn: str = "") -> None:
        self._last_done, self._last_urn = done, urn  # keep for refreshes

        now = time.time()
        if done < self.total and (now - self.last_update) < self.min_interval:
            return
        self.last_update = now

        elapsed = now - self.start_ts or 1e-6
        avg_per_job = elapsed / max(done, 1)
        remaining = self.total - done
        remaining_sec = remaining * avg_per_job
        eta = datetime.now() + timedelta(seconds=remaining_sec)

        line = (
            f"parsing {done}/{self.total} jobs | "
            f"urn: {urn or '-'} | "
            f"remaining: {remaining} | "
            f"time per job: {avg_per_job:.2f}s | "
            f"jobs/min: {60 / avg_per_job:.1f} | "
            f"remaining time: {timedelta(seconds=int(remaining_sec))} | "
            f"ETA: {eta:%H:%M:%S} | "
            f"{self.status}"  # 👈 tail
        )

        sys.stdout.write("\r\033[2K" + line)
        sys.stdout.flush()

    #------------------------------------------------------------------------
    def finish(self):
        sys.stdout.write("\n")
        sys.stdout.flush()
