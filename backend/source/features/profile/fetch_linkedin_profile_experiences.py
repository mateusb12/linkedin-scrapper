import json
import urllib.parse
import requests
from requests_toolbelt.utils import dump

from source.features.fetch_curl.linkedin_http_client import load_experience_config


# ===================================================================
# 1) ENCODE EXATAMENTE COMO O FIREFOX (MAS APENAS O URN)
# ===================================================================

def encode_urn_only(raw_urn: str) -> str:
    """
    Firefox só faz URL-encode dentro do valor do profileUrn.
    Ele NÃO encoda o bloco inteiro "(profileUrn:...,sectionType:experience)".
    """

    # Isso simula exatamente o comportamento do HAR:
    #   "urn:li:fsd_profile:XYZ" -> "urn%3Ali%3Afsd_profile%3AXYZ"
    return urllib.parse.quote(raw_urn, safe='')


# ===================================================================
# 2) BUILD URL FINAL (IGUAL HAR)
# ===================================================================

def build_url(profile_urn: str, query_id: str):
    """
    HAR:
    variables=(profileUrn:urn%3Ali%3Afsd_profile%3AACoA...,sectionType:experience)
    """

    # URN puro
    raw_urn = profile_urn.replace("profileUrn:", "").strip()

    # Encode somente do URN
    encoded_urn = encode_urn_only(raw_urn)

    # RAW (apenas debug humano)
    raw_vars = f"(profileUrn:{raw_urn},sectionType:experience)"

    # FINAL EXATO IGUAL AO HAR
    variables_param = f"(profileUrn:{encoded_urn},sectionType:experience)"

    # Não encodamos novamente `variables_param`
    url = (
        "https://www.linkedin.com/voyager/api/graphql"
        f"?includeWebMetadata=true"
        f"&variables={variables_param}"
        f"&queryId={query_id}"
    )

    return url, raw_vars, variables_param, encoded_urn


# ===================================================================
# 3) BUILD CURL COM HEADERS
# ===================================================================

def build_curl(url: str, headers: dict):
    parts = [f"curl '{url}' -X GET"]
    for k, v in headers.items():
        parts.append(f"-H '{k}: {v}'")
    return " \\\n  ".join(parts)


# ===================================================================
# 4) MAIN
# ===================================================================

def fetch_linkedin_profile_experiences(profile_urn: str):

    print("=== Fetch LinkedIn Experiences (PATCH FINAL 4.0) ===")

    cfg = load_experience_config()
    if not cfg:
        print("❌ Could not load config.")
        return

    headers = cfg["headers"]
    query_id = cfg["query_id"]

    # ------------------------------------------------------------------
    # Build URL (agora 100% igual ao HAR)
    # ------------------------------------------------------------------
    url, raw_vars, variables_param, encoded_urn = build_url(profile_urn, query_id)

    print("\n=== RAW URN ===")
    print(profile_urn)

    print("\n=== ENCODED URN ===")
    print(encoded_urn)

    print("\n=== RAW VARS (HUMANO) ===")
    print(raw_vars)

    print("\n=== VARIABLES PARAM (FINAL, COMO NO HAR) ===")
    print(variables_param)

    print("\n=== FINAL URL ===")
    print(url)

    # ------------------------------------------------------------------
    # HEADERS
    # ------------------------------------------------------------------
    print("\n=== FINAL HEADERS (Python) ===")
    for k, v in headers.items():
        print(f"{k}: {v}")

    print("\n=== COOKIES (from DB) ===")
    if "Cookie" in headers:
        for c in headers["Cookie"].split(";"):
            print("•", c.strip())

    # ------------------------------------------------------------------
    # PRINT FULL cURL
    # ------------------------------------------------------------------
    print("\n=== FULL cURL EQUIVALENT ===")
    print(build_curl(url, headers))

    # ------------------------------------------------------------------
    # REAL REQUEST
    # ------------------------------------------------------------------
    session = requests.Session()
    session.headers.update(headers)

    print("\n=== SENDING REQUEST... ===")

    response = session.get(url, allow_redirects=False)

    print("➡️ STATUS:", response.status_code)

    # ------------------------------------------------------------------
    # RAW REQUEST + RESPONSE
    # ------------------------------------------------------------------
    data = dump.dump_all(response)
    print("\n=== RAW REQUEST+RESPONSE DUMP (FULL) ===")
    print(data.decode("utf-8", errors="ignore"))

    print("\n=== RAW RESPONSE TEXT (FIRST 3000 CHARS) ===")
    print(response.text[:3000])

    if response.status_code != 200:
        print("\n❌ ERROR RESPONSE (FULL):")
        print(response.text)
        return

    # ------------------------------------------------------------------
    # JSON PREVIEW
    # ------------------------------------------------------------------
    parsed = response.json()

    print("\n=== PARSED JSON (FIRST 3000 CHARS) ===")
    print(json.dumps(parsed, indent=2)[:3000])

    # ------------------------------------------------------------------
    # SCAN $type
    # ------------------------------------------------------------------
    print("\n=== $type SCAN ===")
    types = set()

    def scan(node):
        if isinstance(node, dict):
            if "$type" in node:
                types.add(node["$type"])
            for v in node.values():
                scan(v)
        elif isinstance(node, list):
            for item in node:
                scan(item)

    scan(parsed)
    for t in sorted(types):
        print("•", t)

    print("\n=== DONE ===")


# ===================================================================
# RUN
# ===================================================================

if __name__ == "__main__":
    fetch_linkedin_profile_experiences(
        # Como HAR mostrou:
        "profileUrn:urn:li:fsd_profile:ACoAAD016UkBWKGUUWKD7WdA2pTCzevPYoF-xnE"
    )
