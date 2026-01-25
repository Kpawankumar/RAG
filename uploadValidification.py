import os
import re

def detect_file_type(file_path):
    _, ext = os.path.splitext(file_path.lower())
    print(ext)
    if ext == ".pdf":
        return "pdf"
    elif ext == ".docx":
        return "docx"
    elif ext in [".txt", ".md"]:
        return "plain_text"
    elif ext ==".json":
        return "json"
    else:

        return "unknown"
    


def detect_string_type(input_str):
    url_pattern = re.compile(r'https?://\S+')
    if url_pattern.match(input_str.strip()):
        return "url"
    elif len(input_str.split()) > 5:  # crude check: has enough words
        return "plain_text"
    else:
        return "unknown"

def detect_input_type(input_data):
    if os.path.exists(input_data):  # It's a file path
        print("file type")
        return detect_file_type(input_data)
    else:  # It's a string
        print("String from u")
        return detect_string_type(input_data)


