import json
import re
from dataclasses import dataclass, field, asdict
from typing import List

# ======================================================
# CONFIGURAÇÃO DE DEBUG
# Mude para False quando quiser parar de ver os prints
# ======================================================
DEBUG = True


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


def eh_texto_humano(texto: str, vanity_name: str) -> bool:
    """
    Filtro heurístico AGRESSIVO. Retorna True se for texto humano.
    """
    t = texto.strip()
    t_lower = t.lower()

    # 1. Regra de tamanho: Strings muito curtas dificilmente são úteis
    if len(t) < 5:
        return False

    # 2. Rejeita o próprio username ou palavras genéricas
    if t_lower == vanity_name.lower() or t_lower == "secondary":
        return False

    # 3. Palavras soltas que são propriedades de UI/Estilo do React e SDUI
    lixo_exato = {
        "children", "value", "namespace", "collapsed", "persistence", "role",
        "section", "componentkey", "direction", "figure", "style", "category",
        "icon", "display", "block", "width", "height", "text", "size", "small",
        "location", "center", "isolation", "isolate", "triggers", "action",
        "actions", "content", "screen", "title", "payload", "type", "click",
        "disabled", "loading", "interop", "list", "listitem", "state", "modal",
        "position", "button", "span", "color", "sans", "normal", "open", "start",
        "more", "expanded", "context", "shape", "rounded", "a11ytext", "weight",
        "default", "media", "show all", "show credential", "show all licenses",
        "show all skills", "endorse", "horizontal", "presentation", "breadcrumb",
        "fitcontent", "openinnewtab", "suppresshydrationwarning", "fetchpriority",
        "preserveaspectratio", "xmidymid slice", "buttonprops", "ghostcompact",
        "iconending", "issingleline", "usedeprecatedstyle", "fillavailable",
        "presentationstyle", "requestedarguments", "vanityname", "requestedstatekeys",
        "requestmetadata", "currentactor", "newhierarchy", "screenhash", "isanchorpage",
        "childhierarchy", "inheritactor", "colorscheme", "disablescreengutters",
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
        "shoulduseimagetracking", "enablemediastatsfornerds", "certifications",
        "experience", "education", "licenses & certifications", "skills"
    }
    if t_lower in lixo_exato: return False

    # 4. Substrings Tóxicas (Se conter isso, rejeita a string inteira)
    toxicos = [
        "com.linkedin.", "props:", "$type", "$case", "$undefined", "presentationstyle_",
        "colorscheme_", "modalsize_", "position_", "linkformatting_", "urn:li:",
        "$sreact", "proto.sdui", "width_and_height", "logo", "thumbnail for",
        "profile-card", "entity_image", "interactiontypes", "viewtrackingspecs", "certificate.pdf"
    ]
    if any(x in t_lower for x in toxicos): return False

    # 5. FILTROS REGEX (O Matador de Código)

    # Rejeita Base64 Hashes (ex: Ud/F3vLiSmqoH7rAf5bQtA==)
    if t.endswith("==") or t.endswith("="):
        if re.match(r'^[A-Za-z0-9+/=]{15,}$', t): return False

    # Rejeita medidas de CSS e fontes (ex: 10.8rem, 12px, 1.5x)
    if re.match(r'^[0-9\.]+(rem|em|px|vh|vw|x|%)$', t_lower): return False

    # Rejeita URLs e Links crus (ex: https://www.linkedin.com/school/3227175/)
    if t_lower.startswith("http://") or t_lower.startswith("https://"): return False

    # Rejeita chaves geradas do tipo $L10, $L1a, $c, $L3f
    if re.match(r'^\$[A-Za-z0-9]+$', t): return False

    # Rejeita caminhos de props como $2:props:children...
    if re.search(r'^\$[A-Za-z0-9]+:', t): return False

    # Rejeita IDs bizarros gigantes do LinkedIn
    if re.match(r'^[A-Za-z0-9\-_]{20,}$', t): return False

    # Rejeita hashes de CSS e tokens
    if re.search(r'_[a-f0-9]{6,}', t) or re.search(r'\b[a-f0-9]{8,}\b', t): return False

    # Filtros de Programação Case
    if re.match(r'^[a-z]+[A-Z][a-zA-Z0-9]*$', t): return False  # camelCase
    if re.match(r'^[A-Z][a-z]+[A-Z][a-zA-Z0-9]*$', t): return False  # PascalCase
    if re.match(r'^[a-z0-9]+(-[a-z0-9]+)+$', t): return False  # kebab-case
    if re.match(r'^[a-z0-9]+(_[a-z0-9]+)+$', t): return False  # snake_case
    if re.match(r'^[A-Z0-9]+(_[A-Z0-9]+)+$', t): return False  # CONSTANT_CASE

    return True


def extrair_textos_sdui(raw_stream: str, vanity_name: str, secao_nome: str) -> List[str]:
    strings_cruas = re.findall(r'"((?:[^"\\]|\\.)*)"', raw_stream)
    textos_limpos = []

    if DEBUG:
        print(f"\n[{secao_nome}] Total de strings brutas encontradas: {len(strings_cruas)}")

    for s_crua in strings_cruas:
        try:
            texto = json.loads(f'"{s_crua}"').strip()

            # Chama o validador
            if eh_texto_humano(texto, vanity_name):
                if texto not in textos_limpos:
                    if DEBUG:
                        print(f"  ✅ ACEITO: {texto[:60]}..." if len(texto) > 60 else f"  ✅ ACEITO: {texto}")
                    textos_limpos.append(texto)
            else:
                pass
                # Se quiser ver MUITO lixo, descomente a linha abaixo para ver o que ele REJEITOU
                # if DEBUG: print(f"  ❌ RECUSADO: {texto[:60]}...")

        except:
            pass

    return textos_limpos


# ======================================================
#              FLUXO PRINCIPAL DE ANÁLISE
# ======================================================
def analyze_mega_file(vanity_name: str, file_path: str) -> FichaCandidato:
    print(f"🧠 Lendo dados brutos e montando ficha para: {vanity_name}\n" + "=" * 50)

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
    except FileNotFoundError:
        print(f"❌ Erro: Arquivo {file_path} não encontrado. Execute o extrator primeiro.")
        return None

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

    # 2. Analisa o About
    above_stream = raw_data.get("ProfileAboveActivity", "")
    if above_stream:
        textos_above = extrair_textos_sdui(above_stream, vanity_name, "HEADER / ABOUT")
        if textos_above:
            ficha.resumo_about = max(textos_above, key=len)

    # 3. Analisa as Experiências Profissionais
    below_stream = raw_data.get("ProfileBelowActivity", "")
    if below_stream:
        ficha.historico_e_experiencias = extrair_textos_sdui(below_stream, vanity_name, "EXPERIÊNCIAS / CURSOS")

    print("\n" + "=" * 60)
    print(f"📊 Ficha concluída: {ficha.nome_completo}")

    # Salva o arquivo JSON limpo
    ficha_path = f"ficha_{vanity_name}.json"
    with open(ficha_path, "w", encoding="utf-8") as f:
        f.write(ficha.to_json())

    print(f"📁 Ficha JSON estruturada salva em: {ficha_path}")
    return ficha


if __name__ == "__main__":
    target_name = "cibellysousa"
    mega_file = f"mega_raw_{target_name}.txt"
    analyze_mega_file(target_name, mega_file)
