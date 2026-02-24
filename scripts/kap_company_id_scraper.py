#!/usr/bin/env python3
"""
sirketler.txt'deki şirket adlarıyla DuckDuckGo'da "kap.org.tr + şirket adı" arar,
ilk sonuca tıklar, KAP sayfasında Bildirimler -> Seçim yapınız -> Özel Durum
Açıklamaları -> Uygula akışını yapar ve network'ten company-detail API
URL'lerindeki şirket id'lerini çıkarıp sirket_kap_idleri.csv dosyasına yazar.

Rate limit / engel: Her şirket sonrası rastgele bekleme (varsayılan 15–35 sn).
Engel tespit edilirse KAP_BLOCK_WAIT sn (varsayılan 300) bekleyip tekrar dener.
Proxy: Ortam değişkeni KAP_PROXY/PROXY veya proje kökünde proxies.txt (her satır bir proxy:
  host:port veya http://host:port; # ile yorum). KAP_PROXY_FILE ile dosya yolu verilebilir.
  KAP_DELAY_MIN, KAP_DELAY_MAX, KAP_BLOCK_WAIT ile süreler ayarlanabilir.
"""
import json
import os
import random
import re
import time
from pathlib import Path
from urllib.parse import quote, urlparse

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, ElementClickInterceptedException

PROJECT_ROOT = Path(__file__).resolve().parent.parent
COMPANIES_FILE = PROJECT_ROOT / "sirketler.txt"
OUTPUT_CSV = PROJECT_ROOT / "sirket_kap_idleri.csv"
PROXIES_FILE = PROJECT_ROOT / "proxies.txt"  # Satır satır host:port veya http://host:port
# API URL örneği: .../company-detail/sgbf-data/4028e4a140e95bea0140ed2fde10009d/ODA/365
KAP_ID_PATTERN = re.compile(r"sgbf-data/([a-f0-9]+)/ODA", re.I)

# Engel / rate limit: ortam değişkeninden (saniye). Varsayılan 15–35 sn arası rastgele.
DELAY_MIN = int(os.environ.get("KAP_DELAY_MIN", "15"))
DELAY_MAX = int(os.environ.get("KAP_DELAY_MAX", "35"))
# Engel tespitinde bekleme (saniye). Varsayılan 5 dakika.
BLOCK_WAIT_SEC = int(os.environ.get("KAP_BLOCK_WAIT", "300"))

BLOCKED_PAGE_PATTERNS = re.compile(
    r"engellenmistir|excessive request|request has been blocked",
    re.I
)


def _parse_proxy_line(line):
    """Bir satırdan host:port döndürür; geçersizse None."""
    line = (line or "").strip()
    if not line or line.startswith("#"):
        return None
    try:
        p = urlparse(line if "://" in line else f"http://{line}")
        if p.hostname:
            return f"{p.hostname}:{p.port or 80}" if p.port else p.hostname
    except Exception:
        pass
    return None


def load_proxies_from_file(path=None):
    """
    .txt dosyasından proxy listesi okur. Her satır: host:port veya http://host:port (# yorum).
    path yoksa KAP_PROXY_FILE ortam değişkeni veya PROJECT_ROOT/proxies.txt kullanılır.
    """
    path = path or os.environ.get("KAP_PROXY_FILE", "").strip() or PROXIES_FILE
    path = Path(path)
    if not path.is_file():
        return []
    proxies = []
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        p = _parse_proxy_line(line)
        if p:
            proxies.append(p)
    return proxies


def get_proxy():
    """
    Kullanılacak tek proxy: önce proxies.txt (veya KAP_PROXY_FILE), yoksa KAP_PROXY/PROXY env.
    Dosyada birden fazla varsa ilki kullanılır (istediğin sırayı üstte tutabilirsin).
    """
    proxies = load_proxies_from_file()
    if proxies:
        return proxies[0]
    raw = os.environ.get("KAP_PROXY") or os.environ.get("PROXY", "").strip()
    if not raw:
        return None
    return _parse_proxy_line(raw)


def get_chrome_driver(proxy_host_port=None):
    """Performance log ile Chrome driver; otomasyon tespitini azaltacak ayarlar. İsteğe bağlı proxy."""
    opts = Options()
    # opts.add_argument("--headless")  # Headless genelde tespit edilir, kapalı tut
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_experimental_option("excludeSwitches", ["enable-automation", "enable-logging"])
    opts.add_experimental_option("useAutomationExtension", False)
    opts.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    if proxy_host_port:
        opts.add_argument(f"--proxy-server={proxy_host_port}")
    opts.set_capability("goog:loggingPrefs", {"performance": "ALL", "browser": "ALL"})
    driver = webdriver.Chrome(options=opts)
    # navigator.webdriver'ı gizle (CDP)
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
    })
    return driver


def is_page_blocked(driver):
    """Sayfa kaynağında 'engellenmistir' / 'excessive request' var mı kontrol eder."""
    try:
        body = (driver.page_source or "") + " " + (driver.title or "")
        return bool(BLOCKED_PAGE_PATTERNS.search(body))
    except Exception:
        return False


def extract_kap_id_from_performance_log(driver):
    """Performance log içinden KAP company-detail sgbf-data/ID/ODA URL'ini bulur, ID döner."""
    time.sleep(1.5)  # API isteğinin log'a düşmesi için
    ids_found = []
    urls_found = []
    try:
        for entry in driver.get_log("performance"):
            try:
                msg = json.loads(entry["message"])["message"]
                method = msg.get("method", "")
                if "Network.requestWillBeSent" != method:
                    continue
                params = msg.get("params", {})
                request = params.get("request", {})
                url = (request.get("url") or "").strip()
                if "company-detail/sgbf-data" in url and "/ODA" in url:
                    m = KAP_ID_PATTERN.search(url)
                    if m:
                        ids_found.append(m.group(1))
                        urls_found.append(url)
            except (KeyError, TypeError, json.JSONDecodeError):
                continue
    except Exception:
        pass
    # Aynı istek tekrar log'da görünebilir; benzersiz id ve URL döndür
    if ids_found:
        return ids_found[0], urls_found[0]
    return None, None


def search_duckduckgo_and_click_first_kap(driver, wait, company_name):
    """DuckDuckGo'da 'kap.org.tr + şirket adı' arar ve ilk sonuca tıklar (reCAPTCHA yok)."""
    query = f"kap.org.tr {company_name}"
    driver.get("https://duckduckgo.com/?q=" + quote(query))
    time.sleep(2.5)
    try:
        first_result = wait.until(
            EC.presence_of_all_elements_located(
                (By.CSS_SELECTOR, "a[data-testid='result-title-a'], a.result__a")
            )
        )
        if not first_result:
            return False
        # İnsan benzeri tıklama (JS yerine ActionChains)
        ActionChains(driver).move_to_element(first_result[0]).pause(0.4).click().perform()
        time.sleep(4)  # KAP sayfasının açılması için
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        time.sleep(3)  # SPA/menü yüklenene kadar
        return True
    except TimeoutException:
        return False


def get_kap_id_on_company_page(driver, wait):
    """
    KAP şirket sayfasında: Bildirimler -> Seçim yapınız -> Özel Durum Açıklamaları -> Uygula.
    Sonra performance log'dan company id ve URL'yi çıkarır.
    """
    # Sayfa ve menü yüklenene kadar bekle (SPA)
    time.sleep(5)

    # 1) Bildirimler – doğru URL: sirket-bildirimleri/{id}-{slug} (sirket-bilgileri/genel/ değil)
    current_url = (driver.current_url or "").strip()
    if "sirket-bilgileri/genel/" in current_url:
        bildirimler_url = current_url.replace("sirket-bilgileri/genel/", "sirket-bildirimleri/", 1)
        try:
            driver.get(bildirimler_url)
            time.sleep(5)  # Bildirimler sayfası yüklensin
        except Exception:
            pass
    else:
        # URL ile gidilemediyse sekme tıklaması dene
        try:
            wait.until(EC.presence_of_element_located((By.PARTIAL_LINK_TEXT, "Bildirimler")))
        except TimeoutException:
            pass
        time.sleep(1)

        bildirimler = None
        selectors = [
            (By.XPATH, "//button[contains(., 'Bildirimler')]"),
            (By.XPATH, "//*[@role='tab' and contains(., 'Bildirimler')]"),
            (By.XPATH, "//div[contains(@class,'MuiTab') and contains(., 'Bildirimler')]"),
            (By.XPATH, "//a[contains(normalize-space(), 'Bildirimler')]"),
            (By.PARTIAL_LINK_TEXT, "Bildirimler"),
            (By.LINK_TEXT, "Bildirimler"),
            (By.XPATH, "//*[normalize-space()='Bildirimler' and (self::a or self::button or self::span)]"),
            (By.XPATH, "//span[contains(., 'Bildirimler')]/parent::*"),
            (By.XPATH, "//*[contains(@class, 'tab') and contains(., 'Bildirimler')]"),
            (By.CSS_SELECTOR, "a[href*='bildirim']"),
        ]
        for by, value in selectors:
            try:
                elems = driver.find_elements(by, value)
                for el in elems:
                    if not el.is_displayed():
                        continue
                    bildirimler = el
                    break
                if bildirimler is not None:
                    break
            except Exception:
                continue
        if bildirimler is None:
            time.sleep(5)
            for by, value in selectors:
                try:
                    elems = driver.find_elements(by, value)
                    for el in elems:
                        if not el.is_displayed():
                            continue
                        bildirimler = el
                        break
                    if bildirimler is not None:
                        break
                except Exception:
                    continue
        if bildirimler is not None:
            try:
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", bildirimler)
                time.sleep(0.5)
                ActionChains(driver).move_to_element(bildirimler).pause(0.3).click().perform()
                time.sleep(5)
            except Exception:
                try:
                    driver.execute_script("arguments[0].click();", bildirimler)
                    time.sleep(5)
                except Exception:
                    return None, None
        else:
            return None, None
    # Bildirimler sayfasındayız; ek bekleme
    time.sleep(1)

    # 2) "Seçim Yapınız" – MUI Select (role=combobox, aria-label="Bildirim tipi için seçim yapınız")
    select_box = None
    for by, value in [
        (By.XPATH, "//div[@role='combobox' and contains(@aria-label, 'seçim yapınız')]"),
        (By.XPATH, "//div[@role='combobox'][.//span[contains(., 'Seçim Yapınız')]]"),
        (By.CSS_SELECTOR, "div.MuiSelect-select"),
        (By.XPATH, "//div[contains(@class,'MuiSelect-select') and contains(., 'Seçim Yapınız')]"),
        (By.XPATH, "//*[contains(., 'Seçim Yapınız')]/ancestor::div[@role='combobox']"),
    ]:
        try:
            elems = driver.find_elements(by, value)
            for el in elems:
                if not el.is_displayed():
                    continue
                select_box = el
                break
            if select_box is not None:
                break
        except Exception:
            continue
    if select_box is None:
        return None, None
    try:
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", select_box)
        time.sleep(0.3)
        # MUI combobox'ı aç: önce tıklanabilir alana git, sonra tıkla
        ActionChains(driver).move_to_element(select_box).pause(0.2).click().perform()
        time.sleep(0.8)
        # Açılmadıysa JS click veya Enter (MUI bazen klavye ile açılıyor)
        if select_box.get_attribute("aria-expanded") != "true":
            driver.execute_script("arguments[0].click();", select_box)
            time.sleep(0.6)
        if select_box.get_attribute("aria-expanded") != "true":
            select_box.send_keys(Keys.ENTER)
            time.sleep(0.6)
    except Exception:
        return None, None

    # 3) Açılan listeden "Özel Durum Açıklamaları" (MUI: role=option veya listbox içinde li)
    try:
        wait.until(
            EC.visibility_of_element_located(
                (By.XPATH, "//*[@role='option' and contains(., 'Özel Durum')] | //ul[@role='listbox']//*[contains(., 'Özel Durum Açıklamaları')] | //li[contains(., 'Özel Durum Açıklamaları')]")
            )
        )
    except TimeoutException:
        pass
    time.sleep(0.4)

    oda_option = None
    for by, value in [
        (By.XPATH, "//*[@role='option' and contains(., 'Özel Durum Açıklamaları')]"),
        (By.XPATH, "//*[@role='option' and contains(., 'Özel Durum')]"),
        (By.XPATH, "//ul[@role='listbox']//li[contains(., 'Özel Durum Açıklamaları')]"),
        (By.XPATH, "//*[@role='listbox']//*[contains(., 'Özel Durum Açıklamaları')]"),
        (By.XPATH, "//li[contains(., 'Özel Durum Açıklamaları')]"),
        (By.XPATH, "//*[contains(., 'Özel Durum Açıklamaları') and not(contains(., 'Seçim Yapınız'))]"),
    ]:
        try:
            elems = driver.find_elements(by, value)
            for el in elems:
                if not el.is_displayed():
                    continue
                txt = (el.text or "").strip()
                if "Seçim" in txt and "Özel" not in txt:
                    continue
                oda_option = el
                break
            if oda_option is not None:
                break
        except Exception:
            continue
    if oda_option is None:
        return None, None
    try:
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", oda_option)
        time.sleep(0.2)
        ActionChains(driver).move_to_element(oda_option).pause(0.15).click().perform()
    except Exception:
        try:
            driver.execute_script("arguments[0].click();", oda_option)
        except Exception:
            return None, None
    time.sleep(1.0)

    # 4) Uygula / Apply butonu (sadece ODA seçildikten sonra)
    uygula = None
    for by, value in [
        (By.XPATH, "//button[contains(., 'Uygula') or contains(., 'Apply')]"),
        (By.XPATH, "//*[contains(., 'Uygula') or contains(., 'Apply') and (self::button or self::a)]"),
        (By.CSS_SELECTOR, "button.p-button"),
    ]:
        try:
            elems = driver.find_elements(by, value)
            for el in elems:
                if el.is_displayed():
                    uygula = el
                    break
            if uygula is not None:
                break
        except Exception:
            continue
    if uygula is None:
        return None, None
    try:
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", uygula)
        time.sleep(0.2)
        ActionChains(driver).move_to_element(uygula).pause(0.15).click().perform()
    except Exception:
        driver.execute_script("arguments[0].click();", uygula)

    return extract_kap_id_from_performance_log(driver)


def load_companies(path):
    """sirketler.txt'den şirket adlarını okur (boş satırları atlar)."""
    if not path.exists():
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def main():
    companies = load_companies(COMPANIES_FILE)
    if not companies:
        print(f"Şirket bulunamadı: {COMPANIES_FILE}")
        return 1

    # CSV başlık + mevcut sonuçları koruma (yarıda kesilirse devam için)
    results = []
    if OUTPUT_CSV.exists():
        existing = OUTPUT_CSV.read_text(encoding="utf-8").strip().splitlines()
        if existing:
            header = existing[0]
            for line in existing[1:]:
                parts = line.split(",", 2)  # company, id, url
                if len(parts) >= 2 and parts[1].strip():
                    results.append((parts[0].strip(), parts[1].strip(), parts[2].strip() if len(parts) > 2 else ""))
    done_names = {r[0] for r in results}
    companies_to_process = [c for c in companies if c not in done_names]

    if not companies_to_process:
        print("Tüm şirketler zaten işlendi.")
        return 0

    proxy_list = load_proxies_from_file()
    proxy = get_proxy()
    if proxy:
        if proxy_list:
            print(f"Proxy dosyasından {len(proxy_list)} adet yüklendi, kullanılan: {proxy}")
        else:
            print(f"Proxy kullanılıyor: {proxy}")
    driver = get_chrome_driver(proxy_host_port=proxy)
    wait = WebDriverWait(driver, 30)
    try:
        for i, company in enumerate(companies_to_process, 1):
            print(f"[{i}/{len(companies_to_process)}] {company[:50]}...")
            try:
                for attempt in range(2):  # Engel gelirse bir kez daha dene
                    if not search_duckduckgo_and_click_first_kap(driver, wait, company):
                        print(f"  -> DuckDuckGo'da KAP sonucu bulunamadı, atlanıyor.")
                        results.append((company, "", ""))
                        break
                    time.sleep(2)
                    if is_page_blocked(driver):
                        print(f"  -> Engel/rate limit tespit edildi. {BLOCK_WAIT_SEC} sn bekleniyor...")
                        time.sleep(BLOCK_WAIT_SEC)
                        if attempt == 0:
                            continue  # Bir kez daha dene
                        results.append((company, "", ""))
                        break
                    kap_id, api_url = get_kap_id_on_company_page(driver, wait)
                    if kap_id:
                        results.append((company, kap_id, api_url or ""))
                        print(f"  -> id: {kap_id}")
                    else:
                        results.append((company, "", ""))
                        print(f"  -> id bulunamadı (sayfa yapısı farklı olabilir)")
                    break
            except Exception as e:
                print(f"  -> Hata: {e}")
                results.append((company, "", ""))
            # Her şirketten sonra CSV güncelle
            with open(OUTPUT_CSV, "w", encoding="utf-8") as f:
                f.write("sirket_adi,kap_id,api_url\n")
                for name, kid, url in results:
                    url_esc = url.replace('"', '""') if url else ""
                    name_esc = name.replace('"', '""')
                    f.write(f'"{name_esc}","{kid}","{url_esc}"\n')
            # İstekler arası bekleme (rate limit’e takılmamak için)
            if i < len(companies_to_process):
                delay = random.uniform(DELAY_MIN, DELAY_MAX)
                print(f"  -> Sonraki istek için {delay:.0f} sn bekleniyor...")
                time.sleep(delay)
    finally:
        driver.quit()

    print(f"\nSonuçlar: {OUTPUT_CSV}")
    return 0


if __name__ == "__main__":
    exit(main())
