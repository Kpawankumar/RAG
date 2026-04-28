import os
import traceback
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

try:
    # When launched as a module (recommended): `python -m backend.api`
    from backend.TextProcessor import FileConverter
    from backend.rag import RAG
except ModuleNotFoundError:
    # When launched as a script: `python backend/api.py`
    from TextProcessor import FileConverter
    from rag import RAG

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

UI_DIR = PROJECT_ROOT / "ui"
RUNTIME_DIR = PROJECT_ROOT / "runtime"
UPLOAD_DIR = RUNTIME_DIR / "uploads"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__, static_folder=str(UI_DIR), static_url_path="")
CORS(app, supports_credentials=True)

app.config["UPLOAD_FOLDER"] = str(UPLOAD_DIR)

ALLOWED_FILE = {"pdf", "docx", "json", "txt"}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_FILE


@app.route("/")
def serve_index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/<path:path>")
def serve_static_file(path: str):
    return send_from_directory(app.static_folder, path)


@app.route("/ingest_url", methods=["POST"])
def ingest_url():
    data = request.get_json()
    if not data or "url" not in data:
        return jsonify({"detail": "No URL provided"}), 400

    url = data["url"]
    if not url:
        return jsonify({"detail": "Empty URL provided"}), 400

    try:
        converter = FileConverter(url, output_text_file=str(RUNTIME_DIR / "output.txt"))
        result = converter.convert()
        if not os.path.isfile(result):
            return jsonify({"detail": f"Conversion failed or error: {result}"}), 500
        return jsonify({"message": "File processed successfully!"}), 200
    except Exception as e:
        return jsonify({"detail": f"Error processing URL: {str(e)}"}), 500


@app.route("/ingest_file", methods=["POST"])
def ingest_file():
    if "file" not in request.files:
        return jsonify({"detail": "No file was uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"detail": "No file was selected"}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        file.save(filepath)

        try:
            converter = FileConverter(filepath, output_text_file=str(RUNTIME_DIR / "output.txt"))
            result = converter.convert()
            if not os.path.isfile(result):
                return jsonify({"detail": f"Conversion failed or error: {result}"}), 500
            return jsonify({"message": "File processed successfully!"}), 200
        except Exception as e:
            return jsonify({"detail": f"Error processing file: {str(e)}"}), 500

    return jsonify({"detail": "Unsupported file type"}), 400


@app.route("/rag", methods=["POST"])
def run_rag():
    data = request.get_json()
    if not data or "query" not in data:
        return jsonify({"detail": "Missing 'query' in request body"}), 400

    user_question = data["query"]
    try:
        answer = RAG(user_question, runtime_dir=RUNTIME_DIR)
        return jsonify({"answer": answer})
    except Exception as e:
        error_message = str(e) or repr(e) or f"{type(e).__name__}()"
        print("RAG error:", error_message)
        traceback.print_exc()
        if "429" in error_message or "quota" in error_message.lower():
            return jsonify({"detail": error_message}), 429
        return jsonify({"detail": error_message}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "10000"))
    app.run(host="0.0.0.0", port=port)

