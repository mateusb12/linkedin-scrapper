import sys
import os
import json

# Garante que o Python ache os módulos do seu backend
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from source.features.fetch_curl.fetch_service import FetchService


def fetch_and_save_raw(vanity_name: str) -> str:
    print(f"🕵️  Iniciando extração bruta do perfil: {vanity_name}\n" + "=" * 50)

    configs_alvo = ["ProfileMain", "ProfileAboveActivity", "ProfileBelowActivity"]
    raw_data = {}

    for config in configs_alvo:
        print(f"⏳ Extraindo [{config}]...")
        resultado = FetchService.execute_dynamic_profile_fetch(config, vanity_name)

        if not resultado:
            raw_data[config] = ""
            continue

        # Padroniza a saída em string
        if isinstance(resultado, dict):
            raw_data[config] = json.dumps(resultado, ensure_ascii=False)
        else:
            raw_data[config] = str(resultado)

    # Salva tudo em um "mega .txt" estruturado
    output_filename = f"mega_raw_{vanity_name}.txt"
    with open(output_filename, "w", encoding="utf-8") as f:
        # Salvamos como JSON dentro do .txt para manter as chaves intactas na hora de analisar
        json.dump(raw_data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Todos os requests brutos salvos com sucesso em: {output_filename}")
    return output_filename


if __name__ == "__main__":
    fetch_and_save_raw("monicasbusatta")
