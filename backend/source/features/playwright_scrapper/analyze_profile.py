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

    if DEBUG:
        print("\n" + "=" * 50)
        print("🔍 [DEBUG] LISTA DE TEXTOS EXTRAÍDOS (ÍNDICE: TEXTO)")
        print("=" * 50)
        for i, t in enumerate(textos):
            print(f"[{i:03d}] {t}")
        print("=" * 50 + "\n")

    date_regex = re.compile(
        r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{4}|\b\d{4}\s*[-–]\s*(?:\d{4}|Present|Atual)\b)')
    duracao_regex = re.compile(r'^\d+\s*(yr|yrs|mo|mos|ano|anos|mês|meses).*$')
    tipo_trabalho = {"Full-time", "Part-time", "Self-employed", "Freelance", "Contract", "Internship", "Apprenticeship",
                     "Tempo integral", "Meio período"}
    modelos_trabalho = {"On-site", "Hybrid", "Remote", "Presencial", "Híbrido", "Remoto"}

    anchors = []
    for i, t in enumerate(textos):
        if date_regex.search(t) and "Issued" not in t and "Emitido" not in t:
            anchors.append(i)

    blocos = []
    last_empresa = ""

    for anchor_idx in anchors:
        date_str = textos[anchor_idx]
        window = textos[max(0, anchor_idx - 5): anchor_idx]
        window.reverse()

        w_idx = 0
        tipo = ""
        empresa = ""
        role = ""

        if w_idx < len(window):
            if window[w_idx] in tipo_trabalho:
                tipo = window[w_idx]
                w_idx += 1
            elif " · " in window[w_idx]:
                parts = window[w_idx].split(" · ")
                if len(parts) == 2 and parts[1] in tipo_trabalho:
                    tipo = parts[1]
                    empresa = parts[0]
                    w_idx += 1

        if w_idx < len(window):
            role = window[w_idx]
            w_idx += 1

        if w_idx < len(window) and duracao_regex.match(window[w_idx]):
            w_idx += 1

        if w_idx < len(window) and not empresa:
            c = window[w_idx]
            if len(c) < 70 and " at " not in c and c not in modelos_trabalho:
                empresa = c
                w_idx += 1

        if not empresa:
            empresa = last_empresa
        else:
            last_empresa = empresa

        start_idx = anchor_idx - w_idx

        blocos.append({
            "start_idx": start_idx,
            "anchor_idx": anchor_idx,
            "empresa": empresa,
            "role": role,
            "tipo": tipo,
            "date_str": date_str
        })

    for i, bloco in enumerate(blocos):
        empresa = bloco["empresa"]
        role = bloco["role"]
        date_str = bloco["date_str"]
        tipo = bloco["tipo"]

        is_edu = any(word.lower() in empresa.lower() for word in
                     ["universidade", "school", "eeep", "institute", "faculdade", "college", "university", "puc",
                      "senai", "fatec"]) or \
                 any(word.lower() in role.lower() for word in
                     ["bacharelado", "curso", "degree", "graduação", "bachelor", "master", "phd", "tecnologia",
                      "licenciatura"])

        obj = {}
        if is_edu:
            obj["instituicao"] = empresa
            obj["curso"] = role
        else:
            obj["empresa"] = empresa
            obj["cargo"] = role
            if tipo: obj["tipo"] = tipo

        if " · " in date_str:
            parts = date_str.split(" · ")
            d_parts = re.split(r'\s*(?:-|–)\s*', parts[0])
            obj["inicio"] = d_parts[0].strip()
            obj["fim"] = d_parts[1].strip() if len(d_parts) > 1 else ""
            if not is_edu: obj["duracao"] = parts[1].strip()
        else:
            parts = re.split(r'\s*(?:-|–)\s*', date_str)
            obj["inicio"] = parts[0].strip()
            obj["fim"] = parts[1].strip() if len(parts) > 1 else ""

        body_start = bloco["anchor_idx"] + 1
        if body_start < len(textos) and duracao_regex.match(textos[body_start]):
            if not is_edu: obj["duracao"] = textos[body_start]
            body_start += 1

        body_end = blocos[i + 1]["start_idx"] if i + 1 < len(blocos) else len(textos)
        tecnologias = []

        # =========================================================
        # LOOP ESTRUTURAL GENÉRICO (Com Boundaries de Segurança)
        # =========================================================
        for j in range(body_start, body_end):
            val = textos[j]

            # Barreira: Se bater em Educação ou Certificados, encerra o bloco de Experiência atual
            if any(w in val.lower() for w in
                   ["universidade", "school", "faculdade", "college", "university", "certifications"]):
                if len(val) < 80:
                    if DEBUG: print(f"  [{j:03d}] 🛑 Barreira ativada. Encerrando bloco.")
                    break

            # Ignora lixo de Certificados soltos nas experiências
            if any(w in val for w in ["Issued", "Emitido", "Udemy", "Credential"]):
                continue

            # 1. Mata-Lixo de Acessibilidade ("Cargo at Empresa" injetado pelo LinkedIn)
            if (" at " in val or " na " in val) and (empresa in val or role in val):
                continue

            # 2. Modelo de Trabalho solto
            if val in modelos_trabalho:
                obj["modelo_trabalho"] = val
                continue

            # 3. Extração de Habilidades (Regex estrita focada no padrão exato do LinkedIn)
            if re.search(r'(and|e)\s*\+\d+\s*(skills?|competências?)', val.lower()):
                s_raw = re.sub(r'(and|e)\s*\+\d+\s*(skills?|competências?)', '', val, flags=re.IGNORECASE).replace(
                    " and ", ", ").replace(" e ", ", ")
                for s in s_raw.split(","):
                    if s.strip() and len(s.strip()) < 30:
                        tecnologias.append(s.strip())
                        competencias.add(s.strip())
                continue

            # 4. A REGRA ESTRUTURAL (Local vs Descrição)
            if " · " in val and any(m in val for m in modelos_trabalho):
                partes = val.split(" · ")
                obj["localizacao"] = partes[0].strip()
                obj["modelo_trabalho"] = partes[1].strip()

            elif len(val) < 60 and "descricao" not in obj and "localizacao" not in obj and " at " not in val:
                obj["localizacao"] = val

            else:
                if len(val) > 10:
                    if "descricao" not in obj:
                        obj["descricao"] = val
                    else:
                        obj["descricao"] += "\n\n" + val

        if tecnologias and not is_edu:
            obj["tecnologias"] = tecnologias

        if is_edu:
            is_dup = any(e.get("curso") == obj.get("curso") and e.get("inicio") == obj.get("inicio") for e in formacao)
            if not is_dup: formacao.append(obj)
        else:
            is_dup = any(
                e.get("cargo") == obj.get("cargo") and e.get("inicio") == obj.get("inicio") for e in experiencias)
            if not is_dup: experiencias.append(obj)

    # =========================================================
    # CORREÇÃO: Busca de Certificados (Nome e Instituição)
    # =========================================================
    for i, t in enumerate(textos):
        if "Issued" in t or "Emitido" in t:
            # Pela ordem do LinkedIn: [i-2] é o Nome, [i-1] é a Instituição
            nome_cert = textos[i - 2] if i > 1 else (textos[i - 1] if i > 0 else "")
            instituicao = textos[i - 1] if i > 0 else ""

            # Prevenir que pegue a string errada se a ordem vier diferente
            if len(nome_cert) > 60:
                nome_cert = textos[i - 1] if i > 0 else ""

            if not any(c.get("nome") == nome_cert for c in certificados):
                certificados.append({
                    "nome": nome_cert,
                    "instituicao": instituicao,
                    "data_emissao": t.replace("Issued ", "").replace("Emitido ", "")
                })

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
