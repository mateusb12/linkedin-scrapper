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


# ======================================================
#                    FILTRO DE TEXTO ÚTIL
# ======================================================
def eh_texto_humano(texto: str, vanity_name: str) -> bool:
    t = texto.strip()
    t_lower = t.lower()

    if t.startswith("🧠") or "🧠" in t:
        return True

    if len(t) < 5:
        return False
    if t_lower == vanity_name.lower() or t_lower == "secondary":
        return False

    # Filtro para lixo de React/Webpack (Ex: 12:I["ed8c681e...])
    if re.match(r'^\d+:[A-Z]\[".*?"', t):
        return False

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
        "expandbuttontext", "shouldcollapsenewlines", "expandbuttontextcolorexpression",
        "maxlinecountexpression", "onshowmoreaction", "onshowlessaction",
        "textcolorexpression", "isexpandabletextv2enabled", "designsystemimage",
        "memorynamespace", "textprops", "fontfamily", "fontsize", "fontstyle",
        "fontweight", "lineheight", "tagname", "textalign", "lineclamp", "wordbreak",
        "hasshowmore", "noopoverride", "bindingkey", "expansionkey", "statevalue",
        "renderpayload", "rooturl", "imagerenditions", "suffixurl", "selectionmethod",
        "imageid", "aria-label", "aria-hidden", "offsetstart", "offsetend", "alignself",
        "flexstart", "flexshrink", "booleanvalue", "intvalue", "triggerbutton",
        "1x", "1.5x", "2x", "3x", "4x", "5x", "6x", "fillavailable", "offsettop",
        "mensagem", "message", "ver perfil", "view profile", "p", "about", "sobre",
        "shoulduseimagetracking", "enablemediastatsfornerds", "enablehighqualityimagerendition"
    }
    if t_lower in lixo_exato:
        return False

    toxicos = [
        "com.linkedin.", "props:", "$type", "$case", "$undefined", "presentationstyle_",
        "colorscheme_", "modalsize_", "position_", "linkformatting_", "urn:li:",
        "$sreact", "proto.sdui", "width_and_height", "thumbnail for", "skills for ",
        "profile-card", "entity_image", "interactiontypes", "viewtrackingspecs", "certificate.pdf",
        "/in/", "?url=", "&body=", "subject=", "&intero", "%2c", "%20", "fsd_profile",
        "profileendorseskillbuttonloading", "expandable_text_block_auto-component",
        "experience-dividerentity", "experience-footer", "experience-position-total",
        "profile_education_top_anchor", "profile_experience_top_anchor",
        "company-logo_", "profile-treasury-image", "urn:li:digitalmediaasset",
        "===", "==", "sduimodalprovider", "sduiglobalstoreprovider", "qualtricssurveycontextprovider",
        "rtcmanager", "badgecountmanager", "debuginfoprovider", "toasts", "globalfeedback",
        "overlaymanager", "streamingsubscribers", "interopactionsubscriber", "dialogcontainer",
        "route", "errorpage"
    ]
    if any(x in t_lower for x in toxicos):
        return False

    padroes_sociais = [
        "you both studied", "vocês estudaram",
        "you both worked", "vocês trabalharam",
        "you both know", "vocês conhecem",
        "1st degree connection", "2nd degree connection", "3rd degree connection"
    ]
    if any(p in t_lower for p in padroes_sociais):
        return False

    if re.match(r'^[A-Za-z0-9+/=]{40,}$', t):
        return False

    if re.match(r'^[0-9\.]+(rem|em|px|vh|vw|x|%)$', t_lower):
        return False

    if t_lower.startswith("http://") or t_lower.startswith("https://"):
        return False

    if re.match(r'^\$[A-Za-z0-9\.]+$', t):
        return False
    if re.search(r'^\$[A-Za-z0-9]+:', t):
        return False

    if re.match(r'^[A-Za-z0-9\-_]{30,}$', t):
        return False
    if re.search(r'_[a-f0-9]{6,}', t):
        return False

    t_no_hyphen = t.replace("-", "")
    if re.match(r'^[a-f0-9]{32}$', t_no_hyphen.lower()):
        return False

    return True


# ======================================================
#               NOVA EXTRAÇÃO DE STRINGS HÍBRIDA
# ======================================================
def extrair_todos_textos(raw_stream: str, vanity_name: str) -> List[str]:
    textos_crus = extrair_strings_sem_filtro(raw_stream)
    textos_limpos = []
    for texto in textos_crus:
        if eh_texto_humano(texto, vanity_name) and texto not in textos_limpos:
            textos_limpos.append(texto)
    return textos_limpos


def extrair_strings_sem_filtro(raw_stream: str) -> List[str]:
    encontrados = []

    # 1. Padrão JSON normal (textos entre aspas) com Fallback Anti-Crash
    for match in re.finditer(r'"([^"\\]*(?:\\.[^"\\]*)*)"', raw_stream):
        s_crua = match.group(1)
        try:
            txt = json.loads(f'"{s_crua}"')
        except:
            try:
                txt = s_crua.encode('utf-8', 'ignore').decode('unicode_escape', 'ignore')
            except:
                txt = s_crua.replace('\\n', '\n').replace('\\"', '"')

        txt = txt.replace('\u200b', '').replace('\xa0', ' ').strip()
        if txt:
            encontrados.append((match.start(), txt))

    # 2. Padrão RSC / SDUI do LinkedIn (Textos soltos sem aspas)
    rsc_pattern = r':T\d+,(.*?)(?=\n[a-zA-Z_$]{1,3}:|\Z)'
    for match in re.finditer(rsc_pattern, raw_stream, flags=re.DOTALL):
        txt = match.group(1).replace('\u200b', '').replace('\xa0', ' ').strip()
        if txt:
            encontrados.append((match.start(), txt))

    encontrados.sort(key=lambda x: x[0])

    out = []
    vistos = set()
    for _, txt in encontrados:
        # Limpa Zero-Width Space invisível
        txt_clean = txt.replace('\u200b', '').strip()
        if txt_clean and txt_clean not in vistos:
            vistos.add(txt_clean)
            out.append(txt_clean)

    return out


# ======================================================
#     PARSER PRINCIPAL - ANALISAR ARQUIVO MEGA
# ======================================================
def analyze_mega_file(vanity_name: str, file_path: str) -> FichaCandidato:
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
    except FileNotFoundError:
        return None

    ficha = FichaCandidato(vanity_name=vanity_name)

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

        if not ficha.headline and ficha.nome_completo:
            nome_escaped = re.escape(ficha.nome_completo)
            regex_headline = rf'>{nome_escaped}</[a-zA-Z0-9]+>\s*(?:<[^>]+>\s*)*([^<]+)</'
            headline_match = re.search(regex_headline, main_html)

            if headline_match:
                ficha.headline = headline_match.group(1).strip()
                if len(ficha.headline) < 5 or ficha.headline.lower() == "linkedin":
                    ficha.headline = ""

    combined_streams = (
            raw_data.get("ProfileMain", "") +
            raw_data.get("ProfileAboveActivity", "") +
            raw_data.get("ProfileBelowActivity", "")
    )

    print(f"\n\n=======================================================")
    print(f"🕵️ DOSSIÊ DE DEBUG DO ABOUT: {ficha.nome_completo}")
    print(f"=======================================================")

    strings_raw = extrair_strings_sem_filtro(combined_streams)

    # Pre-filtragem pesada para não lidar com lixo
    textos_limpos = []
    for t in strings_raw:
        if eh_texto_humano(t, vanity_name) and t not in textos_limpos:
            textos_limpos.append(t)

    # ======================================================
    # ETAPA INVERTIDA: Extrair Experiências/Educação PRIMEIRO
    # ======================================================
    dados_estruturados = agrupar_dados_estruturados(textos_limpos)
    ficha.experiencias = dados_estruturados["experiencias"]
    ficha.formacao_academica = dados_estruturados["formacao_academica"]
    ficha.licencas_e_certificados = dados_estruturados["licencas_e_certificados"]
    ficha.competencias = dados_estruturados["competencias"]

    # POP ESTRATÉGICO: Coleta todas as descrições/títulos já pertencentes a vagas/formação
    textos_usados = set()
    for exp in ficha.experiencias:
        if exp.get("descricao"): textos_usados.add(exp["descricao"])
        if exp.get("cargo"): textos_usados.add(exp["cargo"])
        if exp.get("empresa"): textos_usados.add(exp["empresa"])
    for edu in ficha.formacao_academica:
        if edu.get("descricao"): textos_usados.add(edu["descricao"])
        if edu.get("instituicao"): textos_usados.add(edu["instituicao"])
        if edu.get("curso"): textos_usados.add(edu["curso"])
    for cert in ficha.licencas_e_certificados:
        if cert.get("nome"): textos_usados.add(cert["nome"])
    if ficha.headline:
        textos_usados.add(ficha.headline)

    STOP_SECTIONS = {
        "about", "sobre", "sobre mim",
        "top skills", "principais competências", "skills",
        "experience", "experiência",
        "education", "formação acadêmica", "formação",
        "projects", "projetos",
        "activity", "atividade",
        "featured", "destaques",
    }

    def is_section_header(s: str) -> bool:
        return s.strip().lower() in STOP_SECTIONS

    def looks_like_skills_line(s: str) -> bool:
        if "•" in s and "\n" not in s:
            parts = [p.strip() for p in s.split("•") if p.strip()]
            if len(parts) >= 3 and all(len(p) < 60 for p in parts):
                return True
        return False

    about_text = ""
    anchor_idx = None

    # Remove as informações já utilizadas do escopo de análise do About
    textos_disponiveis = [t for t in textos_limpos if t not in textos_usados]

    # TENTATIVA 1: O bloco de texto JÁ CONTÉM o título (Ex: Adriano Monteiro com o cérebro)
    for i, t in enumerate(textos_disponiveis):
        t_low = t.lower()
        t_clean = re.sub(r'^[\W_]+', '', t_low)

        if len(t) > 60 and (t_clean.startswith("sobre") or t_clean.startswith("about") or "🧠" in t_low):
            about_text = t
            print(f"🎯 [MÉTODO 1] ABOUT CAPTURADO EM BLOCO ÚNICO!")
            break

    # TENTATIVA 2: Busca por âncora tradicional no payload original (strings_raw tem a ordem correta)
    if not about_text:
        for i, t in enumerate(strings_raw):
            t_low = t.lower()
            if t_low in {"about", "sobre", "sobre mim"}:
                anchor_idx = i

        if anchor_idx is not None:
            about_lines = []
            print(f"⚓ [MÉTODO 2] Âncora encontrada no índice [{anchor_idx}].")
            for j in range(anchor_idx + 1, min(anchor_idx + 150, len(strings_raw))):
                st = strings_raw[j].strip()
                if not st: continue

                if is_section_header(st): break
                if not eh_texto_humano(st, vanity_name): continue
                if st in textos_usados: continue  # <- O "POP" aplicado! Pula o que já foi usado
                if looks_like_skills_line(st): continue

                low = st.lower()
                if low in {"see more", "ver mais", "show more", "mostrar mais", "edit", "editar"}: continue

                tokens = st.split()
                if tokens and all(re.match(r'^_?[a-f0-9]{6,10}$', tk) for tk in tokens): continue
                if " " not in st and len(st) < 15: continue

                about_lines.append(st)

            about_text = "\n".join(about_lines).strip()
            if about_text:
                print(f"✅ [MÉTODO 2] ABOUT FINALIZADO COM SUCESSO via âncora.")

    # TENTATIVA 3: A BALA DE PRATA (Maior Bloco de Texto Descolado)
    if not about_text:
        print("⚠ [FALLBACK] Âncora falhou. Procurando o maior bloco de texto livre no payload...")
        maior_bloco = ""

        for t in textos_disponiveis:
            # Avalia se a string tem cara de texto livre (não é apenas uma lista de palavras soltas)
            densidade_espacos = t.count(" ") / len(t) if len(t) > 0 else 0

            if len(t) > len(maior_bloco) and densidade_espacos > 0.05:  # Pelo menos 5% de espaços
                t_low = t.lower()
                # Impede que ele pegue cabeçalhos, cargos isolados ou recomendações
                if is_section_header(t): continue
                if " at " in t_low and len(t) < 100: continue
                if " na " in t_low and len(t) < 100: continue
                if "com.linkedin." in t_low: continue
                if re.match(r'^\d+:[A-Z]\[', t): continue

                maior_bloco = t

        if len(maior_bloco) > 100:
            about_text = maior_bloco
            print(f"🚀 [MÉTODO 3] SUCESSO! About capturado via Fallback do Maior Bloco ({len(about_text)} caracteres).")

    print(f"=======================================================\n")

    if about_text:
        # LIMPEZA FINAL DO ABOUT: Remove sujeiras estruturais (caso Adriano Monteiro)
        about_text = re.sub(r'a:\[.*?\]$', '', about_text, flags=re.DOTALL)  # Corta final zoado de json
        about_text = re.sub(r'\{"textProps":.*$', '', about_text, flags=re.DOTALL)  # Corta outro final zoado
        about_text = about_text.replace("\\n", "\n").strip()

    ficha.resumo_about = about_text

    ficha_path = f"ficha_{vanity_name}.json"
    with open(ficha_path, "w", encoding="utf-8") as f:
        f.write(ficha.to_json())

    return ficha


# ======================================================
#            AGRUPAMENTO ESTRUTURADO (EXPERIENCIAS)
# ======================================================
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
    ultima_empresa_lida = ""

    for i, t in enumerate(textos):

        if date_regex.search(t) and "Issued" not in t and "Emitido" not in t:
            role = ""
            empresa = ""
            tipo = ""

            c_str = textos[i - 1] if i >= 1 else ""
            r_str = textos[i - 2] if i >= 2 else ""

            if " · " in c_str:
                empresa, tipo = c_str.split(" · ", 1)
                role = r_str
                ultima_empresa_lida = empresa
            elif date_regex.search(r_str) or "yr" in r_str or "mos" in r_str or r_str in ["Full-time", "Part-time"]:
                role = c_str
                empresa = ultima_empresa_lida
            else:
                empresa = c_str
                role = r_str
                ultima_empresa_lida = empresa

            if len(role) < 3 or role.islower() or role == "expression":
                role = textos[i - 3] if i >= 3 else "Cargo Oculto"

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

            inicio, fim, duracao = "", "", ""
            if " · " in t:
                d_parts = t.split(" · ")
                datas = re.split(r'\s*(?:-|–)\s*', d_parts[0])
                inicio = datas[0].strip()
                if len(datas) > 1:
                    fim = datas[1].strip()
                duracao = d_parts[1].strip()
            else:
                datas = re.split(r'\s*(?:-|–)\s*', t)
                inicio = datas[0].strip()
                if len(datas) > 1:
                    fim = datas[1].strip()

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

        edu_keywords = ["universidade", "school", "faculdade", "college", "university", "institute", "puc", "senai",
                        "fatec"]
        if any(k in t.lower() for k in edu_keywords) and len(t) < 70:
            if not any(j['empresa'] == t for j in jobs_temp):
                instituicao = t
                curso = textos[i + 1] if i + 1 < len(textos) else ""
                if len(curso) > 80:
                    curso = ""

                edu_temp.append({
                    "instituicao": instituicao,
                    "curso": curso,
                    "header_idx": i
                })

    for job in jobs_temp:
        expected_tag = f"{job['cargo']} at {job['empresa']}".lower()
        expected_tag_br = f"{job['cargo']} na {job['empresa']}".lower()
        tag_found = False

        for i in range(job["date_idx"] + 1, len(textos)):
            t_low = textos[i].lower()
            if t_low == expected_tag or t_low == expected_tag_br:
                tag_found = True
                if i - 1 > job["loc_idx"] and len(textos[i - 1]) > 40:
                    job["descricao"] = textos[i - 1]

                if i + 1 < len(textos):
                    skill_str = textos[i + 1]
                    if re.search(r'(and|e)\s*\+\d+\s*(skills?|competências?)', skill_str.lower()):
                        s_raw = re.sub(r'(and|e)\s*\+\d+\s*(skills?|competências?)', '', skill_str,
                                       flags=re.IGNORECASE).replace(" and ", ", ").replace(" e ", ", ")
                        job["tecnologias"] = [s.strip() for s in s_raw.split(",") if s.strip() and len(s.strip()) < 30]
                break

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

    for edu in edu_temp:
        h_idx = edu["header_idx"]
        desc_idx = h_idx + 2 if edu["curso"] else h_idx + 1
        if desc_idx < len(textos):
            cand = textos[desc_idx]
            if len(cand) > 40 and not date_regex.search(
                    cand) and " at " not in cand and cand.lower() != "certifications" and cand.lower() != "licenças e certificados":
                edu["descricao"] = cand

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

            if i + 1 < len(textos):
                cand_name = textos[i + 1]
                if 5 < len(cand_name) < 50 and " at " not in cand_name and cand_name not in ["certifications",
                                                                                             "expression",
                                                                                             "licenças e certificados"] and not re.search(
                    r'(and|e)\s*\+\d+\s*(skills?)', cand_name.lower()):
                    if not any(c.get("nome") == cand_name for c in certificados):
                        certificados.append({
                            "nome": cand_name,
                            "instituicao": instituicao,
                            "data_emissao": t.replace("Issued ", "").replace("Emitido ", "")
                        })

    for job in jobs_temp:
        job.pop("date_idx", None)
        job.pop("loc_idx", None)
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
