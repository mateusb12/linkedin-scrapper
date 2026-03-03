import logging
import re

# ANSI colors
RESET = "\033[0m"
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
MAGENTA = "\033[95m"

# URL detector
HTTP_PATTERN = re.compile(r'https?://[^\s"]+')

# Regex mais precisa para status:
# casa somente códigos após "... HTTP/1.1" ou similar
STATUS_PATTERN = re.compile(r'HTTP/\d(?:\.\d)?"\s+(\d{3})\b')


class HttpColorFilter(logging.Filter):
    def filter(self, record):
        msg = record.getMessage()

        # Só colore logs que contenham URL / HTTP request
        if HTTP_PATTERN.search(msg):

            # tenta extrair o status HTTP real
            match = STATUS_PATTERN.search(msg)

            if match:
                code = int(match.group(1))

                if 200 <= code < 300:
                    color = GREEN
                elif 300 <= code < 400:
                    color = CYAN
                elif 400 <= code < 500:
                    color = YELLOW
                else:
                    color = RED
            else:
                # fallback caso não encontre
                color = MAGENTA

            # aplica a cor
            record.msg = f"{color}{msg}{RESET}"
            record.args = ()

        return True
