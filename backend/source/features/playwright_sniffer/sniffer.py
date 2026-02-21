import asyncio
import json
import re
import zlib
from pathlib import Path
from playwright.async_api import async_playwright

# ============================================================
# CONFIGURAÇÕES
# ============================================================

SEARCH_TERMS = [
    "otimizei",
]

REGEX_MODE = False

SAVE_DIR = Path("sniffer_hits")
SAVE_DIR.mkdir(exist_ok=True)

# Diretório DO PERFIL PERSISTENTE
USER_DATA_DIR = Path("linkedin_profile")
USER_DATA_DIR.mkdir(exist_ok=True)


# ============================================================
# DECODIFICAÇÃO
# ============================================================

def try_decode(body: bytes) -> str:
    """Tenta decodificar a resposta em todas as formas possíveis."""

    try:
        return body.decode("utf-8")
    except:
        pass

    try:
        return zlib.decompress(body, zlib.MAX_WBITS | 16).decode("utf-8")
    except:
        pass

    try:
        return zlib.decompress(body).decode("utf-8")
    except:
        pass

    try:
        return body.hex()
    except:
        return ""


def pretty_format(text: str) -> str:
    """Se for JSON, deixa indentado."""
    try:
        parsed = json.loads(text)
        return json.dumps(parsed, indent=2, ensure_ascii=False)
    except:
        return text


def matches_any(text: str) -> bool:
    """Confere se algum termo alvo aparece na resposta."""
    for term in SEARCH_TERMS:
        if REGEX_MODE:
            if re.search(term, text, re.IGNORECASE):
                return True
        else:
            if term.lower() in text.lower():
                return True
    return False


# ============================================================
# MAIN
# ============================================================

async def main():
    async with async_playwright() as p:

        print("\n[PROFILE] Usando perfil físico persistente em:", USER_DATA_DIR)

        # =====================================================
        # CONTEXTO PERSISTENTE
        # =====================================================
        context = await p.chromium.launch_persistent_context(
            user_data_dir=str(USER_DATA_DIR),
            headless=False,
            slow_mo=30,
            args=[
                "--disable-web-security",
                "--no-sandbox",
            ],
            ignore_https_errors=True,
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/123 Safari/537.36"
            ),
            viewport={"width": 1440, "height": 900},
        )

        # Abre nova página se não existir
        page = context.pages[0] if context.pages else await context.new_page()

        print("[SNIFFER] Iniciado — procurando por:", SEARCH_TERMS)

        # =====================================================
        # HANDLER DE RESPOSTAS
        # =====================================================
        async def handle_response(response):
            url = response.url
            ct = response.headers.get("content-type", "")

            # ignora tracking
            if any(x in url for x in [
                "analytics", "pixel", "ads",
                "voyager/api/identity",
                "li/track",
                "tracking"
            ]):
                return

            try:
                body = await response.body()
            except:
                return

            decoded = try_decode(body)
            if not decoded:
                return

            if matches_any(decoded):
                print("\n" + "=" * 60)
                print("[HIT] Texto encontrado!")
                print("URL:", url)
                print("Content-Type:", ct)
                print("=" * 60)

                safe_name = url.replace("/", "_").replace(":", "_").replace("?", "_")
                filename = SAVE_DIR / f"hit_{safe_name}.txt"

                with filename.open("w", encoding="utf-8", errors="ignore") as f:
                    f.write(pretty_format(decoded))

                print(f"[SALVO] Payload em: {filename}\n")

        # Hook de resposta
        page.on("response", handle_response)

        # =====================================================
        # ABRIR PERFIL
        # =====================================================
        print("\n[PAGE] Abrindo perfil...")
        await page.goto("https://www.linkedin.com/in/lucaspinheiro00/")

        print("[INFO] Se pedir login, faça login UMA ÚNICA vez. Depois nunca mais.")
        print("[INFO] Sessão será armazenada permanentemente no diretório do usuário.")

        # Mantém rodando o sniffer
        await asyncio.sleep(999999)


asyncio.run(main())
