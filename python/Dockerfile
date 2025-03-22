FROM python:3.11-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    unzip \
    gnupg \
    ca-certificates \
    libnss3 \
    libxss1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libxshmfence1 \
    libgbm1 \
    libx11-xcb1 \
    x11-apps \
    && rm -rf /var/lib/apt/lists/*

# Set display environment variable
ENV DISPLAY=:0

# Create working directory
WORKDIR /app

# Install pip packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright and browser binaries
RUN playwright install --with-deps

# Copy app
COPY . .

EXPOSE 8000

CMD ["python", "browser-use.py"]
