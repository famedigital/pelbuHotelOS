FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/bank-recon

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        gcc \
        libjpeg62-turbo \
        libpng16-16 \
    && rm -rf /var/lib/apt/lists/*

COPY services/finance-parser-worker/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY scripts/bank-recon/pelbu_bank_recon /app/bank-recon/pelbu_bank_recon
COPY services/finance-parser-worker/app ./app

RUN useradd --create-home --shell /usr/sbin/nologin worker \
    && chown -R worker:worker /app

USER worker

CMD ["python", "-m", "app.main"]
