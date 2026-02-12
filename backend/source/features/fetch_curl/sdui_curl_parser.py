import shlex
import json


def parse_sdui_curl(curl_text: str):
    tokens = shlex.split(curl_text)

    method = "POST"
    url = None
    headers = {}
    cookies = {}
    body = None
    referer = None

    i = 0
    while i < len(tokens):
        t = tokens[i]

        # METHOD
        if t.lower() in ("-x", "--request"):
            method = tokens[i + 1].upper()
            i += 2
            continue

        # URL
        if t.startswith("http"):
            url = t
            i += 1
            continue

        # HEADERS
        if t.lower() in ("-h", "--header"):
            header = tokens[i + 1]

            if ":" in header:
                k, v = header.split(":", 1)
                k = k.strip()
                v = v.strip()

                if k.lower() == "cookie":
                    # Extrair cookies corretamente
                    for pair in v.split(";"):
                        if "=" in pair:
                            ck, cv = pair.split("=", 1)
                            cookies[ck.strip()] = cv.strip()
                else:
                    headers[k] = v

                if k.lower() == "referer":
                    referer = v

            i += 2
            continue

        # BODY
        if t in ("--data", "--data-raw", "--data-binary"):
            raw = tokens[i + 1]
            try:
                body = json.loads(raw)
            except:
                body = raw
            i += 2
            continue

        i += 1

    if not url:
        raise ValueError("No URL found in curl")

    return {
        "base_url": url,
        "method": method,
        "headers": headers,
        "cookies": cookies,
        "body": body,
        "referer": referer,
        "query_id": None,
    }
