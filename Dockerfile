FROM node:24-bookworm-slim AS frontend-build
WORKDIR /app
COPY package*.json ./
COPY client/package*.json client/
RUN npm ci
COPY client client
RUN npm run build -w client

FROM python:3.13-slim AS runtime
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend backend
COPY --from=frontend-build /app/client/dist/client/browser client-dist
EXPOSE 3000
CMD ["sh", "-c", "uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-3000}"]
