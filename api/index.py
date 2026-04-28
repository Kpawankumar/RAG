import os
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from flask_cors import CORS

from TextProcessor import FileConverter
from rag import RAG


app = Flask(__name__)
CORS(app, supports_credentials=True)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

ALLOWED_FILE = {"pdf", "docx", "json", "txt"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_FILE


@app.route("/")
def home():
    return "RAG API Running"


@app.route("/ingest_url", methods=["POST"])
def ingest_url():
    data = request.get_json()
    if not data or "url" not in data:
        return jsonify({"detail": "No URL provided"}), 400

    url = data["url"]
    if not url:
        return jsonify({"detail": "Empty URL provided"}), 400

    try:
        converter = FileConverter(url)
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

    if not (file and allowed_file(file.filename)):
        return jsonify({"detail": "Unsupported file type"}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)

    try:
        converter = FileConverter(filepath)
        result = converter.convert()
        if not os.path.isfile(result):
            return jsonify({"detail": f"Conversion failed or error: {result}"}), 500
        return jsonify({"message": "File processed successfully!"}), 200
    except Exception as e:
        return jsonify({"detail": f"Error processing file: {str(e)}"}), 500


@app.route("/rag", methods=["POST"])
def run_rag():
    data = request.get_json()
    if not data or "query" not in data:
        return jsonify({"error": "Missing 'query' in request body"}), 400

    try:
        answer = RAG(data["query"])
        return jsonify({"answer": answer})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/query", methods=["POST"])
def query():
    return run_rag()


def handler(environ, start_response):
    return app(environ, start_response)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
