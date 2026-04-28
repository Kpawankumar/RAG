import json
import os

import fitz
import requests
from bs4 import BeautifulSoup
from docx import Document

try:
    from backend.uploadValidification import detect_input_type
except ModuleNotFoundError:
    from uploadValidification import detect_input_type


class FileConverter:
    def __init__(self, input_data: str, output_text_file: str):
        if isinstance(input_data, str):
            input_data = input_data.strip().strip('"')
        self.input_data = input_data
        self.input_type = detect_input_type(input_data)
        self.output_text_file = output_text_file

    def convert(self) -> str:
        converters = {
            "pdf": self._convert_pdf,
            "docx": self._convert_docx,
            "url": self._convert_url,
            "plain_text": self._convert_plain_text,
            "json": self.convert_json_to_text,
        }

        if self.input_type not in converters:
            return f"Unsupported input type: {self.input_type}"

        text = converters[self.input_type]()

        if not text.startswith("Error") and not text.startswith("Conversion error"):
            os.makedirs(os.path.dirname(self.output_text_file), exist_ok=True)
            with open(self.output_text_file, "w", encoding="utf-8") as f:
                f.write(text)
            return self.output_text_file

        return text

    def _convert_pdf(self) -> str:
        try:
            doc = fitz.open(self.input_data)
            full_text = ""
            for page in doc:
                full_text += page.get_text()
            return full_text.strip()
        except Exception as e:
            return f"Error reading PDF: {e}"

    def _convert_docx(self) -> str:
        try:
            doc = Document(self.input_data)
            text = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
            return text.strip()
        except Exception as e:
            return f"Error reading DOCX: {e}"

    def _convert_url(self) -> str:
        try:
            response = requests.get(self.input_data, timeout=10)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")
            [elem.decompose() for elem in soup(["script", "style"])]
            text = " ".join(
                chunk.strip() for chunk in soup.get_text(separator=" ").split() if chunk
            )
            return text.strip()
        except Exception as e:
            return f"Error fetching URL: {e}"

    def convert_json_to_text(self) -> str:
        try:
            with open(self.input_data, "r", encoding="utf-8") as file:
                data = json.load(file)
            return json.dumps(data, indent=4)
        except Exception as e:
            return f"Error reading JSON: {e}"

    def _convert_plain_text(self) -> str:
        try:
            if os.path.exists(self.input_data):
                with open(self.input_data, "r", encoding="utf-8") as f:
                    return f.read().strip()
            return self.input_data.strip()
        except Exception as e:
            return f"Error reading plain text: {e}"


if __name__ == "__main__":
    data = input("Enter input (file path, URL, or text): ")
    converter = FileConverter(data, output_text_file=str(os.path.join("runtime", "output.txt")))
    result = converter.convert()

    if os.path.isfile(result):
        print(f"Conversion successful! Text saved to: {result}")
    else:
        print(f"Conversion failed or error: {result}")

