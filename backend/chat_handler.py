import os
import base64
import tempfile
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_groq import ChatGroq

# -------------------------------------------------------------------
# 🔹 Load environment and set Groq API key
# -------------------------------------------------------------------
load_dotenv()
groq_api_key = os.getenv("GROQ_API_KEY")

if not groq_api_key:
    print("⚠️ Warning: GROQ_API_KEY not found in environment variables!")

# -------------------------------------------------------------------
# 🔹 In-memory chat sessions (non-persistent)
# -------------------------------------------------------------------
chat_sessions = {}  # { session_id: {"vectorstore": ..., "chat_history": [...] } }


def init_chat_from_base64(session_id: str, pdf_base64: str):
    """Initialize a chat session using Base64 PDF data"""
    try:
        # ✅ Decode base64 PDF safely
        pdf_bytes = base64.b64decode(pdf_base64)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(pdf_bytes)
            pdf_path = tmp.name

        # ✅ Load and split the PDF
        loader = PyPDFLoader(pdf_path)
        docs = loader.load()

        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        chunks = splitter.split_documents(docs)

        if not chunks:
            raise ValueError("No readable text found in the uploaded PDF.")

        # ✅ Use /tmp for vectorstore (Render-safe)
        temp_path = f"/tmp/vectorstore_{session_id}"

        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        vectorstore = FAISS.from_documents(chunks, embeddings)
        vectorstore.save_local(temp_path)

        # ✅ Store session in memory
        chat_sessions[session_id] = {
            "vectorstore_path": temp_path,
            "chat_history": []
        }

        print(f"✅ Chat session '{session_id}' initialized successfully.")
        return {"message": f"Chat session '{session_id}' initialized successfully."}

    except Exception as e:
        print(f"❌ Error initializing chat: {e}")
        return {"error": str(e)}


def chat_with_pdf(session_id: str, message: str):
    """Chat with the initialized PDF session"""
    try:
        if session_id not in chat_sessions:
            return {"error": f"No chat session found for '{session_id}'."}

        session = chat_sessions[session_id]
        temp_path = session["vectorstore_path"]
        chat_history = session["chat_history"]

        # ✅ Reload FAISS index from /tmp
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        vectorstore = FAISS.load_local(temp_path, embeddings, allow_dangerous_deserialization=True)
        retriever = vectorstore.as_retriever(search_kwargs={"k": 4})

        # Retrieve relevant context
        docs = retriever.invoke(message)
        context = "\n\n".join([d.page_content for d in docs]) if docs else "No context found."

        # Build context-aware prompt
        past_convo = "\n".join([f"User: {u}\nAssistant: {a}" for u, a in chat_history])
        prompt = f"""
You are a helpful assistant. Use the following PDF context and chat history to answer the question.
Keep answers concise, factual, and formatted with new lines for points.

Context:
{context}

Chat History:
{past_convo}

User Question:
{message}

Answer based only on the provided context.
"""

        # ✅ Create Groq model
        llm = ChatGroq(
            api_key=groq_api_key,
            model="llama-3.1-8b-instant",
            temperature=0.2
        )

        response = llm.invoke(prompt)
        answer = getattr(response, "content", "").strip() or "⚠️ No response from AI."

        # Save to chat history
        chat_history.append((message, answer))

        print(f"[Chat] {session_id} | Q: {message} | A: {answer[:100]}...")
        return {"response": answer}

    except Exception as e:
        print(f"❌ Error in chat_with_pdf: {e}")
        return {"error": str(e)}
