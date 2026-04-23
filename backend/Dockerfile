# Prelegal Backend Dockerfile
FROM python:3.11-slim

RUN pip install uv

WORKDIR /app
COPY pyproject.toml ./
COPY main.py ./

# Install dependencies and run using uv
RUN uv sync

EXPOSE 8000

CMD ["uv", "run", "python", "main.py"]