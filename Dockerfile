# Base image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Copy backend files
COPY . .

# Install dependencies
RUN pip install --no-cache-dir -r requirementsrag.txt

# Expose port (adjust if using a different one)
EXPOSE 5000

# Set environment variables (optional)
ENV PYTHONUNBUFFERED=1

# Start the app (adjust if using something like uvicorn or gunicorn)
CMD ["python", "api.py"]
