# Base image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Copy app files
COPY . .

# Install dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Set environment variables (optional)
ENV PYTHONUNBUFFERED=1

# Render sets $PORT; default to 10000 for local.
CMD ["sh", "-c", "gunicorn backend.api:app --bind 0.0.0.0:${PORT:-10000}"]
