# =====================
# Builder stage
# =====================
FROM python:3.13-slim AS builder

# Install UV
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy dependency metadata
COPY pyproject.toml uv.lock ./

# Install prod dependencies
RUN uv sync --frozen --no-dev

# =====================
# Runtime stage
# =====================
FROM python:3.13-slim

WORKDIR /app

# Copy venv + uv
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /usr/local/bin/uv /usr/local/bin/uv

# Copy application code
COPY . .

# Environment
ENV PATH="/app/.venv/bin:$PATH" \
  PYTHONUNBUFFERED=1 \
  PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

# Healthcheck (NO external deps)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"

# Run FastAPI
CMD ["uv", "run", "main.py"]
