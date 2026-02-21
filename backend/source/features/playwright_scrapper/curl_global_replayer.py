import sys
import json
import shlex
import hashlib
from pathlib import Path
import requests

OUTPUT_FILE = Path("linkedin_sdui_dump.json")


# ============================================
#               DB HELPERS
# ============================================

def load_db():
    if OUTPUT_FILE.exists():
        try:
            return json.loads(OUTPUT_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_db(db):
    OUTPUT_FILE.write_text(
        json.dumps(db, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )


# ============================================
#               CURL PARSER
# ============================================

def hash_curl(curl_text):
    return hashlib.sha1(curl_text.encode()).hexdigest()


def parse_curl_command(cmd):
    tokens = shlex.split(cmd)
    if tokens[0] != "curl":
        raise ValueError("Not a curl command")

    method = "GET"
    url = None
    headers = {}
    data = None

    it = iter(tokens[1:])
    for token in it:
        if not token.startswith("-"):
            if url is None:
                url = token
            continue

        if token in ("-X", "--request"):
            method = next(it)
        elif token in ("-H", "--header"):
            h = next(it)
            if ":" in h:
                k, v = h.split(":", 1)
                headers[k.strip()] = v.strip()
        elif token in ("--data", "--data-raw", "--data-binary", "-d"):
            data = next(it)

    if not url:
        raise ValueError("URL not found")

    return {"method": method, "url": url, "headers": headers, "data": data}


# ============================================
#               REPLAY REQUEST
# ============================================

def replay(req):
    resp = requests.request(
        method=req["method"],
        url=req["url"],
        headers=req["headers"],
        data=req["data"],
    )
    return {
        "status": resp.status_code,
        "headers": dict(resp.headers),
        "text": resp.text
    }


def replay_curls():
    db = load_db()
    print("\n===== REPLAYING STORED CURLS =====\n")

    for key, item in db.items():
        print(f"[EXEC] {key[:12]}...")

        try:
            req = parse_curl_command(item["curl"])
            resp = replay(req)
            db[key]["response"] = resp
        except Exception as e:
            db[key]["response"] = {"error": str(e)}

    save_db(db)
    print("\n===== DONE REPLAYING =====\n")


# ============================================
#       SDUI DECODER (VERY IMPORTANT)
# ============================================

def parse_sdui_tree(text):
    """
    O SDUI vem como várias linhas:
    1:I["...",[],"default"]
    7:I["...",[],"ClientComponent"]
    0:["$", "div", null, {...}]
    A linha 0 contém a árvore raiz.
    """
    lines = text.split("\n")
    tree = {}

    for line in lines:
        if ":" not in line:
            continue

        try:
            idx, raw_json = line.split(":", 1)
            idx = idx.strip()
            raw_json = raw_json.strip()
            parsed = json.loads(raw_json)
            tree[idx] = parsed
        except:
            continue

    return tree.get("0")  # raiz da árvore


# ============================================
#       EXTRACT USEFUL DATA FROM TREE
# ============================================

def extract_useful_info(tree):
    """
    Faz um walk na árvore e extrai texto relevante.
    Heurísticas simplificadas para: nome, headline, etc.
    (Vamos refinando depois.)
    """

    result = {
        "name": None,
        "headline": None,
        "experiences": [],
        "skills": [],
        "languages": []
    }

    def walk(node):
        # LinkedIn SDUI usa estrutura recursiva
        if isinstance(node, list):

            # Caso seja ["$", "tag", null, {props}]
            if len(node) >= 4 and node[0] == "$":
                props = node[3]
                if isinstance(props, dict):
                    children = props.get("children", [])
                    if isinstance(children, list):
                        for child in children:
                            walk(child)

            # Listas só de texto → pegar conteúdo
            if all(isinstance(x, str) for x in node):
                text = " ".join(node).strip()

                # heurística de nome
                if not result["name"] and len(text.split()) >= 2:
                    if text[0].isupper():
                        result["name"] = text

        elif isinstance(node, dict):
            for v in node.values():
                walk(v)

        elif isinstance(node, str):
            pass

    walk(tree)
    return result


# ============================================
#           ANALYSER FUNCTION
# ============================================

def analyse_response_json():
    db = load_db()

    print("\n===== ANALYSING RESPONSES =====\n")

    for key, item in db.items():
        resp = item.get("response", {})
        text = resp.get("text", "")

        print(f"--- {key[:12]} ---")

        if not text:
            print("No text.\n")
            continue

        tree = parse_sdui_tree(text)
        if not tree:
            print("Could not parse SDUI tree.\n")
            continue

        info = extract_useful_info(tree)

        print(json.dumps(info, indent=2, ensure_ascii=False))
        print()

    print("===== END ANALYSIS =====\n")


# ============================================
#               MAIN SELECTOR
# ============================================

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python curl_global_replayer.py replay")
        print("  python curl_global_replayer.py analyse")
        sys.exit(0)

    mode = sys.argv[1].lower()

    if mode == "replay":
        replay_curls()

    elif mode == "analyse":
        analyse_response_json()

    else:
        print("Unknown mode:", mode)
