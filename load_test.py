"""
Bondley API Load Test — Locust
Çalıştırma (headless, 50 kullanıcı, 2 dk):
  locust -f load_test.py --headless -u 50 -r 5 -t 2m --host http://localhost:8000

Web UI ile:
  locust -f load_test.py --host http://localhost:8000
  → http://localhost:8089
"""
import random
from locust import HttpUser, task, between, events

# Geçerli bir test kullanıcısı — .env'deki admin veya test user ile doldur
TEST_EMAIL = "admin@bondley.one"
TEST_PASSWORD = "admin123"


class BondleyUser(HttpUser):
    wait_time = between(1, 3)
    token: str | None = None

    def on_start(self):
        resp = self.client.post(
            "/api/v1/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            name="/auth/login [setup]",
        )
        if resp.status_code == 200:
            data = resp.json()
            self.token = data.get("access_token")
        else:
            self.token = None

    def _auth(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    # --- Ağır yük: sıkça kullanılan endpointler ---

    @task(5)
    def bond_list(self):
        self.client.get("/api/v1/bonds?limit=50", headers=self._auth(), name="/bonds list")

    @task(3)
    def bond_detail(self):
        isins = ["TR0BA2341AA2", "TR0BA2341BB3", "TR0DKB2201A1"]
        isin = random.choice(isins)
        self.client.get(f"/api/v1/bonds/{isin}", headers=self._auth(), name="/bonds/[isin]")

    @task(3)
    def tlref_latest(self):
        self.client.get("/api/v1/tlref/latest", headers=self._auth(), name="/tlref/latest")

    @task(2)
    def bond_stats(self):
        self.client.get("/api/v1/bonds/stats", headers=self._auth(), name="/bonds/stats")

    @task(2)
    def me(self):
        self.client.get("/api/v1/auth/me", headers=self._auth(), name="/auth/me")

    @task(1)
    def public_summary(self):
        self.client.get("/api/v1/system/public-summary", name="/system/public-summary")

    @task(1)
    def favorites(self):
        self.client.get("/api/v1/bonds/favorites", headers=self._auth(), name="/bonds/favorites")

    # --- CPU yoğun: rate limit test ---

    @task(1)
    def calculation(self):
        self.client.post(
            "/api/v1/calculations/run",
            json={"bond_id": 1},
            headers=self._auth(),
            name="/calculations/run",
        )


@events.quitting.add_listener
def on_quit(environment, **kwargs):
    stats = environment.stats
    print("\n=== ÖZET ===")
    for name, entry in stats.entries.items():
        if entry.num_requests > 0:
            print(
                f"{name[1]:40s} | "
                f"req={entry.num_requests:5d} | "
                f"fail={entry.num_failures:4d} | "
                f"p50={entry.get_response_time_percentile(0.5):.0f}ms | "
                f"p95={entry.get_response_time_percentile(0.95):.0f}ms | "
                f"rps={entry.current_rps:.1f}"
            )
