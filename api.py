import os
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from TextProcessor import FileConverter
from uploadValidification import detect_input_type
from flask_cors import CORS
from rag import RAG

app = Flask(__name__, static_folder='ui', static_url_path='')
CORS(app)
CORS(app, supports_credentials=True)

Upload_Folder = "uploads"
os.makedirs(Upload_Folder, exist_ok=True)
app.config['Upload_Folder'] = Upload_Folder

ALLOWED_FILE = {'pdf', 'docx', 'json', 'txt'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_FILE


# ------------------------ Serve Frontend UI ------------------------

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static_file(path):
    return send_from_directory(app.static_folder, path)


# ------------------------ Backend API Endpoints ------------------------

@app.route('/ingest_url', methods=["POST"])
def ingest_url():
    data = request.get_json()
    if not data or 'url' not in data:
        return jsonify({"detail": "No URL provided"}), 400

    url = data['url']
    if not url:
        return jsonify({"detail": "Empty URL provided"}), 400

    try:
        converter = FileConverter(url)
        result = converter.convert()
        if os.path.isfile(result):
            print(f"Conversion successful! Text saved to: {result}")
        else:
            return jsonify({"detail": f"Conversion failed or error: {result}"}), 500
        return jsonify({"message": "File processed successfully!"}), 200
    except Exception as e:
        return jsonify({"detail": f"Error processing URL: {str(e)}"}), 500


@app.route('/ingest_file', methods=["POST"])
def ingest_file():
    if 'file' not in request.files:
        return jsonify({"detail": "No file was uploaded"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"detail": "No file was selected"}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['Upload_Folder'], filename)
        file.save(filepath)

        try:
            converter = FileConverter(filepath)
            result = converter.convert()
            if os.path.isfile(result):
                print(f"Conversion successful! Text saved to: {result}")
            else:
                return jsonify({"detail": f"Conversion failed or error: {result}"})
            return jsonify({"message": "File processed successfully!"}), 200
        except Exception as e:
            return jsonify({"detail": f"Error processing file: {str(e)}"}), 500

    else:
        return jsonify({"detail": "Unsupported file type"}), 400


@app.route('/rag', methods=['POST'])
def run_rag():
    data = request.get_json()
    if not data or 'query' not in data:
        return jsonify({"error": "Missing 'query' in request body"}), 400

    user_question = data['query']
    try:
        answer = RAG(user_question)
        return jsonify({"answer": answer})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ------------------------ Run App ------------------------

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
