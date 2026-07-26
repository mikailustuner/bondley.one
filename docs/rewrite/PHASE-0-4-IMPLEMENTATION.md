# Faz 0–4 Uygulama Kaydı

Durum: **TAMAMLANDI — 26.07.2026**

- Resmî kaynak URL/SHA-256 manifesti ve gerçek dosya fixture testleri eklendi.
- Güvenli HTTPS downloader; boyut, magic byte, traversal, şifreli ZIP ve zip-bomb
  kontrolleri uygulandı.
- `source_files`, `import_runs`, ham satırlar, kaynak notları ve diagnostics eklendi.
- `tbliste` 33 sütun, iki sayfa, 30 grup, 18 sınıflandırma ve duplicate/conflict
  motoruyla parse edilir.
- Ham açıklama korunur; spread/birim, benchmark, lag, rejim, yuvarlama ve tanılar
  AST’ye yazılır.
- `TRD` ailesinde TLREFK ayrımı uygulanır.
- TLREF/TLREFK oran ve endeks serileri iş günü boşluğu ile rekonstrükte edilir.
- KAP, sentetik fiyat ve eski hesap görevleri scheduler’dan çıkarıldı.

Gerçek fixture sonucu:

- tbliste: 2136 satır, 2135 tekil ISIN, 4 kaynak notu, 1 conflict.
- TLREF: 1896 oran, 1782 endeks, 1780 başarılı geçiş.
- TLREFK: 1026 oran, 1027 endeks, 1025 başarılı geçiş.
- `013 → 014 → 013 → 014` migrasyon çevrimi ve tam import idempotency testi geçti.

