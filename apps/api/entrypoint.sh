#!/bin/sh
set -e
# Run migrations before starting the app
python -m alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
