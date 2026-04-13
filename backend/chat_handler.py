import os
import base64
import tempfile
import gc
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_groq import ChatGroq
from deep_translator import GoogleTranslator

# NOTE: HuggingFaceEmbeddings and FAISS are imported lazily inside
# get_embedding_model() / the functions that need them, so that
# sentence-transformers does NOT download a model during gunicorn boot.

load_dotenv()
groq_api_key = os.getenv("GROQ_API_KEY")
embedding_model_name = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
max_pdf_chunks = int(os.getenv("MAX_PDF_CHUNKS", "180"))

if not groq_api_key:
    print("Warning: GROQ_API_KEY not found in environment variables!")

embedding_model = None


def get_embedding_model():
    """Lazy-load embeddings so app startup is resilient to transient network issues."""
    global embedding_model
    if embedding_model is None:
        from langchain_huggingface import HuggingFaceEmbeddings
        embedding_model = HuggingFaceEmbeddings(
            model_name=embedding_model_name,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True}
        )
        print(f"Loaded HuggingFace Embeddings: {embedding_model_name}")
    return embedding_model


chat_sessions = {}  


def init_chat_from_base64(session_id: str, pdf_base64: str):
    """Initialize chat session using Base64 PDF (Render memory safe)."""
    temp_file_path = None
    try:
       
        pdf_bytes = base64.b64decode(pdf_base64)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(pdf_bytes)
            temp_file_path = tmp.name

      
        loader = PyPDFLoader(temp_file_path)
        docs = loader.load()
        
        if not docs:
            raise ValueError("No documents loaded from PDF.")
            
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        chunks = splitter.split_documents(docs)

        # Cap chunk count to protect low-memory deployments.
        if len(chunks) > max_pdf_chunks:
            chunks = chunks[:max_pdf_chunks]
            print(f"Chunk list truncated to {max_pdf_chunks} for memory safety")
        
        if not chunks:
            raise ValueError("No readable text found in the uploaded PDF.")

        current_embedding_model = get_embedding_model()

        from langchain_community.vectorstores import FAISS
        temp_path = f"/tmp/vectorstore_{session_id}"
        vectorstore = FAISS.from_documents(chunks, current_embedding_model)
        vectorstore.save_local(temp_path)

        chat_sessions[session_id] = {
            "vectorstore_path": temp_path,
            "chat_history": [],
        }

        print(f"✅ Chat session '{session_id}' initialized successfully.")
        return {"message": f"Chat session '{session_id}' initialized successfully."}

    except Exception as e:
        print(f"❌ Error initializing chat: {e}")
        return {"error": str(e)}
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception as e:
                print(f"⚠️ Could not delete temp file: {e}")
        
        gc.collect()


def chat_with_pdf(session_id: str, message: str):
    """Chat with initialized PDF session (Render-safe)."""
    try:
        if session_id not in chat_sessions:
            return {"error": f"No chat session found for '{session_id}'."}

        session = chat_sessions[session_id]
        temp_path = session["vectorstore_path"]
        chat_history = session["chat_history"]

      
        try:
            user_message_en = GoogleTranslator(source="auto", target="en").translate(message)
        except:
            user_message_en = message  

        from langchain_community.vectorstores import FAISS
        current_embedding_model = get_embedding_model()
        vectorstore = FAISS.load_local(
            temp_path, current_embedding_model, allow_dangerous_deserialization=True
        )

        retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
        
 
        docs = retriever.invoke(user_message_en)

        translated_docs = []
        translator = GoogleTranslator(source='auto', target='en')
        
        for d in docs:
            try:
                trans_text = translator.translate(d.page_content)
                translated_docs.append(trans_text)
            except Exception as e:
                print(f"Translation failed for chunk: {e}")
                translated_docs.append(d.page_content)

        context = "\n\n".join(translated_docs) if translated_docs else "No context found."

        history_context = ""
        if chat_history:
            past_exchanges = chat_history[-5:]
            history_context = "\n".join([
                f"User: {u}\nAssistant: {a[:150]}" 
                for u, a in past_exchanges
            ])
            history_context = f"\nPrevious conversation:\n{history_context}\n"
        
        prompt = f"""You are an AI assistant that ONLY speaks English.
The user has provided a document (context) which may be in a different language.
Your task is to answer the user's question based on the context, but you must TRANSLATE your answer into ENGLISH.

### STRICT RULES:
1. **ENGLISH ONLY**: Your response must be 100% in English. 
2. **TRANSLATE**: If the answer is found in non-English context, translate to English.
3. **ACCURACY**: Use only the context. If not found, say:
   "Sorry, I cannot answer this question based on the provided context."

### Context:
{context}

### Conversation History:
{history_context}

### User Question (normalized to English):
{user_message_en}

### Answer (in English):"""

        llm = ChatGroq(
            api_key=groq_api_key,
            model="llama-3.1-8b-instant",
            temperature=0.3,
            max_tokens=400,
            model_kwargs={"top_p": 0.9}
        )

        response = llm.invoke(prompt)
        answer = getattr(response, "content", "").strip() or "No relevant information found."

     
        chat_history.append((message, answer))

        print(f"[Chat] {session_id} | Q: {message} | A: {answer[:120]}...")
        return {"response": answer}

    except Exception as e:
        print(f"❌ Error in chat_with_pdf: {e}")
        return {"error": str(e)}
    finally:
        gc.collect()
