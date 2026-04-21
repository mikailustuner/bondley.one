# Bondley — Matematiksel Formüller

Bu dokümanda projedeki tüm finansal hesaplamalarda kullanılan formüller toplanmıştır.
Tüm semboller ve birim yaklaşımları aşağıdaki tabloda verilmiştir.

## Semboller ve Birimler

| Sembol | Anlam | Birim |
|---|---|---|
| $F$ | Nominal (face value) | TL (varsayılan 100) |
| $c$ | Yıllık kupon oranı | Ondalık (0.05 = %5) |
| $k$ | Yıllık kupon frekansı | Tam sayı (örn. 2) |
| $C$ | Dönem başına kupon ödemesi | TL |
| $P_{clean}$ | Temiz fiyat | TL |
| $P_{dirty}$ | Kirli fiyat | TL |
| $AI$ | Birikmiş faiz | TL |
| $D_{period}$ | Kupon dönem gün sayısı | gün |
| $D_{passed}$ | Son kupondan geçen gün | gün |
| $y$ | Yıllık BEY (YTM) | Ondalık |
| $y_{TLREF}$ | TLREF yıllık basit faiz | Ondalık |
| $CF_i, t_i$ | $i$-inci nakit akışı ve süresi | TL, yıl |

### Veri Birim Notları
- **Bond root alanları** (`bond.next_coupon_rate`, `bond.spread`, `bond.last_issue_yield`, `bond.first_issue_yield`): BIST XLS'den geldikleri şekilde **yüzde** olarak saklanır (örn. `2.7958` = %2.7958). Frontend'de `formatPercent()` ile gösterilir.
- **BondCalculator / BondMetricsService çıktıları** (`calculated_metrics.*`): **ondalık** (0.05 = %5). Frontend'de `formatPercentFromDecimal()` ile gösterilir.
- **TLREF `daily_rate`**: ondalık günlük oran (örn. `0.00109...`).
- Hesaplama katmanı `bond.next_coupon_rate` gibi yüzde saklanmış değerleri `_coupon_rate_to_decimal()` veya `_spread_to_decimal()` ile ondalığa indirger (|v| > 1 ise 100'e böler).

---

## 1. Kupon Ödemesi

Dönem başına kupon:

$$C = \frac{F \cdot c}{k}$$

Örn. $F=100,\ c=0{,}27958,\ k=2 \Rightarrow C = 100 \cdot 0{,}27958 / 2 = 13{,}979$.

---

## 2. Birikmiş Faiz (Accrued Interest) — Act/Act

$$AI = C \cdot \frac{D_{passed}}{D_{period}}$$

- $D_{passed}$ = settlement − son kupon tarihi
- $D_{period}$ = sonraki kupon − son kupon tarihi

TLREF bazlı değişken kuponlu tahviller için birikmiş faiz, ilgili dönemin kupon tutarı
henüz bilinmediğinden dönemsel kupon oranı tahmini kullanılarak:

$$AI_{float} = F \cdot r_{periodic} \cdot \frac{D_{passed}}{D_{period}}$$

---

## 3. Kirli Fiyat (Dirty Price)

$$P_{dirty} = P_{clean} + AI$$

Takas/mutabakat fiyatı olarak da kullanılır.

---

## 4. Vadeye Kadar Getiri (Yield to Maturity — BEY)

Bisection ile DCF denkleminin çözümü:

$$P_{dirty} = \sum_{i=1}^{N} \frac{CF_i}{\left(1 + \dfrac{y}{k}\right)^{\,t_i}}$$

- $t_i = \dfrac{d_i}{D_{period}}$,  $d_i$ = settlement'dan $CF_i$ tarihine gün sayısı
- Bu kesirli $t_i$ kullanımı, dönem içi settlement'ta `numpy_financial.irr`'nin eşit-aralık varsayımındaki önyargıyı ortadan kaldırır.
- Son nakit akışı: $CF_N = C + F$ (son kupon + anapara).
- Arama aralığı: $y \in [-0{,}99,\ 10{,}00]$, 200 iterasyon.

**Not (Spread birim uyumu):** YTM burada **BEY** (bond equivalent yield, $2\times\text{periodic}$ gibi) döner; TLREF ise `daily_rate × 365` olarak **yıllık basit** bir orandır. İki metrik birebir aynı anlama gelmediğinden aralarındaki fark (spread) bir yaklaşım olup teorik olarak negatif çıkabilir (aşağıya bakınız).

---

## 5. Spread

### 5.1 Sözleşmesel Spread — `bond.spread`

Tahvilin ihracında sabitlenen TLREF üstü ek getiri. Daima $\ge 0$ (BIST tbliste'den pozitif gelir):

$$\text{spread}_{contract} = \text{bond.spread}$$

Kullanıldığı yerler (TLREF'li tahvilin dönemsel kupon oranı hesabı):

$$c_{annual} = c_{ref,\,annual} + \text{spread}_{contract}$$

### 5.2 Piyasa İma Spread'i — `calculated_metrics.spread`

$$\text{spread}_{implied} = y_{BEY} - y_{TLREF}$$

- Birim: ondalık (0.01 = %1 = 100 bp). Baz puan için $\times 10000$.
- BEY ve basit yıllık ayrı annualizasyon kuralları kullandığından teorik olarak negatif olabilir.
- Negatif sonuç, tahvilin piyasada TLREF'in altında bir getiri ile fiyatlandığını (veya kupon kestirimiyle TLREF seviyesinin farkı uyuşmadığını) ima eder.

---

## 6. TLREF Türev Formülleri (Değişken Kuponlu Tahviller İçin)

Dönem başı ve sonu TLREFK endeks değerlerinden:

$$r_{ref,\,annual} = \left(\frac{I_{end}}{I_{start}} - 1\right) \cdot \frac{365}{D_{period}}$$

$$c_{annual} = r_{ref,\,annual} + \text{spread}_{contract}$$

$$r_{periodic} = c_{annual} \cdot \frac{D_{period}}{365}$$

`daily_rate` CSV'den yüzdeden okunur:

$$\text{daily\_rate} = \frac{\text{oran}_{\%}}{100 \cdot 365}$$

veya endeks tabanlı fallback:

$$\text{daily\_rate}_D = \frac{I_D - I_{D-1}}{I_{D-1}}$$

---

## 7. Macaulay Durasyon

$$D_{mac} = \frac{\sum_i \tau_i \cdot \text{PV}(CF_i)}{P_{dirty}}$$

- $\tau_i = \dfrac{d_i}{365}$ (yıl cinsinden süre)
- $\text{PV}(CF_i) = \dfrac{CF_i}{\left(1 + y/k\right)^{\,t_i}}$, $t_i = d_i / D_{period}$

---

## 8. Modifiye Durasyon

$$D_{mod} = \frac{D_{mac}}{1 + y/k}$$

Fiyat hassasiyeti yaklaşımı:

$$\frac{\Delta P}{P} \approx -D_{mod} \cdot \Delta y$$

---

## 9. Konveksite

$$\text{Conv} = \frac{1}{P_{dirty}} \sum_{t=1}^{N} \frac{t(t+1)\cdot \text{PV}(CF_t)}{(1+y/k)^{2}}$$

Daha tam fiyat değişimi yaklaşımı:

$$\frac{\Delta P}{P} \approx -D_{mod} \cdot \Delta y + \tfrac{1}{2} \cdot \text{Conv} \cdot (\Delta y)^2$$

---

## 10. TLREF Şok Senaryosu

Kullanıcının seçtiği $\Delta y = \text{shock\_bp} / 10000$ için lineer yaklaşım:

$$P_{new} \approx P_{dirty} \cdot \left(1 - D_{mod} \cdot \Delta y\right)$$

$$y_{new} \approx y + \Delta y$$

$$\frac{\Delta P}{P} = -D_{mod} \cdot \Delta y$$

---

## 11. İhraçtan Settlement'e Toplam Getiri

$$R = \frac{\sum C_{received} + (P_{clean} - P_{start})}{P_{start}}$$

- $P_{start}$ = `bond.last_issue_price` (veya 100 fallback)
- $\sum C_{received}$ = ihraçtan settlement'e kadar ödenmiş kupon sayısı $\times$ dönem başına kupon

---

## 12. Günlük Oran Değişimi

$$\Delta P_{\%,\,daily} = \frac{P_{clean,\,D} - P_{clean,\,D-1}}{P_{clean,\,D-1}} \cdot 100$$

---

## 13. Kupon Ödemesine Kalan Gün

$$D_{next\_coupon} = D_{next\_coupon\_date} - D_{settlement}$$

- Negatifse "Geçmiş" gösterilir.
- Sıfırsa "Bugün".
- Frontend'de `selectedDate` (kullanıcının seçtiği hesaplama tarihi) baz alınır.

---

## 14. Kupon Frekansı Ayrıştırma

`coupon_frequency` metninden $(D_{period},\ k)$:

| Metin deseni | $D_{period}$ | $k$ |
|---|---|---|
| "6 ayda", "yarı yıl" | 182 | 2 |
| "yıllık", "yılda 1" | 365 | 1 |
| "3 ayda", "quarter" | 91 | 4 |
| "ayda bir", "aylık" | 30 | 12 |
| Diğer (varsayılan) | 182 | 2 |

---

## 15. Kupon Oranının Ondalığa Normalizasyonu

```
_coupon_rate_to_decimal(r):
    if |r| > 1: return r / 100        # yüzde olarak saklanmış
    else:       return r               # zaten ondalık
```

Aynı kural `_spread_to_decimal` için de uygulanır — `bond.spread` genelde yüzde
olarak saklandığından, `annual_coupon_rate` içinde TLREF referansına eklemeden önce
ondalığa indirgenir.

---