#!/usr/bin/env python3
import shlex
import json
import requests


def parse_curl(curl_text: str):
    """
    Very lightweight parser to extract:
      - HTTP method (defaults to GET)
      - URL
      - Headers (-H / --header)
      - Cookies (-b / --cookie)
    Supports Windows-style line-continuations with '^'.
    """
    # 1) Join lines, treating trailing '^' as continuation
    buf = ""
    for line in curl_text.splitlines():
        stripped = line.rstrip()
        if stripped.endswith("^"):
            buf += stripped[:-1] + " "
        else:
            buf += line + " "
    one_line = buf.replace("^", "")  # remove any remaining carets

    # 2) Tokenize respecting quotes
    tokens = shlex.split(one_line)

    method = "get"
    url = None
    headers = {}
    cookies = {}

    i = 0
    while i < len(tokens):
        t = tokens[i].lower()
        if t in ("-x", "--request"):
            method = tokens[i + 1].lower()
            i += 2
        elif tokens[i].startswith(("http://", "https://")):
            url = tokens[i]
            i += 1
        elif t in ("-h", "-H", "--header"):
            hdr = tokens[i + 1]
            if ":" in hdr:
                k, v = hdr.split(":", 1)
                headers[k.strip()] = v.strip()
            i += 2
        elif t in ("-b", "--cookie"):
            cookie_str = tokens[i + 1]
            for pair in cookie_str.split(";"):
                if "=" in pair:
                    k, v = pair.split("=", 1)
                    cookies[k.strip()] = v.strip()
            i += 2
        else:
            i += 1

    if not url:
        raise ValueError("No URL found in curl command after stripping carets.")
    return method, url, headers, cookies


def main():
    curl_file = "potential_curl.txt"
    output_file = "response.json"

    with open(curl_file, "r", encoding="utf-8") as f:
        curl_text = f.read()

    method, url, headers, cookies = parse_curl(curl_text)

    # perform the request
    resp = requests.request(method, url, headers=headers, cookies=cookies)
    resp.raise_for_status()
    data = resp.json()  # assume JSON

    # write out to JSON file
    with open(output_file, "w", encoding="utf-8") as out:
        json.dump(data, out, indent=2, ensure_ascii=False)

    print(f"✅ Response saved to {output_file}")


if __name__ == "__main__":
    main()
