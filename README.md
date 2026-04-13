---
title: RepoVerse
emoji: 📝
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
---

<div align="center">

# 📝 RepoVerse

### AI-Powered Report Generation and Interactive Chat

[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Flask](https://img.shields.io/badge/Flask-3.x-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Python](https://img.shields.io/badge/Python-3.10-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-Powered-00A67E?style=for-the-badge)](https://langchain.com/)

Generate comprehensive AI research reports and interact with them through an intelligent chat interface powered by advanced LLMs.

[Features](#-features) • [Demo](#-demo) • [Installation](#-installation) • [Usage](#-usage) • [API](#-api-documentation) • [Contributing](#-contributing)

</div>

---

## ✨ Features

### 🤖 **AI Report Generation**
- Generate detailed research reports on any topic using LangGraph and Groq LLM
- Real-time progress tracking with visual feedback
- Professional PDF output with ReportLab

### 💬 **Interactive Chat**
- Chat with your generated reports using RAG (Retrieval Augmented Generation)
- Context-aware responses based on PDF content
- Natural language understanding

### 🎨 **Modern UI/UX**
- Responsive React-based frontend built with Vite
- PDF visualization with Canvas API (Hugging Face compatible)
- Clean and intuitive interface
- Multi-language support

### 🚀 **Production Ready**
- Dockerized deployment
- RESTful API architecture
- Environment-based configuration
- Scalable backend with Flask

---

## 🎯 Demo

> Generate reports on any topic and start chatting with them instantly!

**Report Generation Flow:**
1. Enter your research topic
2. Watch real-time generation progress
3. Download your professional PDF report
4. Start an interactive chat session

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **Python** (3.10)
- **Conda** (Anaconda or Miniconda)
- **Docker** (optional, for containerized deployment)
- **Groq API Key** ([Get it here](https://console.groq.com/))

---

## 🚀 Installation

### Option 1: Local Development Setup

#### **Backend Setup**

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create conda environment:**
   ```bash
   conda create -n repoverse python=3.10
   conda activate repoverse
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   
   Create a `.env` file in the `backend` directory:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   FLASK_ENV=development
   PORT=8000
   ```

5. **Start the backend server:**
   ```bash
   python server.py
   ```
   
   Backend will be running at `http://localhost:8000` 🎉

#### **Frontend Setup**

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   
   Create a `.env` file in the `frontend` directory:
   ```env
   VITE_API_URL=http://localhost:8000
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   
   Frontend will be running at `http://localhost:5173` 🎉

### Option 2: Docker Deployment

1. **Build and run with Docker:**
   ```bash
   docker build -t repoverse .
   docker run -p 7860:7860 -e GROQ_API_KEY=your_api_key repoverse
   ```

2. **Access the application:**
   
   Open `http://localhost:7860` in your browser

---

## 💻 Usage

### Generating a Report

1. Open the application in your browser
2. Enter your research topic in the input field
3. Click "Generate Report"
4. Monitor the real-time progress bar
5. Once complete, download your PDF report

### Chatting with Reports

1. After generating a report, click "Start Chat"
2. Ask questions about the report content
3. Receive AI-powered responses based on the document
4. Continue the conversation naturally

---

## 📚 API Documentation

### Report Generation Endpoints

#### **Generate Report**
```http
POST /generate_report
Content-Type: application/json

{
  "topic": "Artificial Intelligence in Healthcare"
}
```

**Response:**
```json
{
  "status": "started",
  "topic": "Artificial Intelligence in Healthcare"
}
```

#### **Check Progress**
```http
GET /progress/<topic>
```

**Response:**
```json
{
  "progress": 75,
  "status": "generating",
  "message": "Analyzing sources..."
}
```

#### **Get Report**
```http
GET /report/<topic>
```

**Response:** PDF file download

### Chat Endpoints

#### **Initialize Chat**
```http
POST /chat/init
Content-Type: multipart/form-data

file: <pdf_file>
```

**Response:**
```json
{
  "status": "initialized",
  "session_id": "uuid-string"
}
```

#### **Send Message**
```http
POST /chat/message
Content-Type: application/json

{
  "session_id": "uuid-string",
  "message": "What are the main findings?"
}
```

**Response:**
```json
{
  "response": "The main findings include...",
  "sources": [...] 
}
```

---

## 🏗️ Project Structure

```
RepoVerse/
├── frontend/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   └── utils/           # Utility functions
│   ├── public/              # Static assets
│   └── package.json
│
├── backend/                 # Flask backend
│   ├── server.py           # Main Flask application
│   ├── requirements.txt    # Python dependencies
│   └── utils/              # Backend utilities
│
├── Dockerfile              # Docker configuration
└── README.md              # This file
```

---

## 🛠️ Technologies Used

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **PDF.js** - PDF rendering
- **Axios** - HTTP client
- **TailwindCSS** - Styling (if applicable)

### Backend
- **Flask** - Web framework
- **LangGraph** - AI workflow orchestration
- **Groq** - LLM provider
- **ReportLab** - PDF generation
- **LangChain** - AI/LLM framework
- **FAISS** - Vector store for RAG

---

## 🔧 Configuration

### Environment Variables

#### Backend (`.env`)
```env
GROQ_API_KEY=your_groq_api_key
FLASK_ENV=development|production
PORT=8000
DEBUG=True|False
```

#### Frontend (`.env`)
```env
VITE_API_URL=http://localhost:8000
```

---

## 🐳 Docker Deployment

The application is Docker-ready and can be deployed on:
- **Hugging Face Spaces**
- **AWS ECS/Fargate**
- **Google Cloud Run**
- **Azure Container Instances**
- Any Docker-compatible platform

### Hugging Face Spaces Deployment

The `---` metadata at the top of this README configures the Space automatically.

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit your changes**
   ```bash
   git commit -m 'Add some amazing feature'
   ```
4. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

---

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

---

## 🙏 Acknowledgments

- **Groq** for providing fast LLM inference
- **LangChain** team for the amazing AI framework
- **React** and **Vite** communities
- All contributors and users of this project

---

## 📞 Support

If you have any questions or run into issues:

- 🐛 [Open an issue](https://github.com/NeRd-StEyN/repo2/issues)
- 💬 Start a discussion
- 📧 Contact the maintainers

---

<div align="center">

**Made with ❤️ by the RepoVerse Team**

⭐ Star this repo if you find it helpful!

</div>
