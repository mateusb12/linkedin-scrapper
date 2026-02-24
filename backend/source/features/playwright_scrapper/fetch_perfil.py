import json
import re
import sys
import os
from dataclasses import dataclass, field, asdict
from typing import List

# Garante que o Python ache os módulos do seu backend
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from source.features.fetch_curl.fetch_service import FetchService


# ======================================================
#              ESTRUTURA DE DADOS (DATACLASS)
# ======================================================
@dataclass
class FichaCandidato:
    vanity_name: str = ""
    nome_completo: str = ""
    headline: str = ""
    resumo_about: str = ""
    historico_e_experiencias: List[str] = field(default_factory=list)

    def to_json(self):
        return json.dumps(asdict(self), indent=2, ensure_ascii=False)


def eh_texto_humano(texto: str) -> bool:
    """
    Filtro heurístico que identifica se a string é escrita por um humano
    ou se é uma variável de sistema/UI do React (SDUI).
    """
    t = texto.strip()
    t_lower = t.lower()

    if len(t) < 4: return False

    # 1. Filtro de lixos exatos conhecidos
    lixo_exato = {
        "horizontal", "presentation", "breadcrumb", "fitcontent", "openinnewtab",
        "suppresshydrationwarning", "fetchpriority", "preserveaspectratio", "xmidymid slice",
        "buttonprops", "ghostcompact", "iconending", "issingleline", "usedeprecatedstyle",
        "fillavailable", "presentationstyle", "requestedarguments", "vanityname",
        "requestedstatekeys", "requestmetadata", "currentactor", "newhierarchy", "screenhash",
        "isanchorpage", "childhierarchy", "inheritactor", "colorscheme", "disablescreengutters",
        "shouldhidemobiletopnavbar", "shouldhideloadingspinner", "screentitle",
        "replacecurrentscreen", "delegatecomponentkey", "delegatekey", "openbehaviorconfig",
        "unendorse_skill", "loadingtext", "statevalue", "expression", "booleanexpression",
        "notexpression", "bindableboolean", "booleanbinding", "isreactive", "isstreaming",
        "rumpagekey", "maxretries", "backoffmultiplier", "maxseconds", "retryoptions",
        "isapfcenabled", "flexshrink", "isselectedstatekey", "isselectedbindingkey",
        "selectedexpression", "closeviewtracking", "associationtype", "associationid",
        "associationtitle", "isvanitynameresolved", "colorstatelistidentifier",
        "shouldsupportvisitedstate", "linkformatting", "inlineblock", "fontfamily",
        "fontweight", "lineheight", "hasshowmore", "expandbuttontext", "shouldcollapsenewlines",
        "noopoverride", "bindingkey", "expansionkey", "maxlinecountexpression",
        "onshowmoreaction", "onshowlessaction", "textcolorexpression", "isexpandabletextv2enabled",
        "multiviewerindex", "renderpayload", "imagerenditions", "selectionmethod",
        "shoulduseimagetracking", "enablemediastatsfornerds", "certifications", "cibellysousa"
    }
    if t_lower in lixo_exato: return False

    # 2. Filtro de Substrings Tóxicas
    if any(x in t_lower for x in ["$sreact", "proto.sdui", "urn:li:", "==", "width_and_height"]): return False
    if "logo" in t_lower or "thumbnail for" in t_lower: return False
    if t_lower.startswith("profile-card"): return False
    if t_lower.startswith("entity_image"): return False

    # 3. FILTROS REGEX (O Matador de Código)
    # Rejeita hashes de CSS (ex: _72a29cf0 ou b6ed3095)
    if re.search(r'_[a-f0-9]{6,}', t) or re.search(r'\b[a-f0-9]{8,}\b', t): return False
    # Rejeita camelCase (ex: isEncrypted)
    if re.match(r'^[a-z]+[A-Z][a-zA-Z0-9]*$', t): return False
    # Rejeita PascalCase de componentes (ex: TracedComponent)
    if re.match(r'^[A-Z][a-z]+[A-Z][a-zA-Z0-9]*$', t): return False
    # Rejeita kebab-case (ex: profile-card-experience)
    if re.match(r'^[a-z0-9]+(-[a-z0-9]+)+$', t): return False
    # Rejeita snake_case (ex: experience_media)
    if re.match(r'^[a-z0-9]+(_[a-z0-9]+)+$', t): return False
    # Rejeita CONSTANT_CASE (ex: DATA_AWARE_COMPONENT)
    if re.match(r'^[A-Z0-9]+(_[A-Z0-9]+)+$', t): return False

    return True


def extrair_textos_sdui(raw_stream: str) -> List[str]:
    # Extrai tudo que estiver entre aspas duplas e pareça uma string JSON
    strings_cruas = re.findall(r'"((?:[^"\\]|\\.)*)"', raw_stream)
    textos_limpos = []

    for s_crua in strings_cruas:
        try:
            texto = json.loads(f'"{s_crua}"').strip()
            if eh_texto_humano(texto) and texto not in textos_limpos:
                textos_limpos.append(texto)
        except:
            pass

    return textos_limpos


# ======================================================
#              FLUXO PRINCIPAL DE EXTRAÇÃO
# ======================================================
def fetch_perfil_dinamico(vanity_name: str) -> FichaCandidato:
    print(f"🕵️  Iniciando extração do perfil: {vanity_name}\n" + "=" * 50)

    configs_alvo = ["ProfileMain", "ProfileAboveActivity", "ProfileBelowActivity"]
    raw_data = {}

    for config in configs_alvo:
        print(f"\n⏳ Extraindo [{config}]...")
        resultado = FetchService.execute_dynamic_profile_fetch(config, vanity_name)

        if not resultado:
            raw_data[config] = ""
            continue

        extensao = "json" if isinstance(resultado, dict) else "txt"

        # Omiti a gravação de txt para não sujar sua pasta, mas mantive em memória
        if extensao == "json":
            raw_data[config] = json.dumps(resultado, ensure_ascii=False)
        else:
            raw_data[config] = resultado

    # ======================================================
    #              MONTAGEM DA FICHA ESTRUTURADA
    # ======================================================
    print("\n" + "=" * 50)
    print("🧠 Filtrando Lixo do React e Montando Ficha...")

    ficha = FichaCandidato(vanity_name=vanity_name)

    # 1. Puxa Nome e Headline da Título da Página HTML
    main_html = raw_data.get("ProfileMain", "")
    if main_html:
        titulo_match = re.search(r'<title>(.*?)</title>', main_html)
        if titulo_match:
            titulo_limpo = titulo_match.group(1).replace(" | LinkedIn", "").strip()
            if " - " in titulo_limpo:
                partes = titulo_limpo.split(" - ", 1)
                ficha.nome_completo = partes[0].strip()
                ficha.headline = partes[1].strip()
            else:
                ficha.nome_completo = titulo_limpo
                # Cibelly não usa headline na Título, então tentaremos achar na Atividade

    # 2. Analisa o About
    above_stream = raw_data.get("ProfileAboveActivity", "")
    if above_stream:
        textos_above = extrair_textos_sdui(above_stream)
        if textos_above:
            # O texto mais longo do header costuma ser o About
            ficha.resumo_about = max(textos_above, key=len)

    # 3. Analisa as Experiências Profissionais
    below_stream = raw_data.get("ProfileBelowActivity", "")
    if below_stream:
        # A Mágica Acontece Aqui: Todos os lixos de programação morrem no filtro
        ficha.historico_e_experiencias = extrair_textos_sdui(below_stream)

    print(f"\n📊 Ficha concluída: {ficha.nome_completo}")
    print("=" * 60)

    # Salva o arquivo JSON
    ficha_path = f"ficha_{vanity_name}.json"
    with open(ficha_path, "w", encoding="utf-8") as f:
        f.write(ficha.to_json())

    print(ficha.to_json())
    print(f"\n📁 Ficha JSON limpa salva em: {ficha_path}")

    return ficha


if __name__ == "__main__":
    fetch_perfil_dinamico("cibellysousa")
