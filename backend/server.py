import os
import threading
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from lang import app  # your LangGraph workflow
from chat_handler import init_chat_from_base64, chat_with_pdf

# -------------------------------------------------------------------
# Flask App Config (⚙️ Serving React dist folder)
# -------------------------------------------------------------------
server = Flask(__name__, static_folder="build", static_url_path="/")
CORS(server)

# -------------------------------------------------------------------
# Report generation state
# -------------------------------------------------------------------
progress_state = {}
generated_reports = {}
generation_status = {}

# -------------------------------------------------------------------
# Background PDF Report Generation (LangGraph)
# -------------------------------------------------------------------
def background_generate(topic):
    """Run LangGraph workflow in a background thread."""
    try:
        generation_status[topic] = "in_progress"

        for state in app.stream({"topic": topic}):
            if "intro" in state or "planner" in state:
                progress_state[topic]["topicAnalysis"] = True
            elif "retriever" in state:
                progress_state[topic]["dataGathering"] = True
            elif "summarizer" in state or "analyzer" in state or "conclusion" in state:
                progress_state[topic]["draftingReport"] = True
            elif "visualizer" in state or "report_generator" in state:
                progress_state[topic]["finalizing"] = True

            # ✅ Capture Base64 PDF
            if "report_generator" in state:
                pdf_base64 = state["report_generator"].get("pdf_base64")
                if pdf_base64:
                    generated_reports[topic] = pdf_base64
                    generation_status[topic] = "completed"
                break

        # ✅ Mark all done
        progress_state[topic] = {
            "topicAnalysis": True,
            "dataGathering": True,
            "draftingReport": True,
            "finalizing": True,
        }

        if topic not in generation_status or generation_status[topic] != "completed":
            generation_status[topic] = "completed"

    except Exception as e:
        print(f"[ERROR] Background generation failed for {topic}: {e}")
        progress_state[topic] = {
            "topicAnalysis": False,
            "dataGathering": False,
            "draftingReport": False,
            "finalizing": False,
            "error": str(e)
        }
        generation_status[topic] = "failed"

# -------------------------------------------------------------------
# Report Generation API
# -------------------------------------------------------------------
@server.route("/generate_report", methods=["POST"])
def generate_report():
    """Start background report generation for a topic."""
    data = request.get_json()
    topic = data.get("topic", "").strip()
    if not topic:
        return jsonify({"error": "Missing topic"}), 400

    if topic in generated_reports:
        return jsonify({"pdf_base64": generated_reports[topic]})

    if topic in generation_status and generation_status[topic] == "in_progress":
        return jsonify({"message": "Report generation already in progress"})

    progress_state[topic] = {
        "topicAnalysis": False,
        "dataGathering": False,
        "draftingReport": False,
        "finalizing": False,
    }
    generation_status[topic] = "in_progress"

    thread = threading.Thread(target=background_generate, args=(topic,))
    thread.daemon = True
    thread.start()

    return jsonify({"message": "Report generation started"})


@server.route("/progress/<topic>", methods=["GET"])
def get_progress(topic):
    """Return current progress for frontend polling."""
    status = generation_status.get(topic, "not_started")
    progress = progress_state.get(topic, {
        "topicAnalysis": False,
        "dataGathering": False,
        "draftingReport": False,
        "finalizing": False,
    })
    return jsonify({
        "progress": progress,
        "status": status,
        "is_complete": status == "completed"
    })


@server.route("/report/<topic>", methods=["GET"])
def get_report(topic):
    """Return generated PDF (Base64) for display."""
    if topic not in generated_reports:
        return jsonify({"error": "Report not found"}), 404

    pdf_data = generated_reports.get(topic)
    if not pdf_data:
        return jsonify({"error": "PDF data is empty"}), 404

    return jsonify({
        "pdf_base64": pdf_data,
        "status": "success"
    })


# -------------------------------------------------------------------
# 🧠 Chat APIs — Calls chat_handler.py
# -------------------------------------------------------------------
@server.route("/chat/init", methods=["POST"])
def chat_init():
    """Initialize chat session with Base64 PDF."""
    try:
        data = request.get_json()
        session_id = data.get("session_id")
        pdf_base64 = data.get("pdf_base64")

        if not session_id or not pdf_base64:
            return jsonify({"error": "Missing session_id or pdf_base64"}), 400

        result = init_chat_from_base64(session_id, pdf_base64)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@server.route("/chat/message", methods=["POST"])
def chat_message():
    """Send a message and get AI response."""
    try:
        data = request.get_json()
        session_id = data.get("session_id")
        message = data.get("message")

        if not session_id or not message:
            return jsonify({"error": "Missing session_id or message"}), 400

        result = chat_with_pdf(session_id, message)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -------------------------------------------------------------------
# 🩺 Health Check
# -------------------------------------------------------------------
@server.route("/health")
def health():
    return jsonify({"status": "healthy"})


# -------------------------------------------------------------------
# 🌐 Serve React Frontend (Vite dist folder)
# -------------------------------------------------------------------
@server.route("/")
def serve_react():
    """Serve main React app."""
    return send_from_directory(server.static_folder, "index.html")

@server.errorhandler(404)
def not_found(e):
    """Fallback to React router for unknown routes."""
    return send_from_directory(server.static_folder, "index.html")


# -------------------------------------------------------------------
# 🏁 Run Server
# -------------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    server.run(host="0.0.0.0", port=port)
