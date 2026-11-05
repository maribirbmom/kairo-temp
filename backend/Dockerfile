# Kairo API image (built by Hugging Face Spaces; you do not need Docker locally).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FASTEMBED_CACHE_PATH=/home/user/.cache/fastembed

# Build tools for any dependency that has no prebuilt wheel.
RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces runs containers as a non-root user with uid 1000.
RUN useradd -m -u 1000 user
WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

USER user
ENV PATH="/home/user/.local/bin:$PATH"

# Download the embedding model at BUILD time so visitors never wait for it.
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5')"

COPY --chown=user . .

EXPOSE 7860
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "7860"]
