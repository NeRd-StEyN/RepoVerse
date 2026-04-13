# ---------- Stage 1: Build Frontend ----------
FROM node:20-slim AS build-frontend
WORKDIR /app/frontend

# Copy only package files first (better caching)
COPY frontend/package*.json ./

# Use npm ci for reproducible HF builds
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend (Vite → dist)
RUN npm run build


# ---------- Stage 2: Final Image ----------
FROM python:3.11-slim

# Create HF-compatible user (required)
RUN useradd -m -u 1000 user
USER user

ENV PATH="/home/user/.local/bin:$PATH"
WORKDIR /app

# Install backend dependencies + gunicorn
COPY --chown=user backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy backend source
COPY --chown=user backend/ ./

# Copy frontend build output
COPY --from=build-frontend --chown=user /app/frontend/dist ./build

# Hugging Face required port
ENV PORT=7860
EXPOSE 7860

# Start backend
CMD ["gunicorn", "--bind", "0.0.0.0:7860", "--timeout", "300", "--graceful-timeout", "120", "--workers", "1", "--preload", "server:server"]
