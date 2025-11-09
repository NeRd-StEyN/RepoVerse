# InSightAI Backend

Flask-based backend service for AI report generation and chat functionality.

## Features
- LangGraph-based report generation
- Groq LLM integration
- PDF generation with ReportLab
- Real-time progress tracking
- Chat functionality with PDF context

## Setup

1. Create and activate conda environment:
```bash
conda create -n insightai python=3.10
conda activate insightai
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment variables:
Create a `.env` file in the backend directory:
```env
GROQ_API_KEY=your_groq_api_key_here
FLASK_ENV=development
```

4. Run the server:
```bash
python server.py
```

The API will be available at http://localhost:8000

## API Endpoints

### Report Generation
- POST /generate_report - Start report generation
- GET /progress/<topic> - Get generation progress
- GET /report/<topic> - Get generated report

### Chat
- POST /chat/init - Initialize chat with PDF
- POST /chat/message - Send chat message

## Deployment
1. Set up environment variables
2. Install dependencies
3. Run with production WSGI server (e.g., gunicorn)