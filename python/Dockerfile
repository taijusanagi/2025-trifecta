FROM python:3.11

WORKDIR /app

# Install system dependencies required by Playwright
RUN apt-get update && apt-get install -y \
    curl unzip xvfb libnss3 libxss1 libasound2 libatk-bridge2.0-0 libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browser binaries
RUN python -m playwright install chromium

# Copy source code
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Run the app
CMD ["python", "browser-use.py"]
