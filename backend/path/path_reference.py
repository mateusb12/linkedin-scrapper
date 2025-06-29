from pathlib import Path


def get_root_folder_path() -> Path:
    return Path(__file__).parent.parent.parent


def get_source_folder_path() -> Path:
    return Path(__file__).parent.parent


def get_scrapper_folder_path() -> Path:
    return Path(get_source_folder_path(), 'core_scrapper')


def get_gmail_folder_path() -> Path:
    return Path(get_source_folder_path(), 'gmail_analysis')


def get_credentials_path() -> Path:
    return Path(get_gmail_folder_path(), 'credentials.json')


def get_data_folder_path() -> Path:
    return Path(get_source_folder_path(), 'data')


def get_pagination_folder_path() -> Path:
    return Path(get_source_folder_path(), 'api_fetch', 'api_fetch', 'pagination')


def get_orchestration_curls_folder_path() -> Path:
    return Path(get_source_folder_path(), 'api_fetch', 'api_fetch', 'orchestration_curls')


def get_output_curls_folder_path() -> Path:
    return Path(get_source_folder_path(), 'linkedin', 'api_fetch', 'output')


def get_userdata_path() -> Path:
    return Path(get_root_folder_path(), 'userdata')


def main():
    folder = get_scrapper_folder_path()
    print(folder)
    return


if __name__ == '__main__':
    main()
