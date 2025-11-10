import os
import base64
import tempfile
import gc
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_groq import ChatGroq

# -------------------------------------------------------------------
# 🔹 Load environment and Groq key
# -------------------------------------------------------------------
load_dotenv()
groq_api_key = os.getenv("GROQ_API_KEY")
if not groq_api_key:
    print("⚠️ Warning: GROQ_API_KEY not found in environment variables!")

# -------------------------------------------------------------------
# 🔹 Global, lightweight embedding model (loaded once)
# -------------------------------------------------------------------
# intfloat/e5-small-v2 ≈ 180 MB vs MiniLM-L6-v2 ≈ 350 MB
embedding_model = HuggingFaceEmbeddings(model_name="intfloat/e5-small-v2")

# -------------------------------------------------------------------
# 🔹 In-memory chat sessions (non-persistent)
# -------------------------------------------------------------------
chat_sessions = {}  # { session_id: {"vectorstore_path": str, "chat_history": list} }


def init_chat_from_base64(session_id: str, pdf_base64: str):
    """Initialize chat session using Base64 PDF (memory-safe)"""
    try:
        # ✅ Decode and save PDF
        pdf_bytes = base64.b64decode(pdf_base64)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(pdf_bytes)
            pdf_path = tmp.name

        # ✅ Load and split PDF text
        loader = PyPDFLoader(pdf_path)
        docs = loader.load()
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        chunks = splitter.split_documents(docs)
        if not chunks:
            raise ValueError("No readable text found in the uploaded PDF.")

        # ✅ Build FAISS index in /tmp (Render-safe)
        temp_path = f"/tmp/vectorstore_{session_id}"
        vectorstore = FAISS.from_documents(chunks, embedding_model)
        vectorstore.save_local(temp_path)

        # ✅ Free memory (important!)
        del docs, chunks, loader, vectorstore
        gc.collect()

        # ✅ Track in session
        chat_sessions[session_id] = {"vectorstore_path": temp_path, "chat_history": []}
        print(f"✅ Chat session '{session_id}' initialized successfully.")
        return {"message": f"Chat session '{session_id}' initialized successfully."}

    except Exception as e:
        print(f"❌ Error initializing chat: {e}")
        return {"error": str(e)}  # Return readable error


def chat_with_pdf(session_id: str, message: str):
    """Chat with an initialized PDF session (memory-safe)"""
    try:
        if session_id not in chat_sessions:
            return {"error": f"No chat session found for '{session_id}'."}

        session = chat_sessions[session_id]
        temp_path = session["vectorstore_path"]
        chat_history = session["chat_history"]

        # ✅ Reload FAISS from disk (lightweight)
        vectorstore = FAISS.load_local(
            temp_path, embedding_model, allow_dangerous_deserialization=True
        )
        retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

        docs = retriever.invoke(message)
        context = "\n\n".join([d.page_content for d in docs]) if docs else "No context found."

        # Build concise prompt
        past_convo = "\n".join([f"User: {u}\nAssistant: {a}" for u, a in chat_history[-3:]])
        prompt = f"""
You are a concise, factual assistant.
Use only the PDF context below to answer clearly and to the point.

Context:
{context}

Previous Chat:
{past_convo}

User Question:
{message}

Answer briefly using bullet points or short paragraphs.
"""

        # ✅ Groq model (lightweight call)
        llm = ChatGroq(api_key=groq_api_key, model="llama-3.1-8b-instant", temperature=0.2)
        response = llm.invoke(prompt)
        answer = getattr(response, "content", "").strip() or "⚠️ No response from AI."

        # ✅ Save conversation
        chat_history.append((message, answer))

        # ✅ Clean up heavy objects
        del vectorstore, retriever, docs
        gc.collect()

        print(f"[Chat] {session_id} | Q: {message} | A: {answer[:100]}...")
        return {"response": answer}

    except Exception as e:
        print(f"❌ Error in chat_with_pdf: {e}")
        gc.collect()
        return {"error": str(e)}
