FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && python -m spacy download en_core_web_sm
COPY . .
# Skip training if a pre-trained model is already present (baked from local run).
# To pre-train locally: python training/prepare_data.py && python training/train_model.py
RUN if [ ! -f models/disease_classifier.pkl ]; then \
        python training/prepare_data.py && python training/train_model.py; \
    fi
EXPOSE 5000
# start-period covers Gunicorn startup + eager model loading (~60-90 s).
# During start-period, health-check failures do not count toward retries.
HEALTHCHECK --interval=30s --timeout=15s --start-period=120s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1
CMD ["gunicorn", "--config", "gunicorn.conf.py", "wsgi:application"]
