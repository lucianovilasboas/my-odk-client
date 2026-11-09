# syntax=docker/dockerfile:1

# 1) build da PWA
FROM node:22-alpine AS web
ARG VITE_APP_VERSION=dev
ENV VITE_APP_VERSION=$VITE_APP_VERSION
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2) runtime do adaptador, servindo a PWA na mesma origem
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 STATIC_DIR=/app/app/static
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY --from=web /web/dist ./app/static

RUN useradd --system --uid 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8602
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8602"]
