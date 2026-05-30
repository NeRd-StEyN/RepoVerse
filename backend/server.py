import os
import threading
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from chat_handler import init_chat_from_base64, chat_with_pdf


server = Flask(__name__, static_folder="build", static_url_path="/")
CORS(server)

progress_state = {}
generated_reports = {}
generated_english_reports = {}
generation_status = {}
report_states = {}

_compiled_app = None

def get_app():
    global _compiled_app
    if _compiled_app is None:
        from lang import get_compiled_app
        _compiled_app = get_compiled_app()
    return _compiled_app

def background_generate(cache_key, topic, language="English", pages=3):
    """Run LangGraph workflow in a background thread."""
    try:
        generation_status[cache_key] = "in_progress"

        accumulated_state = {"topic": topic, "language": language, "pages": pages}
        app = get_app()
        for state in app.stream({"topic": topic, "language": language, "pages": pages}):
            for node_name, node_update in state.items():
                if isinstance(node_update, dict):
                    for k, v in node_update.items():
                        if isinstance(v, dict) and k in accumulated_state and isinstance(accumulated_state[k], dict):
                            accumulated_state[k].update(v)
                        else:
                            accumulated_state[k] = v

            if "intro" in state or "planner" in state:
                progress_state[cache_key]["topicAnalysis"] = True
            elif "retriever" in state:
                progress_state[cache_key]["dataGathering"] = True
            elif "summarizer" in state or "analyzer" in state or "conclusion" in state:
                progress_state[cache_key]["draftingReport"] = True
            elif "visualizer" in state or "report_generator" in state:
                progress_state[cache_key]["finalizing"] = True

            if "report_generator" in state:
                pdf_base64 = state["report_generator"].get("pdf_base64")
                english_pdf_base64 = state["report_generator"].get("english_pdf_base64")
                
                if pdf_base64:
                    generated_reports[cache_key] = pdf_base64
                    if english_pdf_base64:
                        print(f"[SUCCESS] Storing English PDF for topic: '{topic}'")
                        generated_english_reports[topic] = english_pdf_base64
                    else:
                        print(f"[WARNING] No English PDF returned for topic: '{topic}'")
                    
                    report_states[cache_key] = {
                        "topic": topic,
                        "heading": accumulated_state.get("heading", ""),
                        "intro": accumulated_state.get("intro", ""),
                        "summaries": accumulated_state.get("summaries", {}),
                        "insights": accumulated_state.get("insights", {}),
                        "conclusion": accumulated_state.get("conclusion", ""),
                        "language": language,
                        "pages": pages
                    }
                    generation_status[cache_key] = "completed"
                break

        progress_state[cache_key] = {
            "topicAnalysis": True,
            "dataGathering": True,
            "draftingReport": True,
            "finalizing": True,
        }

        if cache_key not in generation_status or generation_status[cache_key] != "completed":
            generation_status[cache_key] = "completed"

    except Exception as e:
        print(f"[ERROR] Background generation failed for {topic} (pages={pages}, lang={language}): {e}")
        progress_state[cache_key] = {
            "topicAnalysis": False,
            "dataGathering": False,
            "draftingReport": False,
            "finalizing": False,
            "error": str(e)
        }
        generation_status[cache_key] = "failed"


def create_report_key(topic, language, pages):
    """Create a unique cache key for topic + language + pages combination."""
    return f"{topic}||{language}||{pages}"


@server.route("/generate_report", methods=["POST"])
def generate_report():
    """Start background report generation for a topic."""
    data = request.get_json()
    topic = data.get("topic", "").strip()
    language = data.get("language", "English").strip()
    pages = int(data.get("pages", 3))

    if not topic:
        return jsonify({"error": "Missing topic"}), 400

    if pages < 2 or pages > 10:
        return jsonify({"error": "Page count must be between 2 and 10"}), 400

    allowed_languages = ["English", "Hindi", "Tamil", "Telugu", "Bengali", "Marathi", "Spanish", "French", "German", "Italian"]
    if language not in allowed_languages:
        return jsonify({"error": f"Unsupported language: {language}"}), 400

    print(f"[START] Starting report generation for topic='{topic}', "
          f"language='{language}', pages={pages}")

    cache_key = create_report_key(topic, language, pages)

    if cache_key in generated_reports:
        return jsonify({"pdf_base64": generated_reports[cache_key]})

    if cache_key in generation_status and generation_status[cache_key] == "in_progress":
        return jsonify({"message": "Report generation already in progress"})

    progress_state[cache_key] = {
        "topicAnalysis": False,
        "dataGathering": False,
        "draftingReport": False,
        "finalizing": False,
    }
    generation_status[cache_key] = "in_progress"

    thread = threading.Thread(target=background_generate, args=(cache_key, topic, language, pages))
    thread.daemon = True
    thread.start()

    return jsonify({"message": "Report generation started", "topic": topic})


@server.route("/progress/<cache_key>", methods=["GET"])
def get_progress(cache_key):
    """Return current progress for frontend polling."""
    status = generation_status.get(cache_key, "not_started")
    progress = progress_state.get(cache_key, {
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


@server.route("/report/<cache_key>", methods=["GET"])
def get_report(cache_key):
    """Return generated PDF (Base64) for display."""
    if cache_key not in generated_reports:
        return jsonify({"error": "Report not found"}), 404

    pdf_data = generated_reports.get(cache_key)
    if not pdf_data:
        return jsonify({"error": "PDF data is empty"}), 404

    return jsonify({
        "pdf_base64": pdf_data,
        "status": "success"
    })


@server.route("/chat/init", methods=["POST"])
def chat_init():
    """Initialize chat session with Base64 PDF."""
    try:
        data = request.get_json()
        session_id = data.get("session_id")
        pdf_base64 = data.get("pdf_base64")

        if not session_id or not pdf_base64:
            return jsonify({"error": "Missing session_id or pdf_base64"}), 400

        if session_id in generated_english_reports:
            print(f"[INFO] Using server-side ENGLISH PDF for RAG context for topic: {session_id}")
            pdf_base64 = generated_english_reports[session_id]
        else:
            print(f"[WARNING] No English PDF found for {session_id}, using provided PDF.")
            print(f"Available English Reports: {list(generated_english_reports.keys())}")

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



@server.route("/report_state", methods=["GET"])
def get_report_state():
    """Retrieve the JSON state of a generated report."""
    try:
        cache_key = request.args.get("cache_key")
        if not cache_key:
            return jsonify({"error": "Missing cache_key"}), 400
            
        state = report_states.get(cache_key)
        if not state:
            # Construct fallback default if state was not captured or preloaded
            topic = cache_key.split("||")[0] if "||" in cache_key else "Research Topic"
            state = {
                "topic": topic,
                "heading": topic,
                "intro": "Introduction content not loaded. Try generating a new report to edit.",
                "summaries": {},
                "insights": {},
                "conclusion": "Conclusion not loaded.",
                "language": "English",
                "pages": 3
            }
        return jsonify(state)
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"[ERROR] get_report_state failed: {e}\n{tb}")
        return jsonify({"error": str(e), "traceback": tb}), 500

@server.route("/update_report", methods=["POST"])
def update_report():
    """Update report state and instantly regenerate PDF."""
    try:
        data = request.get_json()
        cache_key = data.get("cache_key")
        state = data.get("state")
        
        if not cache_key or not state:
            return jsonify({"error": "Missing cache_key or state"}), 400
            
        report_states[cache_key] = state
        
        from lang import create_pdf_for_state
        target_lang = state.get("language", "English")
        
        pdf_base64 = create_pdf_for_state(state, target_lang)
        generated_reports[cache_key] = pdf_base64
        
        return jsonify({
            "status": "success",
            "pdf_base64": pdf_base64
        })
    except Exception as e:
        print(f"[ERROR] PDF regeneration failed: {e}")
        return jsonify({"error": str(e)}), 500

@server.route("/rewrite_text", methods=["POST"])
def rewrite_text():
    """Use AI (Groq) to rewrite selected text based on an instruction."""
    try:
        data = request.get_json()
        text = data.get("text", "").strip()
        instruction = data.get("instruction", "Rewrite this text to be more engaging, clear, and professional.").strip()
        
        if not text:
            return jsonify({"error": "No text provided"}), 400
            
        from lang import get_groq_llm
        groq_llm = get_groq_llm()
        
        word_count = len(text.split())
        if word_count <= 4:
            length_instruction = (
                f"CRITICAL LENGTH CONSTRAINT: The input is an extremely short snippet/heading containing EXACTLY {word_count} words.\n"
                f"Your rewritten output MUST contain EXACTLY {word_count} words. Do NOT under any circumstances output a sentence, explanation, or paragraph. Output ONLY the {word_count}-word rewrite."
            )
        else:
            length_instruction = (
                f"CRITICAL LENGTH CONSTRAINT: The input contains {word_count} words.\n"
                f"Your rewritten output MUST be approximately the same length (around {word_count} words, within a 15% margin). Do NOT expand it into a paragraph."
            )
            
        prompt = (
            f"You are a strict, automated text replacement compiler. Your single purpose is to rewrite the input text based on the instruction: '{instruction}'.\n"
            f"CRITICAL RULES:\n"
            f"1. You MUST output ONLY the direct rewritten text. Absolutely no intros, no conversational phrases, no explanations, no apologies (e.g., do NOT say 'Unfortunately, the text appears to be incomplete' or 'Since there is no original text...').\n"
            f"2. Even if the input text is only 1 or 2 words, a short fragment, incomplete, or nonsensical, treat it as a valid string and rewrite it. Never generate a placeholder paragraph or example.\n"
            f"3. {length_instruction}\n"
            f"4. Do not wrap the response in quotation marks, brackets, or blockquotes.\n\n"
            f"Original Input Text to Rewrite:\n{text}"
        )
        
        response = groq_llm.invoke(prompt)
        rewritten_text = getattr(response, "content", str(response)).strip()
        
        return jsonify({
            "status": "success",
            "rewritten_text": rewritten_text
        })
    except Exception as e:
        print(f"[ERROR] AI rewrite failed: {e}")
        return jsonify({"error": str(e)}), 500


@server.route("/health")
def health():
    return jsonify({"status": "healthy"})


@server.route("/")
def serve_react():
    """Serve main React app."""
    return send_from_directory(server.static_folder, "index.html")

@server.errorhandler(404)
def not_found(e):
    """Fallback to React router for unknown routes."""
    return send_from_directory(server.static_folder, "index.html")

@server.errorhandler(500)
def server_error(e):
    """Handle all internal server errors, log them, and return traceback in JSON."""
    import traceback
    tb = traceback.format_exc()
    try:
        with open("error_log.txt", "w") as f:
            f.write(f"Error: {e}\nTraceback:\n{tb}\n")
    except Exception as err:
        print(f"Failed to write error log: {err}")
    return jsonify({"error": str(e), "traceback": tb}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    server.run(host="0.0.0.0", port=port, debug=True, use_reloader=False)
