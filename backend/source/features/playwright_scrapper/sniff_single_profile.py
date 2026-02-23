import asyncio
import html
import json
import re
from dataclasses import dataclass, field
from typing import List, Dict, Any
from pathlib import Path
from urllib.parse import urlparse  # ← ADICIONADO

from playwright.async_api import (
    Error as PlaywrightError,
)

from backend.source.features.playwright_scrapper.linkedin_core import LinkedInBrowserSniffer


# ======================================================
#               EXPECTED PROFILE (MÔNICA)
# ======================================================

@dataclass
class ExperiencePattern:
    label: str
    patterns: List[str] = field(default_factory=list)


@dataclass
class ExpectedProfilePatterns:
    # campos principais
    name_variants: List[str]
    headline_patterns: List[str]
    location_patterns: List[str]

    about_patterns: List[str] = field(default_factory=list)
    experience_patterns: List[ExperiencePattern] = field(default_factory=list)
    education_patterns: List[str] = field(default_factory=list)
    license_patterns: List[str] = field(default_factory=list)
    skill_patterns: List[str] = field(default_factory=list)


# ficha baseada no que você mandou
EXPECTED = ExpectedProfilePatterns(
    # nomes / variantes
    name_variants=[
        "mônica busatta",
        "monica busatta",
        "mônica",
        "monica",
    ],
    # headline
    headline_patterns=[
        "front-end software engineer",
        "full stack",
        "react",
        "typescript",
        "node.js",
    ],
    # localização
    location_patterns=[
        "brazil",
        "rio de janeiro, brazil",
    ],
    # about (pedaços marcantes)
    about_patterns=[
        "7+ years of experience",
        "high-quality, user-friendly, and scalable web applications",
        "solid experience in design and back-end technologies",
        "my current stack includes react, typescript, next.js, node.js",
        "deep understanding of the nuances of software development",
        "combining speed, quality, and curiosity",
    ],
    # experiências
    experience_patterns=[
        ExperiencePattern(
            label="experience1_dexian",
            patterns=[
                "dexian brasil",
                "front-end software engineer",
                "i’m a front-end engineer for itti",
                "back-office platform",
                "paraguay",
                "next.js",
                "tailwind css",
                "github workflows",
                "nestjs",
            ],
        ),
        ExperiencePattern(
            label="experience2_freelance",
            patterns=[
                "full stack web developer",
                "freelance",
                "colombian design agency",
                "pixel-perfect accuracy",
                "seo",
                "performance",
                "html, css, javascript, php, react, wordpress, and elementor",
                "united states, england, norway, and india",
            ],
        ),
        ExperiencePattern(
            label="experience3_tiba",
            patterns=[
                "front-end software engineer",
                "tiba",
                "saas platform for small business management",
                "react, typescript, graphql, and styled components",
                "scrum methodology",
                "jest",
                "lead front-end developer",
            ],
        ),
        ExperiencePattern(
            label="experience4_azz",
            patterns=[
                "full stack developer",
                "azz agência de marketing e publicidade digital",
                "corporate showcase sites",
                "e-commerce platforms",
                "blogs",
                "copywriting and ux",
                "html, css, javascript",
                "php, mysql",
            ],
        ),
    ],
    # educação
    education_patterns=[
        "universidade do sul de santa catarina",
        "sistemas para internet",
    ],
    # licenças
    license_patterns=[
        "the web developer bootcamp 2022",
        "mern ecommerce from scratch",
        "udemy",
        "credential id uc-",
    ],
    # skills (umas palavras-chave da stack)
    skill_patterns=[
        "react.js",
        "react",
        "next.js",
        "typescript",
        "node.js",
        "graphql",
        "styled components",
        "tailwind css",
        "bootstrap",
        "php",
        "mysql",
    ],
)


# ======================================================
#             NORMALIZAÇÃO E SCORING
# ======================================================

def normalize_text(raw: str) -> str:
    """Normaliza para comparação: lower, unescape, simplifica whitespace."""
    if not raw:
        return ""
    s = html.unescape(raw)
    s = s.replace("\\n", "\n")
    s = s.lower()
    # simplificar espaços
    s = re.sub(r"\s+", " ", s)
    return s


def match_patterns(text: str, patterns: List[str]) -> List[str]:
    """Retorna quais padrões aparecem no texto (substring simples)."""
    hits: List[str] = []
    for p in patterns:
        p_norm = p.strip().lower()
        if not p_norm:
            continue
        if p_norm in text:
            hits.append(p)
    return hits


def score_response(text: str, expected: ExpectedProfilePatterns) -> Dict[str, Any]:
    """
    Devolve um dict com:
      - score_total
      - hits por categoria (nome, headline, about, exps, etc)
    """
    norm = normalize_text(text)

    # nome
    name_hits = match_patterns(norm, expected.name_variants)

    # headline
    headline_hits = match_patterns(norm, expected.headline_patterns)

    # location
    location_hits = match_patterns(norm, expected.location_patterns)

    # about
    about_hits = match_patterns(norm, expected.about_patterns)

    # experiences: por label
    experience_hits: Dict[str, List[str]] = {}
    for exp in expected.experience_patterns:
        exp_hits = match_patterns(norm, exp.patterns)
        if exp_hits:
            experience_hits[exp.label] = exp_hits

    # education
    education_hits = match_patterns(norm, expected.education_patterns)

    # licenses
    license_hits = match_patterns(norm, expected.license_patterns)

    # skills
    skill_hits = match_patterns(norm, expected.skill_patterns)

    # score simples: 1 ponto por hit
    score = (
            len(name_hits)
            + len(headline_hits)
            + len(location_hits)
            + len(about_hits)
            + sum(len(v) for v in experience_hits.values())
            + len(education_hits)
            + len(license_hits)
            + len(skill_hits)
    )

    return {
        "score": score,
        "name_hits": name_hits,
        "headline_hits": headline_hits,
        "location_hits": location_hits,
        "about_hits": about_hits,
        "experience_hits": experience_hits,
        "education_hits": education_hits,
        "license_hits": license_hits,
        "skill_hits": skill_hits,
    }


# ======================================================
#              URL FILTER – IGNORA LIXO
# ======================================================

def is_interesting_url(url: str) -> bool:
    """
    Filtra assets e lixo óbvio:
    - static.licdn.com (js, css, imagens)
    - tracking / analytics / recaptcha
    - domínios não-linkedin
    """
    parsed = urlparse(url)

    netloc = parsed.netloc or ""

    # assets estáticos do linkedin
    if netloc.startswith("static.licdn.com"):
        return False

    # tracking / analytics
    if "protechts" in netloc:
        return False
    if "ads." in netloc or "ads/" in parsed.path:
        return False
    if "doubleclick" in netloc:
        return False

    # recaptcha / google
    if "recaptcha" in netloc:
        return False
    if "google.com" in netloc or "gstatic.com" in netloc:
        return False

    # extensões comuns de asset
    asset_exts = (
        ".js", ".css", ".png", ".jpg", ".jpeg",
        ".svg", ".gif", ".webp", ".ico", ".map", ".woff", ".woff2", ".ttf"
    )
    if parsed.path.endswith(asset_exts):
        return False

    # só nos interessamos por coisas do linkedin
    if "linkedin.com" not in netloc:
        return False

    return True


# ======================================================
#              SCRAPER BASEADO EM CURLs
# ======================================================

@dataclass
class CapturedResponse:
    url: str
    status: int
    text: str


class ProfileScraper(LinkedInBrowserSniffer):
    """
    Aqui a ideia NÃO é montar o JSON perfeito,
    e sim descobrir quais CURLs tem o ouro.

    - Sniffamos todas as responses
    - Decodificamos
    - Scoramos comparando com a ficha (EXPECTED)
    - Geramos ranking de CURLs mais ricos em conteúdo de perfil
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.captured: List[CapturedResponse] = []

    async def start(self):
        """Abre o browser, registra listeners e vai pro perfil."""
        await self.setup_browser()
        self.setup_listeners()
        await self.goto_target()

        print("\n[INFO] Sniffer active. Scroll the profile page calmly.")
        print("[INFO] When done, press CTRL+C to stop and analyze.\n")

        # só fica "parado" esperando você interagir
        await asyncio.sleep(999999)

    async def handle_response(self, response):
        """Intercepta TODAS as responses, sem filtrar por URL."""
        url = response.url
        status = response.status

        try:
            body_bytes = await response.body()
            decoded = self.try_decode(body_bytes)
            if decoded:
                self.captured.append(
                    CapturedResponse(
                        url=url,
                        status=status,
                        text=decoded,
                    )
                )
                print(f"[SNIFFED] {status} - {url}")
        except Exception:
            # não queremos quebrar o fluxo por causa de 1 response bugada
            pass

    def extract_data(self) -> None:
        """
        Ponto principal:
        - Para cada response capturada, gera massa de texto
        - Compara com EXPECTED
        - Gera ranking
        - Salva em curl_ranking.json
        """
        if self._processed:
            return
        self._processed = True

        if not self.captured:
            print("[EMPTY] No responses captured.")
            return

        print(f"\n[INFO] Total captured responses: {len(self.captured)}")
        print("[INFO] Scoring each response against expected profile...\n")

        scored_items = []

        for idx, resp in enumerate(self.captured):
            # 🔥 NOVO: filtra URL lixo (static, tracking, assets)
            if not is_interesting_url(resp.url):
                continue

            metrics = score_response(resp.text, EXPECTED)
            score = metrics["score"]

            # 🔥 NOVO: ignora responses que não bateram em NADA
            if score == 0:
                continue

            item = {
                "index": idx,
                "url": resp.url,
                "status": resp.status,
                "score": score,
                "matches": metrics,
                # preview pra depurar rápido
                "text_preview": normalize_text(resp.text)[:300],
            }

            scored_items.append(item)

        if not scored_items:
            print("[INFO] No interesting responses after filtering/scoring.")
            return

        # ordena por score desc
        scored_items.sort(key=lambda x: x["score"], reverse=True)

        # imprime um resumo dos top N
        print("===== TOP RESPONSES (by score) =====\n")
        for item in scored_items[:10]:
            print(f"[#{item['index']:03d}] score={item['score']} status={item['status']}")
            print(f"URL: {item['url']}")
            m = item["matches"]
            cats = []
            if m["name_hits"]:
                cats.append("name")
            if m["headline_hits"]:
                cats.append("headline")
            if m["about_hits"]:
                cats.append("about")
            if m["experience_hits"]:
                cats.append("experience")
            if m["education_hits"]:
                cats.append("education")
            if m["license_hits"]:
                cats.append("licenses")
            if m["skill_hits"]:
                cats.append("skills")

            print(f"  Categories hit: {', '.join(cats) if cats else 'none'}")
            print(f"  Preview: {item['text_preview'][:120]}...\n")

        # salva JSON com ranking completo
        output_file = Path("curl_ranking.json")
        output_file.write_text(
            json.dumps(scored_items, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        print(f"\n✨ SUCCESS: Saved structured curl ranking to {output_file}")


# ======================================================
#                       RUNNER
# ======================================================

async def run_scraper_instance(scraper: ProfileScraper) -> None:
    try:
        await scraper.start()
    except (asyncio.CancelledError, KeyboardInterrupt):
        print("\n[INFO] Interrupted. Analyzing captured data...")
        scraper.extract_data()
    finally:
        try:
            await scraper.close()
        except PlaywrightError:
            pass
        except Exception as exc:
            print(f"[WARN] Error while closing scraper: {exc}")


if __name__ == "__main__":
    TEST_URL = "https://www.linkedin.com/in/monicasbusatta/"
    print(f"Starting single-profile CURL analyzer for: {TEST_URL}")

    bot = ProfileScraper(target_url=TEST_URL)

    try:
        asyncio.run(run_scraper_instance(bot))
    except KeyboardInterrupt:
        print("\n[SYSTEM] Closed by user.")
