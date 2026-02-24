import json
import re
from dataclasses import dataclass, field, asdict
from typing import List, Dict

DEBUG = False


# ======================================================
#              ESTRUTURA DE DADOS (JSON FORMATADO)
# ======================================================
@dataclass
class FichaCandidato:
    vanity_name: str = ""
    nome_completo: str = ""
    headline: str = ""
    resumo_about: str = ""
    experiencias: List[dict] = field(default_factory=list)
    formacao_academica: List[dict] = field(default_factory=list)
    licencas_e_certificados: List[dict] = field(default_factory=list)
    competencias: List[str] = field(default_factory=list)

    def to_json(self):
        return json.dumps(asdict(self), indent=2, ensure_ascii=False)


def eh_texto_humano(texto: str, vanity_name: str) -> bool:
    t = texto.strip()
    t_lower = t.lower()

    if len(t) < 5: return False
    if t_lower == vanity_name.lower() or t_lower == "secondary": return False

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
        "experience", "education", "licenses & certifications", "skills"
    }
    if t_lower in lixo_exato: return False

    toxicos = [
        "com.linkedin.", "props:", "$type", "$case", "$undefined", "presentationstyle_",
        "colorscheme_", "modalsize_", "position_", "linkformatting_", "urn:li:",
        "$sreact", "proto.sdui", "width_and_height", "logo", "thumbnail for", "skills for ",
        "profile-card", "entity_image", "interactiontypes", "viewtrackingspecs", "certificate.pdf",
        "/in/", "?url="
    ]
    if any(x in t_lower for x in toxicos): return False

    if t.endswith("==") or t.endswith("="):
        if re.match(r'^[A-Za-z0-9+/=]{15,}$', t): return False
    if re.match(r'^[0-9\.]+(rem|em|px|vh|vw|x|%)$', t_lower): return False
    if t_lower.startswith("http://") or t_lower.startswith("https://"): return False

    if re.match(r'^\$[A-Za-z0-9]+$', t): return False
    if re.search(r'^\$[A-Za-z0-9]+:', t): return False
    if re.match(r'^[A-Za-z0-9\-_]{20,}$', t): return False
    if re.search(r'_[a-f0-9]{6,}', t) or re.search(r'\b[a-f0-9]{8,}\b', t): return False
    if re.match(r'^[a-z]+[A-Z][a-zA-Z0-9]*$', t): return False
    if re.match(r'^[A-Z][a-z]+[A-Z][a-zA-Z0-9]*$', t): return False
    if re.match(r'^[a-z0-9]+(-[a-z0-9]+)+$', t): return False
    if re.match(r'^[a-z0-9]+(_[a-z0-9]+)+$', t): return False
    if re.match(r'^[A-Z0-9]+(_[A-Z0-9]+)+$', t): return False

    return True


def agrupar_dados_estruturados(textos: List[str]) -> Dict:
    """
    O Agrupador Inteligente: Varre a lista de textos limpos usando Expressões
    Regulares de Datas como "âncoras" para saber onde um emprego começa e termina.
    """
    experiencias = []
    formacao = []
    certificados = []
    competencias = set()

    date_regex = re.compile(r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{4}')
    duracao_regex = re.compile(r'^\d+\s*(yr|yrs|mo|mos).*$')
    tipo_trabalho = {"Full-time", "Part-time", "Self-employed", "Freelance", "Contract", "Internship", "Apprenticeship"}
    modelos_trabalho = {"On-site", "Hybrid", "Remote"}

    anchors = []
    for i, t in enumerate(textos):
        if date_regex.search(t) and "Issued" not in t:
            anchors.append(i)

    last_empresa = ""

    for idx, anchor_idx in enumerate(anchors):
        date_str = textos[anchor_idx]

        # Pega as últimas 4 strings antes da data (É onde o LinkedIn esconde Empresa e Cargo)
        window = textos[max(0, anchor_idx - 4): anchor_idx]
        window.reverse()  # Inverte para ler de trás pra frente a partir da data

        role = ""
        tipo = ""
        empresa = ""

        w_idx = 0
        if w_idx < len(window):
            if window[w_idx] in tipo_trabalho:
                tipo = window[w_idx]
                w_idx += 1
            elif " · " in window[w_idx]:  # Ex: Escolinha do PRECE · Apprenticeship
                parts = window[w_idx].split(" · ")
                if len(parts) == 2 and parts[1] in tipo_trabalho:
                    tipo = parts[1]
                    empresa = parts[0]
                    w_idx += 1

        if w_idx < len(window):
            role = window[w_idx]
            w_idx += 1

        if w_idx < len(window) and duracao_regex.match(window[w_idx]):
            w_idx += 1  # Ignora string de duração total da empresa

        if w_idx < len(window) and not empresa:
            c = window[w_idx]
            # Validação heurística para garantir que não estamos pegando um texto longo como empresa
            if len(c) < 60 and " at " not in c and c not in modelos_trabalho:
                empresa = c

        # Se a empresa não foi encontrada no topo do bloco, herda do emprego anterior (Cargos aninhados)
        if not empresa:
            empresa = last_empresa
        else:
            last_empresa = empresa

        # Separa Formação Acadêmica de Experiência
        is_edu = any(word in empresa for word in ["Universidade", "School", "EEEP", "Institute"]) or \
                 any(word in role for word in ["Bacharelado", "Curso", "Degree"])

        if is_edu:
            edu = {"instituicao": empresa, "curso": role}
            if " - " in date_str or " – " in date_str:
                parts = re.split(r'\s*(?:-|–)\s*', date_str)
                edu["inicio"] = parts[0].strip()
                edu["fim"] = parts[1].strip() if len(parts) > 1 else ""
            formacao.append(edu)

        else:
            job = {"empresa": empresa, "cargo": role}
            if tipo: job["tipo"] = tipo

            # Quebra Data e Duração (Ex: Sep 2025 - Present · 6 mos)
            if " · " in date_str:
                parts = date_str.split(" · ")
                d_parts = re.split(r'\s*(?:-|–)\s*', parts[0])
                job["inicio"] = d_parts[0].strip()
                job["fim"] = d_parts[1].strip() if len(d_parts) > 1 else ""
                job["duracao"] = parts[1].strip()
            else:
                parts = re.split(r'\s*(?:-|–)\s*', date_str)
                job["inicio"] = parts[0].strip()
                job["fim"] = parts[1].strip() if len(parts) > 1 else ""

            # Varredura pra frente (Busca Local, Modalidade, Skills e Descrição)
            next_anchor = anchors[idx + 1] if idx + 1 < len(anchors) else len(textos)
            tecnologias = []

            for j in range(anchor_idx + 1, next_anchor):
                val = textos[j]
                if val in modelos_trabalho:
                    job["modelo_trabalho"] = val
                elif "Brazil" in val or "Brasil" in val or " · " in val:
                    if " · " in val and val.split(" · ")[1] in modelos_trabalho:
                        job["localizacao"] = val.split(" · ")[0].strip()
                        job["modelo_trabalho"] = val.split(" · ")[1].strip()
                    elif len(val) < 40:
                        job["localizacao"] = val
                elif len(val) > 50:
                    job["descricao"] = val
                elif " and " in val or " e " in val or "skills" in val:  # Extrai skills embaralhadas
                    s_raw = re.sub(r'and \+\d+ skills?', '', val).replace(" and ", ", ").replace(" e ", ", ")
                    for s in s_raw.split(","):
                        if s.strip():
                            tecnologias.append(s.strip())
                            competencias.add(s.strip())
                elif val in ["Serviços técnicos", "Ensino de matemática", "Matemática básica"]:
                    job["area"] = val

            if tecnologias:
                job["tecnologias"] = tecnologias

            # Bloqueador de Duplicatas (Resolve o bug do modal repetindo vagas)
            is_dup = any(e.get("cargo") == job["cargo"] and e.get("inicio") == job["inicio"] for e in experiencias)
            if not is_dup:
                experiencias.append(job)

    # ---------------------------------------------
    # EXTRAÇÃO DE CERTIFICADOS ISOLADA
    # ---------------------------------------------
    for i, t in enumerate(textos):
        if "Issued" in t:
            nome_cert = textos[i - 1] if i > 0 else ""
            if not any(c.get("nome") == nome_cert for c in certificados):
                certificados.append({"nome": nome_cert, "emissao": t.replace("Issued ", "")})
        elif t in ["Introduction to Data Quality", "Data Management Concepts"] and not any(
                c.get("nome") == t for c in certificados):
            certificados.append({"nome": t})

    # Pega competências clássicas perdidas
    known_skills = ["Administração de dados", "Qualidade dos dados", "Python", "SQL", "Data Analysis", "Tailwind CSS",
                    "Next.js", "WordPress", "Linux", "Troubleshooting", "Elementor", "WPBakery"]
    for t in textos:
        if t in known_skills: competencias.add(t)

    return {
        "experiencias": experiencias,
        "formacao_academica": formacao,
        "licencas_e_certificados": certificados,
        "competencias": list(competencias)
    }


def extrair_todos_textos(raw_stream: str, vanity_name: str) -> List[str]:
    strings_cruas = re.findall(r'"((?:[^"\\]|\\.)*)"', raw_stream)
    textos_limpos = []
    for s_crua in strings_cruas:
        try:
            texto = json.loads(f'"{s_crua}"').strip()
            if eh_texto_humano(texto, vanity_name) and texto not in textos_limpos:
                textos_limpos.append(texto)
        except:
            pass
    return textos_limpos


def analyze_mega_file(vanity_name: str, file_path: str) -> FichaCandidato:
    print(f"🧠 Montando ficha 100% estruturada via Python para: {vanity_name}\n" + "=" * 50)

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
    except FileNotFoundError:
        print(f"❌ Erro: Arquivo {file_path} não encontrado.")
        return None

    ficha = FichaCandidato(vanity_name=vanity_name)

    # 1. Puxa HTML Principal
    main_html = raw_data.get("ProfileMain", "")
    if main_html:
        # Tenta puxar pelo Título primeiro (Padrão mais antigo do LinkedIn)
        titulo_match = re.search(r'<title>(.*?)</title>', main_html)
        if titulo_match:
            titulo_limpo = titulo_match.group(1).replace(" | LinkedIn", "").strip()
            if " - " in titulo_limpo:
                partes = titulo_limpo.split(" - ", 1)
                ficha.nome_completo = partes[0].strip()
                ficha.headline = partes[1].strip()
            else:
                ficha.nome_completo = titulo_limpo

        # O PULO DO GATO: Se o Headline não veio no título, escaneia o DOM bruto
        if not ficha.headline and ficha.nome_completo:
            nome_escaped = re.escape(ficha.nome_completo)
            # Regex: Acha o Nome fechando tag -> ignora as tags HTML seguintes -> captura o primeiro texto real
            regex_headline = rf'>{nome_escaped}</[a-zA-Z0-9]+>\s*(?:<[^>]+>\s*)*([^<]+)</'
            headline_match = re.search(regex_headline, main_html)

            if headline_match:
                ficha.headline = headline_match.group(1).strip()
                # Ocasionalmente o React injeta lixo, validamos o tamanho para ter certeza
                if len(ficha.headline) < 5 or ficha.headline.lower() == "linkedin":
                    ficha.headline = ""

    # 2. Resumo (About)
    above_stream = raw_data.get("ProfileAboveActivity", "")
    if above_stream:
        header_texts = extrair_todos_textos(above_stream, vanity_name)
        if header_texts:
            ficha.resumo_about = max(header_texts, key=len)

    # 3. Categorização de Dados
    below_stream = raw_data.get("ProfileBelowActivity", "")
    if below_stream:
        todos_textos = extrair_todos_textos(below_stream, vanity_name)

        # O processador Python em Ação
        dados_estruturados = agrupar_dados_estruturados(todos_textos)

        ficha.experiencias = dados_estruturados["experiencias"]
        ficha.formacao_academica = dados_estruturados["formacao_academica"]
        ficha.licencas_e_certificados = dados_estruturados["licencas_e_certificados"]
        ficha.competencias = dados_estruturados["competencias"]

    print("\n" + "=" * 60)
    print(f"📊 Ficha concluída e categorizada: {ficha.nome_completo}")
    print(f"🎯 Headline encontrado: {ficha.headline[:50]}...")

    ficha_path = f"ficha_{vanity_name}.json"
    with open(ficha_path, "w", encoding="utf-8") as f:
        f.write(ficha.to_json())

    print(f"📁 Ficha JSON ESTRUTURADA salva em: {ficha_path}")
    return ficha


if __name__ == "__main__":
    target_name = "monicasbusatta"
    mega_file = f"mega_raw_{target_name}.txt"
    analyze_mega_file(target_name, mega_file)
