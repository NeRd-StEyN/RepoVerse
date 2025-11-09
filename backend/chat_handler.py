import os
import base64
import tempfile
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_groq import ChatGroq

# 🧠 Predefine Groq API Key
from dotenv import load_dotenv
load_dotenv()

# Get the API key securely
groq_api_key = os.getenv("GROQ_API_KEY")

# In-memory chat sessions
chat_sessions = {}  # { session_id: {"vectorstore": ..., "chat_history": [...] } }


def init_chat_from_base64(session_id: str, pdf_base64: str):
    """Initialize a chat session using Base64 PDF data"""
    try:
        pdf_bytes = base64.b64decode(pdf_base64)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(pdf_bytes)
            pdf_path = tmp.name

        # Load and split PDF
        loader = PyPDFLoader(pdf_path)
        docs = loader.load()

        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        chunks = splitter.split_documents(docs)

        if not chunks:
            raise ValueError("No readable text found in PDF")

        # Build FAISS index
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        vectorstore = FAISS.from_documents(chunks, embeddings)

        chat_sessions[session_id] = {
            "vectorstore": vectorstore,
            "chat_history": []
        }

        return {"message": f"Chat session '{session_id}' initialized successfully."}
    except Exception as e:
        return {"error": str(e)}


def chat_with_pdf(session_id: str, message: str):
    """Chat with the initialized PDF session"""
    if session_id not in chat_sessions:
        return {"error": f"No chat session found for '{session_id}'"}

    session = chat_sessions[session_id]
    retriever = session["vectorstore"].as_retriever(search_kwargs={"k": 4})
    chat_history = session["chat_history"]

    # Get relevant chunks
    docs = retriever.invoke(message)
    context = "\n\n".join([d.page_content for d in docs])

    # Build context-aware prompt
    past_convo = "\n".join([f"User: {u}\nAssistant: {a}" for u, a in chat_history])

    prompt = f"""
You are a helpful assistant. Use the following PDF context and chat history to answer the question by always trying to keep it short and to the point .If u give points print them in new line

Context:
{context}

Chat History:
{past_convo}

User Question:
{message}

Answer clearly and factually based only on the provided context.
"""

    llm = ChatGroq(api_key=groq_api_key,model="llama-3.1-8b-instant")
    response = llm.invoke(prompt)
    answer = response.content.strip()

    # Save to chat history
    chat_history.append((message, answer))

    return {"response": answer}
