FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Skip training if a pre-trained model is already present (baked from local run).
# To pre-train locally: python training/prepare_data.py && python training/train_model.py
RUN if [ ! -f models/disease_classifier.pkl ]; then \
        python training/prepare_data.py && python training/train_model.py; \
    fi
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1
CMD ["gunicorn", "--config", "gunicorn.conf.py", "wsgi:application"]
