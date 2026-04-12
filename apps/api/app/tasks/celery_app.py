from celery import Celery
from celery.schedules import crontab

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "fincalc",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.data_tasks", "app.tasks.alerts_tasks", "app.tasks.kap_tasks"],
)

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
        "schedule": crontab(hour=16, minute=30, day_of_week="1-5"),
        "options": {"queue": "default"},
    },
    "fetch-bond-list": {
        "task": "app.tasks.data_tasks.fetch_bond_list",
        "schedule": crontab(hour=16, minute=32, day_of_week="1-5"),
        "options": {"queue": "default"},
    },
    "check-user-alerts": {
        "task": "app.tasks.alerts_tasks.check_user_alerts",
        "schedule": crontab(minute="*/15"),
        "options": {"queue": "default"},
    },
    "fetch-kap-disclosures": {
        "task": "app.tasks.kap_tasks.fetch_kap_disclosures",
        "schedule": crontab(hour=16, minute=15, day_of_week="1-5"),
        "options": {"queue": "default"},
    },
    "populate-daily-market-data": {
        "task": "app.tasks.data_tasks.populate_daily_market_data",
        "schedule": crontab(hour=16, minute=34, day_of_week="1-5"),
        "options": {"queue": "default"},
    },
    "run-daily-calculations": {
        "task": "app.tasks.data_tasks.run_daily_calculations",
        "schedule": crontab(hour=16, minute=36, day_of_week="1-5"),
        "options": {"queue": "default"},
    },
}
