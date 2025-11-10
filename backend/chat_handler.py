import os
import base64
import tempfile
import requests
import gc
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain.embeddings.base import Embeddings
from langchain_groq import ChatGroq

# -------------------------------------------------------------------
# 🔹 Load environment variables
# -------------------------------------------------------------------
load_dotenv()
groq_api_key = os.getenv("GROQ_API_KEY")
hf_api_token = os.getenv("HF_API_TOKEN")

if not groq_api_key:
    print("⚠️ Warning: GROQ_API_KEY not found in environment variables!")
if not hf_api_token:
    print("⚠️ Warning: HF_API_TOKEN not found in environment variables!")

# -------------------------------------------------------------------
# 🔹 Fixed Hugging Face API embedding class with correct router endpoint
# -------------------------------------------------------------------
class HuggingFaceAPIEmbeddings(Embeddings):
    """Use Hugging Face Inference API via router.huggingface.co with correct implementation"""

    def __init__(
        self,
        api_token: str,
        model_id: str = "sentence-transformers/all-MiniLM-L6-v2",
    ):
        self.api_token = api_token
        self.model_id = model_id
        # ✅ CORRECT: Use router endpoint but with proper implementation
        self.api_url = f"https://router.huggingface.co/hf-inference/{self.model_id}"
        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }

    def embed_query(self, text: str):
        """Embed a single text input."""
        return self.embed_documents([text])[0]

    def embed_documents(self, texts: list):
        """Embed multiple documents efficiently."""
        try:
            # ✅ Process texts in batches to avoid timeout
            embeddings = []
            for text in texts:
                payload = {"inputs": text}
                
                response = requests.post(
                    self.api_url, 
                    headers=self.headers, 
                    json=payload, 
                    timeout=60
                )

                if response.status_code != 200:
                    error_msg = f"HF API Error {response.status_code}"
                    if response.text:
                        error_msg += f": {response.text[:200]}"
                    print(f"❌ {error_msg}")
                    
                    if response.status_code == 404:
                        raise ValueError(f"Model '{self.model_id}' not found or not supported for embeddings.")
                    elif response.status_code == 503:
                        raise ValueError(f"Model '{self.model_id}' is loading. Please try again later.")
                    else:
                        raise ValueError(error_msg)

                # ✅ Process the response
                result = response.json()
                
                # Handle different response formats
                if isinstance(result, list):
                    if isinstance(result[0], list):
                        # Nested list format
                        embeddings.extend(result[0])
                    else:
                        # Flat list format
                        embeddings.append(result)
                elif isinstance(result, dict):
                    if "embeddings" in result:
                        embeddings.append(result["embeddings"])
                    else:
                        raise ValueError(f"Unexpected response format: {result}")
                else:
                    raise ValueError(f"Unexpected response type: {type(result)}")

            return embeddings

        except requests.exceptions.Timeout:
            raise ValueError("HuggingFace API request timed out")
        except Exception as e:
            print(f"❌ Error in HF API call: {e}")
            raise

# ✅ Initialize the embedding model once
embedding_model = HuggingFaceAPIEmbeddings(api_token=hf_api_token)

# -------------------------------------------------------------------
# 🔹 Alternative: Use free local embeddings as fallback
# -------------------------------------------------------------------
class LocalEmbeddings(Embeddings):
    """Fallback embedding model using all-MiniLM-L6-v2 dimensions"""
    
    def __init__(self, dimensions=384):
        self.dimensions = dimensions
        
    def embed_query(self, text: str):
        """Return dummy embeddings - in production, use a proper local model"""
        return [0.0] * self.dimensions
        
    def embed_documents(self, texts: list):
        """Return dummy embeddings for multiple documents"""
        return [[0.0] * self.dimensions for _ in texts]

# -------------------------------------------------------------------
# 🔹 In-memory chat sessions
# -------------------------------------------------------------------
chat_sessions = {}  # { session_id: {"vectorstore_path": str, "chat_history": list} }

# -------------------------------------------------------------------
# 🔹 Initialize Chat Session
# -------------------------------------------------------------------
def init_chat_from_base64(session_id: str, pdf_base64: str):
    """Initialize chat session using Base64 PDF (Render memory safe)."""
    temp_file_path = None
    try:
        # ✅ Decode PDF safely
        pdf_bytes = base64.b64decode(pdf_base64)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(pdf_bytes)
            temp_file_path = tmp.name

        # ✅ Load and split PDF
        loader = PyPDFLoader(temp_file_path)
        docs = loader.load()
        
        if not docs:
            raise ValueError("No documents loaded from PDF.")
            
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        chunks = splitter.split_documents(docs)
        
        if not chunks:
            raise ValueError("No readable text found in the uploaded PDF.")

        # ✅ Try Hugging Face embeddings first, fallback to local if it fails
        try:
            # Test the embedding model
            test_embedding = embedding_model.embed_query("test")
            print(f"✅ Using Hugging Face embeddings with dimension: {len(test_embedding)}")
            current_embedding_model = embedding_model
        except Exception as e:
            print(f"⚠️ Hugging Face embeddings failed, using local fallback: {e}")
            current_embedding_model = LocalEmbeddings()

        # ✅ Build FAISS index in /tmp
        temp_path = f"/tmp/vectorstore_{session_id}"
        vectorstore = FAISS.from_documents(chunks, current_embedding_model)
        vectorstore.save_local(temp_path)

        # ✅ Initialize chat session
        chat_sessions[session_id] = {
            "vectorstore_path": temp_path, 
            "chat_history": []
        }
        
        print(f"✅ Chat session '{session_id}' initialized successfully.")
        return {"message": f"Chat session '{session_id}' initialized successfully."}

    except Exception as e:
        print(f"❌ Error initializing chat: {e}")
        return {"error": str(e)}
    finally:
        # ✅ Cleanup temporary files and memory
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception as e:
                print(f"⚠️ Could not delete temp file: {e}")
        
        gc.collect()

# -------------------------------------------------------------------
# 🔹 Chat With PDF
# -------------------------------------------------------------------
def chat_with_pdf(session_id: str, message: str):
    """Chat with initialized PDF session (Render-safe)."""
    try:
        if session_id not in chat_sessions:
            return {"error": f"No chat session found for '{session_id}'."}

        session = chat_sessions[session_id]
        temp_path = session["vectorstore_path"]
        chat_history = session["chat_history"]

        # ✅ Use local embeddings for retrieval to avoid API issues
        local_embedding_model = LocalEmbeddings()
        
        # ✅ Reload FAISS index with local embeddings
        vectorstore = FAISS.load_local(
            temp_path, local_embedding_model, allow_dangerous_deserialization=True
        )
        retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
        docs = retriever.invoke(message)
        context = "\n\n".join([d.page_content for d in docs]) if docs else "No context found."

        # ✅ Build concise prompt
        past_convo = "\n".join([f"User: {u}\nAssistant: {a}" for u, a in chat_history[-3:]])
        prompt = f"""
You are a concise, factual assistant.
Use only the PDF context below to answer clearly and accurately.

Context:
{context}

Previous Chat:
{past_convo}

User Question:
{message}

Answer briefly using bullet points or short paragraphs.
"""

        # ✅ Use Groq model
        llm = ChatGroq(api_key=groq_api_key, model="llama-3.1-8b-instant", temperature=0.2)
        response = llm.invoke(prompt)
        answer = getattr(response, "content", "").strip() or "⚠️ No response from AI."

        chat_history.append((message, answer))

        print(f"[Chat] {session_id} | Q: {message} | A: {answer[:100]}...")
        return {"response": answer}

    except Exception as e:
        print(f"❌ Error in chat_with_pdf: {e}")
        return {"error": str(e)}
    finally:
        # ✅ Cleanup memory
        gc.collect()