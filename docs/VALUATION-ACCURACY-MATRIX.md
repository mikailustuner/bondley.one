# Bondley değerleme doğruluk sözleşmesi

Bu belge `valuation-engine-v3.0.0`, `tbliste-v2-3` ve `remarks-tr-v2-1`
sürümlerinin hangi veriyi kesin, hangi veriyi türetilmiş ve hangi veriyi
senaryo olarak kullandığını tanımlar.

## Temel ayrım

- **Yayımlanmış kupon:** BIST `tbliste` veya doğrulanmış kaynakta dönemsel
  kupon oranı sıfırdan büyükse kaynak değerdir.
- **Hesaplanan kesin kupon:** Kupon döneminin iki sınır endeksi de mevcutsa
  sözleşme formülüyle hesaplanan değerdir.
- **Cari projeksiyon:** Kupon dönemi tamamlanmadığında, gerçekleşen endeks
  değişiminin tam döneme taşınmasıdır.
- **İşlemiş tutar:** Cari projeksiyondan bağımsızdır. Endeks değişimine bağlı
  kıymetlerde valörün T-1 iş gününe kadar gerçekleşen endeks getirisi ve
  valöre kadar biriken spread ile BAP 4.4'e göre hesaplanır.
- **Gelecek kupon senaryosu:** Henüz gözlemlenemeyen dönemler için cari yıllık
  kupon oranının her dönemin gerçek gün sayısına uygulanmasıdır.
- **Teorik YTM:** Kaynak fiyat bulunmadığında BIST kotasyon bazına göre 100
  temiz veya 100 kirli fiyat senaryosundan hesaplanan getiridir. Resmî piyasa
  getirisi değildir.

## Kupon oranı dönüşümleri

`p` dönemsel kupon oranı, `d` kupon döneminin gerçek gün sayısı olmak üzere:

```text
yıllık basit = p × 365 / d
yıllık bileşik = (1 + p)^(365 / d) - 1
ödeme tutarı = nominal × p
```

Kupon sıklığı yalnız takvim ve teorik getiri bileşik dönemini tanımlar.
`p × sıklık` yöntemi, gerçek dönem gün sayısı `365 / sıklık` değerine eşit
değilse kullanılmaz.

Borsa İstanbul’un
[BIST-KYD Endeksleri Kural Seti](https://www.borsaistanbul.com/files/-bist-kyd-endeksleri-kural-seti.pdf)
BIST TLREF Endeksi formülündeki “Ek Getiri”yi yıllık oran olarak tanımlar.
Bu nedenle “BIST TLREF Endeksi Değişimi + ek getiri” kalıbındaki spread,
metin açıkça “dönemsel” demedikçe yıllık basit spread olarak uygulanır.

## TRFTURK42710 golden doğrulaması

KAP tarafından yayımlanan ilk kupon:

| Alan | Değer |
| --- | ---: |
| Dönem | 17.04.2026–17.07.2026 |
| Gerçek gün | 91 |
| Başlangıç TLREF endeksi (T-1, 16.04.2026) | 5.720,26231 |
| Bitiş TLREF endeksi (T-1, 16.07.2026) | 6.319,08861 |
| Yıllık spread | %2,50 |
| Dönemsel kupon | %11,0918 |
| Yıllık basit | %44,4891 |
| Yıllık bileşik | %52,4860 |
| 75.000.000 TL nominal ödeme | 8.318.850 TL |

Motorun endeks hesabı:

```text
endeks getirisi = 6319,08861 / 5720,26231 - 1
dönemsel spread = 0,025 × 91 / 365
dönemsel kupon = endeks getirisi + dönemsel spread
```

Kaynak endeks değerlerinin beş ondalığa yuvarlanmış olması nedeniyle motorun
ham sonucu `%11,09179886` olur ve KAP gösterim hassasiyetinde `%11,0918`
değerine eşittir.

## TRFDVYS42711 golden doğrulaması

KAP tarafından yayımlanan ilk kupon:

| Alan | Değer |
| --- | ---: |
| Dönem | 27.04.2026–27.07.2026 |
| Gerçek gün | 91 |
| Başlangıç TLREF endeksi (T-1, 24.04.2026) | 5.783,07346 |
| Bitiş TLREF endeksi (T-1, 24.07.2026) | 6.388,49162 |
| Yıllık spread | %3,75 |
| Dönemsel kupon | %11,4037 |
| Yıllık basit | %45,7402 |
| Yıllık bileşik | %54,2106 |
| 512.300.000 TL nominal ödeme | 58.421.155,10 TL |

```text
endeks getirisi = 6388,49162 / 5783,07346 - 1
dönemsel spread = 0,0375 × 91 / 365
dönemsel kupon = %11,40372745 → KAP hassasiyetinde %11,4037
```

KAP ödeme tutarı, ilan edilmiş dört ondalıklı dönemsel oran kullanılarak
`512.300.000 × 0,114037 = 58.421.155,10 TL` şeklinde yeniden üretilir.

## TRDQNBV82713 hedefli KAP backfill doğrulaması

KAP bildirimleri `1606368` ve `1606740` içindeki ilk üç dönemsel kira oranı,
resmî TLREFK endeks sınırlarıyla birbirinden bağımsız olarak aynı yıllık basit
spreadi üretir:

| Kupon dönemi | KAP dönemsel oran | Başlangıç/bitiş TLREFK | Türetilen spread |
| --- | ---: | ---: | ---: |
| 13.08.2025–12.11.2025 | %10,9045 | 2.718,52401 / 3.007,17194 | %1,15 |
| 12.11.2025–11.02.2026 | %10,1506 | 3.007,17194 / 3.303,79554 | %1,15 |
| 11.02.2026–13.05.2026 | %10,5194 | 3.303,79554 / 3.641,86408 | %1,15 |

27.07.2026 valöründe, 24.07.2026 resmî TLREFK endeksi `3.951,11584`,
başlangıç endeksi `3.641,86408`, 91 günlük tam dönem ve 75 günlük gerçekleşen
projeksiyon aralığı kullanılır. Kirli fiyat 100 teorik senaryosunun kilitli
çıktıları:

| Alan | Sonuç |
| --- | ---: |
| Projeksiyonlu referans dönem getirisi | %10,39443532 |
| Dönemsel kupon | %10,68114765 |
| Yıllık basit kupon | %42,84196586 |
| Yıllık bileşik kupon | %50,23770495 |
| İşlemiş tutar | 8,72788022 |
| Temiz fiyat | 91,27211978 |
| Teorik YTM | %54,33806412 |

İşlemiş tutar, projeksiyonlu `%10,68114765` tam dönem kuponunun 75/91 ile
çarpımı değildir. BAP 4.4 ayrıştırması:

```text
gerçekleşmiş TLREFK getirisi = 3951,11584 / 3641,86408 - 1
birikmiş spread = 0,0115 × 75 / 365
işlemiş kira = (gerçekleşmiş getiri + birikmiş spread) × 100
             = 8,72788022
```

Kaynak parse durumu `AMBIGUOUS` kalabilir; bu etiket gizlenmez. Ancak spread
`KAP_MULTI_COUPON_VERIFIED` kanıtıyla hesapta kullanılır. Spread
doğrulanamazsa `%0` senaryosu üretilmez ve değerleme durur.

## Takvim çıkarımı

Öncelik sırası:

1. Kullanıcı veya doğrulanmış kaynak tarafından verilen açık tarihler.
2. Tek ödemeli/iskontolu kıymetlerde vade tarihi.
3. İhraç, vade, kupon sıklığı ve sonraki kupon tarihinden üretilen sabit-gün
   adayı.
4. Aynı alanlardan üretilen takvim-ayı adayı.
5. Sonraki kupon yoksa vadeden geriye takvim-ayı çıkarımı.

Sabit-gün ve takvim-ayı adayları beklenen ödeme adedi, ilk dönem hizası,
sonraki kuponun aday içinde bulunması ve vade sonu ile puanlanır. Seçilen
yöntem API sonucunda `schedule_method`, `schedule_confidence` ve
`schedule_assumptions` alanlarıyla yayımlanır.

TRFTURK42710 için seçilen sabit-gün takvimi KAP ile aynıdır:

```text
17.07.2026 → 16.10.2026 → 15.01.2027 → 16.04.2027
```

TRSVESTK2610 için son normal tarihten sonra ayrı bir sentetik kupon eklenmez;
vade final stub olarak kullanılır:

```text
27.01.2026 → 28.04.2026 → 28.07.2026 → 05.11.2026
```

## BIST fiyat bazı

- `Kirli Fiyat/Dirty Price` satırlarında otomatik 100 değeri **kirli fiyat**tır.
- Diğer satırlarda otomatik 100 değeri **temiz fiyat**tır.
- Otomatik 100 bir hesap sonucu veya piyasa kotasyonu değil, değerleme
  girdisidir. API bunu `quote_source`, `clean_price_origin` ve
  `dirty_price_origin` alanlarıyla açıkça ayırır.
- Sonuç her zaman `THEORETICAL_YTM` olarak etiketlenir.

## T-1 gözlem sözleşmesi

- Doğrulanmış endeks değişimi kıymetlerinde başlangıç, bitiş ve cari valör
  gözlemleri aynı sözleşmesel gecikme ile seçilir.
- `m=1` için cari gözlem valörün bir önceki BIST iş günüdür. T günü verisinin
  gün içinde sonradan yüklenmesi aynı valörlü sonucu değiştirmez.
- Hedef tarihte gözlem yoksa daha eski bir kayıt sessizce kullanılmaz;
  `MISSING_BENCHMARK` üretilir.
- KAP spread türetimi T/T-1/T-2 arasında yuvarlama yakınlığı seçmez. Mevcut
  doğruluk evreninde yalnız T-1 ile türetir; açıkça farklı `m` yayımlanan
  gelecekteki kıymetler sözleşmesel parametre olarak ayrıştırılır.

## Değişken kupon senaryosu

Cari kupon yayımlanmış veya dönem endekslerinden hesaplanmışsa ilk gelecek
ödeme bu oranı kullanır. Daha sonraki ödemelerde aynı dönemsel tutar
kopyalanmaz. Cari yıllık basit senaryo oranı her ödeme döneminin kendi gerçek
gün kesriyle yeniden dönemsele çevrilir.

VDMK gibi kuponu tahsilata bağlı kıymetlerde:

- ihraç yıllık getirisi mevcutsa düz kupon senaryosu olarak kullanılabilir;
- hiçbir oran yoksa sıfır kupon senaryosu üretilir;
- iki durum da API ve arayüzde varsayım olarak gösterilir.

## TÜFE ve eksik sözleşme senaryoları

- TÜFE referans endeks oranı verilmezse teorik değer `CPI ratio = 1` ile reel
  terimlerde hesaplanır.
- Kupon sıklığı ve sonraki kupon tarihi bulunmayan, iskontolu veya ayrıştırılmış
  olmayan kıymet tek ödeme senaryosuna düşer.
- Bu sonuçlar hesaplanır fakat kesin nominal değer veya resmî YTM etiketi
  taşımaz.

## Sekiz menkullük regresyon matrisi

`apps/api/tests/test_bist_accuracy_matrix.py` aşağıdaki kıymetler için oran türünü,
spreadi, fiyat bazını, takvim yöntemini ve 27.07.2026 sonrası ödeme tarihlerini
kilitler:

- `TRSVESTK2610`
- `TRSTISB72712`
- `TRFDEKO72613`
- `TRFBLKME2621`
- `TRFTURKE2617`
- `TRDGLVK92627`
- `TRSDVYS42714`
- `TRFDVYS42711`

`TRD` ile başlayan değişken katılım kıymetleri TLREF değil TLREFK olarak
sınıflandırılır.

`AMBIGUOUS` kaynak durumu teorik hesaplamayı tek başına durdurmaz. Sonuç,
`SOURCE_TERMS_AMBIGUOUS` varsayımı ve kaynak parse durumu ile birlikte
gösterilir. Birbirinden farklı mükerrer satırlar (`CONFLICTING`) ve reddedilmiş
terimler ise otomatik hesaplamaya kapalı kalır.

## Bilerek resmî sayılmayan sonuçlar

Gelecekteki değişken benchmark seviyeleri, gerçek piyasa fiyatı ve henüz
yayımlanmamış tahsilata bağlı kuponlar bugün kesin olarak bilinemez. Bondley bu
durumlarda hesaplamayı durdurmaz; teorik senaryoyu üretir ve varsayımı sonucun
ayrılmaz parçası olarak taşır. Matematiksel doğruluk ile geleceğe ilişkin
varsayım birbirine karıştırılmaz.
