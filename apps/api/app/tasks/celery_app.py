from celery import Celery
from celery.schedules import crontab

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "fincalc",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.data_tasks", "app.tasks.alerts_tasks"],
)

celery_app.conf.update(
    task_default_queue="default",
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
    "fetch-verified-daily-benchmarks": {
        "task": "app.tasks.data_tasks.fetch_verified_daily_benchmarks",
        "schedule": crontab(hour=16, minute=30, day_of_week="1-5"),
        "options": {"queue": "default"},
    },
    "fetch-verified-bist-snapshot": {
        "task": "app.tasks.data_tasks.fetch_verified_bist_snapshot",
        "schedule": crontab(hour=16, minute=35, day_of_week="1-5"),
        "options": {"queue": "default"},
    },
    "poll-kap-enrichment": {
        "task": "app.tasks.data_tasks.poll_kap_enrichment",
        "schedule": crontab(minute="*/15"),
        "options": {"queue": "default"},
    },
    "reconcile-kap-enrichment": {
        "task": "app.tasks.data_tasks.reconcile_kap_enrichment",
        "schedule": crontab(hour=0, minute=30),
        "options": {"queue": "default"},
    },
    "refresh-kap-public-proxy-pool": {
        "task": "app.tasks.data_tasks.refresh_kap_proxy_pool",
        "schedule": crontab(hour=3, minute=10),
        "options": {"queue": "default"},
    },
    "derive-kap-terms-after-bist": {
        "task": "app.tasks.data_tasks.derive_kap_terms",
        "schedule": crontab(hour=16, minute=45, day_of_week="1-5"),
        "options": {"queue": "default"},
    },
    "check-user-alerts": {
        "task": "app.tasks.alerts_tasks.check_user_alerts",
        "schedule": crontab(minute="*/15"),
        "options": {"queue": "default"},
    },
}
