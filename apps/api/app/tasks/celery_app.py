import json
import os
from celery import Celery
from celery.schedules import crontab

from app.core.config import get_settings

# #region agent log
try:
    log_path = "/app/debug-f7faef.log"
    with open(log_path, "a") as f:
        f.write(json.dumps({"sessionId": "f7faef", "runId": "init", "hypothesisId": "A", "location": "celery_app.py:7", "message": "Starting Celery app initialization", "data": {}, "timestamp": __import__("time").time() * 1000}) + "\n")
except: pass
# #endregion

try:
    settings = get_settings()
    # #region agent log
    try:
        log_path = "/app/debug-f7faef.log"
        with open(log_path, "a") as f:
            f.write(json.dumps({"sessionId": "f7faef", "runId": "init", "hypothesisId": "C", "location": "celery_app.py:15", "message": "Settings loaded successfully", "data": {"redis_url": settings.REDIS_URL[:20] + "..." if len(settings.REDIS_URL) > 20 else settings.REDIS_URL}, "timestamp": __import__("time").time() * 1000}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        log_path = "/app/debug-f7faef.log"
        with open(log_path, "a") as f:
            f.write(json.dumps({"sessionId": "f7faef", "runId": "init", "hypothesisId": "C", "location": "celery_app.py:18", "message": "Settings loading failed", "data": {"error": str(e), "error_type": type(e).__name__}, "timestamp": __import__("time").time() * 1000}) + "\n")
    except: pass
    # #endregion
    raise

# #region agent log
try:
    log_path = "/app/debug-f7faef.log"
    with open(log_path, "a") as f:
        f.write(json.dumps({"sessionId": "f7faef", "runId": "init", "hypothesisId": "B", "location": "celery_app.py:25", "message": "Creating Celery app", "data": {"broker": settings.REDIS_URL[:30] + "..." if len(settings.REDIS_URL) > 30 else settings.REDIS_URL}, "timestamp": __import__("time").time() * 1000}) + "\n")
except: pass
# #endregion

try:
    celery_app = Celery(
        "fincalc",
        broker=settings.REDIS_URL,
        backend=settings.REDIS_URL,
        include=["app.tasks.data_tasks"],
    )
    # #region agent log
    try:
        log_path = "/app/debug-f7faef.log"
        with open(log_path, "a") as f:
            f.write(json.dumps({"sessionId": "f7faef", "runId": "init", "hypothesisId": "B", "location": "celery_app.py:35", "message": "Celery app created, importing data_tasks", "data": {}, "timestamp": __import__("time").time() * 1000}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        log_path = "/app/debug-f7faef.log"
        with open(log_path, "a") as f:
            f.write(json.dumps({"sessionId": "f7faef", "runId": "init", "hypothesisId": "B", "location": "celery_app.py:38", "message": "Celery app creation failed", "data": {"error": str(e), "error_type": type(e).__name__}, "timestamp": __import__("time").time() * 1000}) + "\n")
    except: pass
    # #endregion
    raise

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Istanbul",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

celery_app.conf.beat_schedule = {
    "fetch-daily-tlref": {
        "task": "app.tasks.data_tasks.fetch_daily_tlref",
        "schedule": crontab(hour=18, minute=30, day_of_week="1-5"),
        "options": {"queue": "default"},
    },
    "run-daily-calculations": {
        "task": "app.tasks.data_tasks.run_daily_calculations",
        "schedule": crontab(hour=18, minute=45, day_of_week="1-5"),
        "options": {"queue": "default"},
    },
}
