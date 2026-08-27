FROM python:3.11-slim

# Security: create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Install dependencies first (cache layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Production: use multiple workers, access logs, no reload
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "2", "--access-log", "--log-level", "info"]
