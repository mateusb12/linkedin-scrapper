import json
import re
from dataclasses import dataclass, field, asdict
from typing import List, Dict

DEBUG = True


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


LIXO_EXATO = {
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
    "mensagem", "message", "ver perfil", "view profile", "p",
    "shoulduseimagetracking", "enablemediastatsfornerds", "enablehighqualityimagerendition",
    "require-trusted-types-for", "trusted-types", "dompurify", "goog#html", "jsecure"
}

TOXICOS = [
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
    "route", "errorpage", "&#x27;"
]

PADROES_SOCIAIS = [
    "you both studied", "vocês estudaram",
    "you both worked", "vocês trabalharam",
    "you both know", "vocês conhecem",
    "1st degree connection", "2nd degree connection", "3rd degree connection"
]


def eh_texto_humano(texto: str, vanity_name: str) -> bool:
    t = texto.strip()
    t_lower = t.lower()

    if t.startswith("🧠") or "🧠" in t:
        return True

    if len(t) < 3:
        return False
    if t_lower == vanity_name.lower() or t_lower == "secondary":
        return False

    if re.match(r'^\d+:[A-Z]\[', t):
        return False

    if t_lower in LIXO_EXATO:
        return False

    if any(x in t_lower for x in TOXICOS):
        return False

    if any(p in t_lower for p in PADROES_SOCIAIS):
        return False

    if re.match(r'^[A-Za-z0-9+/=]{40,}$', t): return False
    if re.match(r'^[0-9\.]+(rem|em|px|vh|vw|x|%)$', t_lower): return False
    if t_lower.startswith("http://") or t_lower.startswith("https://"): return False
    if re.match(r'^\$[A-Za-z0-9\.]+$', t): return False
    if re.search(r'^\$[A-Za-z0-9]+:', t): return False
    if re.match(r'^[A-Za-z0-9\-_]{30,}$', t): return False
    if re.search(r'_[a-f0-9]{6,}', t): return False
    if re.match(r'^[a-f0-9]{32}$', t.replace("-", "").lower()): return False

    return True


def extrair_strings_sem_filtro(raw_stream: str) -> List[str]:
    encontrados = []

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

    rsc_pattern = r':T\d+,(.*?)(?=\n[a-zA-Z_$]{1,3}:|\Z)'
    for match in re.finditer(rsc_pattern, raw_stream, flags=re.DOTALL):
        txt = match.group(1).replace('\u200b', '').replace('\xa0', ' ').strip()
        if txt:
            encontrados.append((match.start(), txt))

    encontrados.sort(key=lambda x: x[0])

    out = []
    vistos = set()
    for _, txt in encontrados:
        txt_clean = txt.replace('\u200b', '').strip()
        if txt_clean and txt_clean not in vistos:
            vistos.add(txt_clean)
            out.append(txt_clean)

    return out


def _normalize_text(t: str) -> str:
    if not t:
        return ""
    t = t.replace("\\n", "\n")
    t = t.replace("\u200b", "").replace("\xa0", " ")
    t = re.sub(r"[ \t]+\n", "\n", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def extrair_about_generico(combined_streams: str, vanity_name: str, strings_raw: List[str] | None = None) -> str:
    hay = combined_streams
    low = hay.lower()

    anchors = [
        ("profile-card-about", "profile-card-about"),
        ("aboutSection", "com.linkedin.sdui.impl.profile.components.aboutsection"),
        ("about-word", "about"),
    ]

    start_pos = -1
    anchor_used = None
    for label, a in anchors:
        p = low.find(a.lower())
        if p != -1:
            start_pos = p
            anchor_used = label
            break

    if DEBUG:
        print(f"\n🧭 ABOUT DEBUG: start_pos={start_pos} anchor_used={anchor_used}")

    # fallback: via strings_raw (não é o foco agora)
    if start_pos == -1 and strings_raw:
        try:
            idx = next(i for i, t in enumerate(strings_raw) if t.strip().lower() == "about")
        except StopIteration:
            return ""
        buf = []
        for j in range(idx + 1, min(len(strings_raw), idx + 80)):
            t = strings_raw[j].strip()
            if not t:
                continue
            tl = t.lower()
            if tl in ("experience", "experiência"):
                break
            if "profile-card-experience" in tl or "profile_experience_top_anchor" in tl:
                break
            if eh_texto_humano(t, vanity_name):
                buf.append(t)
                if sum(len(x) for x in buf) > 2500:
                    break
        return _normalize_text("\n".join(buf))

    if start_pos == -1:
        return ""

    window = hay[start_pos:start_pos + 200000]

    # primeiro texto humano grande entre aspas após a âncora
    candidates = []
    for m in re.finditer(r'"([^"\\]*(?:\\.[^"\\]*)*)"', window):
        s_crua = m.group(1)
        try:
            txt = json.loads(f'"{s_crua}"')
        except:
            txt = s_crua.replace('\\n', '\n').replace('\\"', '"')

        txt = txt.replace("\u200b", "").replace("\xa0", " ").strip()
        if not txt:
            continue
        if len(txt) < 80:
            continue
        if not eh_texto_humano(txt, vanity_name):
            continue

        score = 1 if (re.search(r'\s(at|na)\s', txt.lower()) and len(txt) < 140) else 2
        candidates.append((score, m.start(), txt))
        if len(candidates) >= 8:
            break

    if not candidates:
        if DEBUG:
            print("🧭 ABOUT DEBUG: sem candidates (strings humanas) depois da âncora.")
        return ""

    candidates.sort(key=lambda x: (-x[0], x[1]))
    rel_start = candidates[0][1]
    about_start = start_pos + rel_start

    if DEBUG:
        print(f"🧭 ABOUT DEBUG: about_start(abs)={about_start} rel_start={rel_start}")

    chunk = hay[about_start:about_start + 20000]

    if DEBUG:
        head = chunk[:140].replace("\n", "\\n")
        tail = chunk[-140:].replace("\n", "\\n")
        print(f"🧭 ABOUT DEBUG: chunk HEAD(before trim)={head!r}")
        print(f"🧭 ABOUT DEBUG: chunk TAIL(before trim)={tail!r}")

    # ======================================================
    # START-TRIM (debugado)
    # - remove prefixo tipo "e:T5d3," / "13:T834," mesmo se não tiver boundary bonitinho
    # ======================================================
    prefix_re = re.compile(r'([A-Za-z0-9]{1,4}:T[0-9A-Za-z]{2,8},)')
    m = prefix_re.search(chunk[:220])
    if DEBUG:
        if m:
            print("🧭 ABOUT DEBUG: prefix_match=", repr(m.group(1)), "at=", m.start())
        else:
            print("🧭 ABOUT DEBUG: prefix_match=None at=None")

    if m:
        chunk = chunk[m.end():]

    # corta lixo antes da primeira letra (se sobrar algum ]}]] etc)
    m2 = re.search(r'[A-Za-zÀ-ÿ]', chunk[:200])
    if DEBUG:
        print(f"🧭 ABOUT DEBUG: first_letter_pos={m2.start() if m2 else None}")

    if m2 and 0 < m2.start() < 120:
        chunk = chunk[m2.start():]

    if DEBUG:
        head2 = chunk[:140].replace("\n", "\\n")
        print(f"🧭 ABOUT DEBUG: chunk HEAD(after trim)={head2!r}")

    # ======================================================
    # STOP (debugado): corta na primeira estrutura SDUI / próxima seção
    # ======================================================
    stop_patterns = [
        ('STOP_f', '\nf:["$","$'),
        ('STOP_a', '\na:["$","$'),
        ('STOP_0div', '\n0:["$","div'),
        ('STOP_stream_I', '\n14:I['),
        ('STOP_experience_card', 'profile-card-experience'),
        ('STOP_experience_anchor', 'profile_experience_top_anchor'),
        ('STOP_experience_word', '\nExperience\n'),
        ('STOP_experiencia_word', '\nExperiência\n'),
    ]

    stop_pos = None
    stop_hit = None
    chunk_low = chunk.lower()
    for label, sp in stop_patterns:
        p = chunk_low.find(sp.lower())
        if p != -1:
            if stop_pos is None or p < stop_pos:
                stop_pos = p
                stop_hit = (label, sp, p)

    if DEBUG:
        print(f"🧭 ABOUT DEBUG: stop_hit={stop_hit}")

        # mostra um preview ao redor do stop, se houver
        if stop_pos is not None:
            around = chunk[max(0, stop_pos - 60): stop_pos + 120].replace("\n", "\\n")
            print(f"🧭 ABOUT DEBUG: around_stop={around!r}")

    if stop_pos is not None and stop_pos > 50:
        chunk = chunk[:stop_pos]

    chunk = _normalize_text(chunk)

    # corte final anti-contaminação (sem prints)
    contaminations = [
        'a:["$","$',
        'f:["$","$',
        '0:["$","div',
        'proto.sdui',
        'com.linkedin.sdui',
    ]
    cl = chunk.lower()
    cut2 = None
    for c in contaminations:
        p = cl.find(c)
        if p != -1:
            cut2 = p if cut2 is None else min(cut2, p)
    if cut2 is not None and cut2 > 50:
        chunk = chunk[:cut2].strip()

    return chunk


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
            raw_data.get("ProfileMain", "") + "\n" +
            raw_data.get("ProfileAboveActivity", "") + "\n" +
            raw_data.get("ProfileBelowActivity", "")
    )

    strings_raw = extrair_strings_sem_filtro(combined_streams)
    textos_limpos = [t for t in strings_raw if eh_texto_humano(t, vanity_name)]

    ficha.resumo_about = extrair_about_generico(combined_streams, vanity_name, strings_raw=strings_raw)

    if DEBUG:
        if ficha.resumo_about:
            print("\n✅ ABOUT (genérico) ENCONTRADO!")
            print(f"   len={len(ficha.resumo_about)}")
            print(f"   preview={ficha.resumo_about[:160].replace(chr(10), ' ')}...")
        else:
            print("\n❌ ABOUT (genérico) NÃO encontrado.")

    dados_estruturados = agrupar_dados_estruturados(textos_limpos)
    ficha.experiencias = dados_estruturados["experiencias"]
    ficha.formacao_academica = dados_estruturados["formacao_academica"]
    ficha.licencas_e_certificados = dados_estruturados["licencas_e_certificados"]
    ficha.competencias = dados_estruturados["competencias"]

    ficha_path = f"ficha_{vanity_name}.json"
    with open(ficha_path, "w", encoding="utf-8") as f:
        f.write(ficha.to_json())

    return ficha


def agrupar_dados_estruturados(textos: List[str]) -> Dict:
    experiencias = []
    formacao = []
    certificados = []
    competencias = set()

    date_regex = re.compile(
        r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{4}|\b\d{4}\s*[-–]\s*(?:\d{4}|Present|Atual)\b)'
    )
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
                edu_temp.append({"instituicao": instituicao, "curso": curso, "header_idx": i})

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
