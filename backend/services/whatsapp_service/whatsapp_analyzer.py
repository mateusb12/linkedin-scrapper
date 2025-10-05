import os
import re
from dataclasses import dataclass

BASE_DIR = "C:\\Users\\Mateus\\Documents\\Chats\\Marcelo"


@dataclass
class Message:
    sender: str
    date: str
    time: str
    content: str
    media: bool or None = False


def list_all_files_in_the_folder(folder_path):
    import os

    all_files = []
    for root, dirs, files in os.walk(folder_path):
        for file in files:
            all_files.append(os.path.join(root, file))
    return all_files


def clean_line_start(line):
    # List of common invisible/control characters (add more if needed)
    invisible_chars = ''.join([
        '\u200e',  # LEFT-TO-RIGHT MARK
        '\u200f',  # RIGHT-TO-LEFT MARK
        '\ufeff',  # BOM
        '\u202a',  # LRE
        '\u202c',  # PDF
        '\u2066',  # LRI
        '\u2067',  # RLI
        '\u2069',  # PDI
    ])
    return line.lstrip(' \t\r\n' + invisible_chars).replace('\u200e', '').replace('\u200f', '')


def get_regex_result(regex_pattern: str, text: str):
    pattern = re.compile(regex_pattern)
    matches = pattern.findall(text)
    return matches


def get_main_txt_file_content():
    filename = "_chat.txt"
    file_path = os.path.join(BASE_DIR, filename)
    line_starts_with_timestamp_regex = r"^\s*\[\d{2}/\d{2}/\d{2}, \d{2}:\d{2}:\d{2}\]"
    with open(file_path, "r", encoding="utf-8") as file:
        line_pool = []
        current_line = None
        for line in file:
            normalized_line = clean_line_start(line)
            if re.match(line_starts_with_timestamp_regex, normalized_line):
                current_line = normalized_line.strip()
                line_pool.append(current_line)
            else:
                current_line += " " + normalized_line.strip()
                line_pool[-1] = current_line
    return line_pool


def structure_conversations(messages: list[str]):
    object_pool = []
    for message in messages:
        date_regex = r"\[(\d{2}/\d{2}/\d{2}),"
        time_regex = r", (\d{2}:\d{2}:\d{2})\]"
        sender_regex = r"\] (.*?):"
        content_regex = r": (.*)$"
        date_entry = get_regex_result(date_regex, message)[0]
        time_entry = get_regex_result(time_regex, message)[0]
        sender_entry = get_regex_result(sender_regex, message)[0]
        content_entry = get_regex_result(content_regex, message)[0]
        media_filename = None
        media_filename_regex = r"<attached: ([^>]+)>"
        match = re.search(media_filename_regex, content_entry)
        if match:
            media_filename = match.group(1)
            file_extension = media_filename.split('.')[-1].lower() if '.' in media_filename else ''
            pass
        message_object = Message(
            sender=sender_entry,
            date=date_entry,
            time=time_entry,
            content=content_entry,
            media=media_filename
        )
        object_pool.append(message_object)
    media_pool = [msg for msg in object_pool if msg.media]
    return object_pool


def main():
    all_files = list_all_files_in_the_folder(BASE_DIR)
    txt_content = get_main_txt_file_content()
    structured = structure_conversations(txt_content)
    pass


if __name__ == "__main__":
    main()
