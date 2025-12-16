import os
import sys
import time
import threading


def start_debugger_monitor(port=5678, host='host.docker.internal'):
    """
    Background thread that silently waits for PyCharm to become available
    and attaches the debugger automatically.

    Args:
        port (int): The port PyCharm "Python Debug Server" is listening on.
        host (str): The host where PyCharm is running (usually host.docker.internal).
    """

    def monitor():
        # 1. Wait a bit so the app has time to print its startup logs to console
        time.sleep(2)

        print(f"🔍 Debugger: Active! Waiting silently for PyCharm on {host}:{port}...")

        # Keep this OPEN as long as the app runs to prevent I/O crashes
        devnull = open(os.devnull, 'w')

        while True:
            try:
                # Mute stderr only for the connection attempt
                original_stderr = sys.stderr
                sys.stderr = devnull

                try:
                    import pydevd_pycharm
                    pydevd_pycharm.settrace(
                        host,
                        port=port,
                        stdout_to_server=True,
                        stderr_to_server=True,
                        suspend=False
                    )

                    # Connection Successful!
                    # Restore stderr so we can print the success message
                    sys.stderr = original_stderr
                    print(f"\n✅ SUCCESS: App automatically attached to PyCharm Debugger ({host}:{port})!\n")
                    break

                except Exception:
                    # Connection failed. Restore stderr silently and retry.
                    sys.stderr = original_stderr
                    pass

            except Exception:
                # Failsafe: Ensure stderr is restored even if code breaks
                sys.stderr = sys.__stderr__

            time.sleep(3)

    thread = threading.Thread(target=monitor, daemon=True)
    thread.start()