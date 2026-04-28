import os
import re


def detect_file_type(file_path: str) -> str:
    _, ext = os.path.splitext(file_path.lower())
    print(ext)
    if ext == ".pdf":
        return "pdf"
    if ext == ".docx":
        return "docx"
    if ext in [".txt", ".md"]:
        return "plain_text"
    if ext == ".json":
        return "json"
    return "unknown"


def detect_string_type(input_str: str) -> str:
    url_pattern = re.compile(r"https?://\S+")
    if url_pattern.match(input_str.strip()):
        return "url"
    if len(input_str.split()) > 5:
        return "plain_text"
    return "unknown"


def detect_input_type(input_data: str) -> str:
    if os.path.exists(input_data):
        print("file type")
        return detect_file_type(input_data)
    print("String from u")
    return detect_string_type(input_data)

