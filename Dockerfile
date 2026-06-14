# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile
#
# Builds the Docker image used by both `api` and `worker` services.
# Same image, different startup commands (uvicorn vs celery).
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.12-slim

# Set working directory inside the container
WORKDIR /app

# WHY copy requirements first, then install, then copy code?
# Docker caches layers. If you copy all code first, any code change
# triggers a full pip install. This order means pip install only
# re-runs when requirements.txt changes — much faster rebuilds.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

# Create a non-root user (security best practice)
RUN adduser --disabled-password --gecos '' appuser && chown -R appuser /app
USER appuser

# Expose FastAPI port (only used by the api service, not worker)
EXPOSE 8000
