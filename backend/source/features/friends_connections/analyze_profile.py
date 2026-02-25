import json
import re
from dataclasses import dataclass, field, asdict
from typing import List, Dict

DEBUG = True


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
    experiencias = []
    formacao = []
    certificados = []
    competencias = set()

    date_regex = re.compile(
        r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{4}|\b\d{4}\s*[-–]\s*(?:\d{4}|Present|Atual)\b)')
    modelos_trabalho = {"On-site", "Hybrid", "Remote", "Presencial", "Híbrido", "Remoto"}

    jobs_temp = []
    edu_temp = []

    # =========================================================
    # PASSO 1: Extrair Cabeçalhos (Âncoras de Estrutura)
    # =========================================================
    for i, t in enumerate(textos):

        # 1. Âncoras de Experiência (Identificadas pela Data)
        if date_regex.search(t) and "Issued" not in t and "Emitido" not in t:
            role = ""
            empresa = ""
            tipo = ""

            if i >= 2:
                c_str = textos[i - 1]
                r_str = textos[i - 2]

                if " · " in c_str:
                    empresa, tipo = c_str.split(" · ", 1)
                else:
                    empresa = c_str
                role = r_str

            # Limpar extrações ruins
            if len(role) < 3 or role.islower() or role == "expression": role = textos[
                i - 3] if i >= 3 else "Cargo Oculto"

            # Extrair Localização (geralmente logo após a data)
            localizacao = ""
            modelo = ""
            loc_idx = i
            if i + 1 < len(textos) and not date_regex.search(textos[i + 1]) and len(textos[i + 1]) < 60:
                loc_str = textos[i + 1]
                if " · " in loc_str and any(m in loc_str for m in modelos_trabalho):
                    localizacao, modelo = loc_str.split(" · ", 1)
                    loc_idx = i + 1
                elif loc_str in modelos_trabalho:
                    modelo = loc_str
                    loc_idx = i + 1
                elif " at " not in loc_str and " na " not in loc_str:
                    localizacao = loc_str
                    loc_idx = i + 1

            # Parsing de Datas
            inicio, fim, duracao = "", "", ""
            if " · " in t:
                d_parts = t.split(" · ")
                datas = re.split(r'\s*(?:-|–)\s*', d_parts[0])
                inicio = datas[0].strip()
                if len(datas) > 1: fim = datas[1].strip()
                duracao = d_parts[1].strip()
            else:
                datas = re.split(r'\s*(?:-|–)\s*', t)
                inicio = datas[0].strip()
                if len(datas) > 1: fim = datas[1].strip()

            jobs_temp.append({
                "empresa": empresa.strip(),
                "cargo": role.strip(),
                "tipo": tipo.strip(),
                "inicio": inicio,
                "fim": fim,
                "duracao": duracao,
                "localizacao": localizacao.strip(),
                "modelo_trabalho": modelo.strip(),
                "date_idx": i,
                "loc_idx": loc_idx,
                "descricao": "",
                "tecnologias": []
            })

        # 2. Âncoras de Educação (Identificadas por Palavras-Chave, já que não há datas)
        edu_keywords = ["universidade", "school", "faculdade", "college", "university", "institute", "puc", "senai",
                        "fatec"]
        if any(k in t.lower() for k in edu_keywords) and len(t) < 70:
            # Garante que não é apenas o nome da empresa de um emprego já capturado
            if not any(j['empresa'] == t for j in jobs_temp):
                instituicao = t
                curso = textos[i + 1] if i + 1 < len(textos) else ""
                if len(curso) > 80: curso = ""  # Proteção contra engolir descrições

                edu_temp.append({
                    "instituicao": instituicao,
                    "curso": curso,
                    "header_idx": i
                })

    # =========================================================
    # PASSO 2: Relacionar Descrições e Skills usando os Marcadores
    # =========================================================
    for job in jobs_temp:
        expected_tag = f"{job['cargo']} at {job['empresa']}".lower()
        expected_tag_br = f"{job['cargo']} na {job['empresa']}".lower()
        tag_found = False

        # Estratégia A: Caçar a Tag de Acessibilidade no DOM (resolve o caso do Freelance Invertido)
        for i in range(job["date_idx"] + 1, len(textos)):
            t_low = textos[i].lower()
            if t_low == expected_tag or t_low == expected_tag_br:
                tag_found = True
                # A descrição é o bloco gigante ANTES da tag
                if i - 1 > job["loc_idx"] and len(textos[i - 1]) > 40:
                    job["descricao"] = textos[i - 1]

                # As skills vêm DEPOIS da tag
                if i + 1 < len(textos):
                    skill_str = textos[i + 1]
                    if re.search(r'(and|e)\s*\+\d+\s*(skills?|competências?)', skill_str.lower()):
                        s_raw = re.sub(r'(and|e)\s*\+\d+\s*(skills?|competências?)', '', skill_str,
                                       flags=re.IGNORECASE).replace(" and ", ", ").replace(" e ", ", ")
                        job["tecnologias"] = [s.strip() for s in s_raw.split(",") if s.strip() and len(s.strip()) < 30]
                break

        # Estratégia B: Se não tem Tag amaradora, pegar a sequência visual (resolve o caso Dexian)
        if not tag_found:
            desc_cand_idx = job["loc_idx"] + 1
            if desc_cand_idx < len(textos):
                cand = textos[desc_cand_idx]
                if len(cand) > 60 and " at " not in cand and not date_regex.search(cand):
                    job["descricao"] = cand

                    skill_cand_idx = desc_cand_idx + 1
                    if skill_cand_idx < len(textos):
                        skill_str = textos[skill_cand_idx]
                        if re.search(r'(and|e)\s*\+\d+\s*(skills?|competências?)', skill_str.lower()):
                            s_raw = re.sub(r'(and|e)\s*\+\d+\s*(skills?|competências?)', '', skill_str,
                                           flags=re.IGNORECASE).replace(" and ", ", ").replace(" e ", ", ")
                            job["tecnologias"] = [s.strip() for s in s_raw.split(",") if
                                                  s.strip() and len(s.strip()) < 30]

        for skill in job["tecnologias"]:
            competencias.add(skill)

    # Assinar Descrição da Educação sequencialmente
    for edu in edu_temp:
        h_idx = edu["header_idx"]
        desc_idx = h_idx + 2 if edu["curso"] else h_idx + 1
        if desc_idx < len(textos):
            cand = textos[desc_idx]
            if len(cand) > 40 and not date_regex.search(
                    cand) and " at " not in cand and cand.lower() != "certifications":
                edu["descricao"] = cand

    # =========================================================
    # PASSO 3: Resgate Híbrido de Certificados
    # =========================================================
    for i, t in enumerate(textos):
        if "Issued" in t or "Emitido" in t:
            nome_cert = textos[i - 2] if i > 1 else (textos[i - 1] if i > 0 else "")
            instituicao = textos[i - 1] if i > 0 else ""

            if len(nome_cert) > 60:
                nome_cert = textos[i - 1] if i > 0 else ""
                instituicao = ""

            if not any(c.get("nome") == nome_cert for c in certificados):
                certificados.append({
                    "nome": nome_cert,
                    "instituicao": instituicao,
                    "data_emissao": t.replace("Issued ", "").replace("Emitido ", "")
                })

            # Resgate: Puxa o certificado da linha de baixo que ficou sem a palavra "Issued" (Ex: MERN)
            if i + 1 < len(textos):
                cand_name = textos[i + 1]
                if 5 < len(cand_name) < 50 and " at " not in cand_name and cand_name not in ["certifications",
                                                                                             "expression"] and not re.search(
                    r'(and|e)\s*\+\d+\s*(skills?)', cand_name.lower()):
                    if not any(c.get("nome") == cand_name for c in certificados):
                        certificados.append({
                            "nome": cand_name,
                            "instituicao": instituicao,  # Assume mesmo emissor
                            "data_emissao": t.replace("Issued ", "").replace("Emitido ", "")  # Assume mesma data
                        })

    # =========================================================
    # CLEANUP: Remoção de chaves temporárias e vazias
    # =========================================================
    for job in jobs_temp:
        job.pop("date_idx", None)
        job.pop("loc_idx", None)
        # Limpa chaves vazias para JSON ficar enxuto
        experiencias.append({k: v for k, v in job.items() if v or k == "tecnologias"})
        if not experiencias[-1].get("tecnologias"):
            experiencias[-1].pop("tecnologias", None)

    for edu in edu_temp:
        edu.pop("header_idx", None)
        formacao.append({k: v for k, v in edu.items() if v})

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
