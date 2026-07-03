FROM ghcr.io/astral-sh/uv:python3.12-alpine AS builder
WORKDIR /app
# Enable byte-code compilation
ENV UV_COMPILE_BYTECODE=1
# Copy only dependencies configuration to leverage caching
COPY pyproject.toml uv.lock ./
# Install dependencies
RUN uv sync --frozen --no-dev --no-install-project

# Production image
FROM python:3.12-alpine
WORKDIR /app
# Copy the virtual environment from the builder
COPY --from=builder /app/.venv /app/.venv
# Copy application code
COPY . .
# Add virtual environment to PATH
ENV PATH="/app/.venv/bin:$PATH"
# Expose FastAPI port
EXPOSE 8000
# Run uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
