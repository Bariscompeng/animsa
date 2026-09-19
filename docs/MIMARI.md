# Mimari

Anımsa tek kullanıcılı, sunucusuz bir iOS uygulamasıdır. Tüm veri telefonda
SQLite'ta durur; ağ yalnızca iki isteğe bağlı özellik için kullanılır
(OpenStreetMap yer keşfi ve Open Food Facts barkod araması).

---

## Katmanlar

```
src/app/         Ekranlar (Expo Router)
      ↓
src/services/    Yan etkili adaptörler: bildirim, alarm, konum, senkron, yedek…
      ↓
src/db/          Şema, istemci, repository'ler
      ↓
src/domain/      Saf TypeScript — React ve Expo import etmez
```

Bağımlılık yönü tek taraflıdır: `app → services → db → domain`.
`src/domain/` hiçbir şeye bağlı değildir ve bu yüzden tamamı jest ile test
edilir (371 testin neredeyse tamamı buradadır).

### `src/domain/` — saf çekirdek

| Dosya | Sorumluluk |
|---|---|
| `recurrence.ts` | Tekrar kurallarını somut oluşumlara açar; AlarmKit'in haftalık tekrarına eşlenip eşlenemeyeceğini söyler |
| `planner.ts` | Durumdan **istenen** tüm bildirim ve alarmları üretir; deterministik anahtar ve içerik hash'i verir |
| `nlp/parseTaskInput.ts` | Türkçe doğal dil → tarih, saat, tekrar, hatırlatma tipi |
| `nlp/parseItemInput.ts` | "2 kg domates" → miktar, birim, ad |
| `regions.ts` | 20 bölge sınırı içinde hangi yerlerin izleneceğini seçer, rotasyon bölgesini kurar |
| `predictor.ts` | Alım aralıklarının medyanından "bitmek üzere" tahmini |
| `quietHours.ts` | Sessiz saat penceresi ve kaydırma |
| `provision.ts` | `embedded.mobileprovision` içinden imza bitiş tarihi |
| `backupSchema.ts` | Yedek biçimi ve doğrulaması |
| `normalize.ts` | Türkçe normalize (`İLAÇ` ≡ `ilac`) |
| `format.ts` | Yerel tarih/saat yardımcıları ve `tr-TR` metin biçimleme |

### `src/services/` — dış dünya

Her servis tek bir dış sistemi sarar ve o sistem yokken **zarifçe** davranır:

- `alarms.ts` — AlarmKit yoksa veya izin verilmemişse aynı API ile bildirim
  kurar ve `event_log`'a "alarm→bildirim düşüşü" yazar.
- `location.ts` — "Her Zaman" izni yoksa bölge izlemeyi hiç başlatmaz.
- `osm.ts` — ağ yoksa önbellekle çalışır, günde en fazla 30 istek yapar.
- `openFoodFacts.ts` — başarısızlıkta `null` döner, asla fırlatmaz.
- `signature.ts` — profil dosyası yoksa "Bilinmiyor" der, çökmez.

---

## Hatırlatma senkronu — en kritik parça

`src/services/sync.ts` **deklaratif ve idempotent**tir. İki kez üst üste
çalıştırıldığında ikincisinde hiçbir şey kurmaz.

```
1. desired = planner.build(state, now)
      her kayıt: deterministik key + fireAt + contentHash

2. actual  = iOS'un bekleyen bildirimleri
           + AlarmKit'in kurulu alarmları
           (+ scheduled_refs tablosu — yalnızca önbellek)

3. fark:
      istenen ama kurulu değil        → kur
      kurulu ama istenmiyor           → iptal et
      kurulu ama contentHash değişti  → iptal et, yeniden kur
```

**Sistem her zaman doğruluk kaynağıdır.** `scheduled_refs` tablosu sistemle
çeliştiğinde kaybeder. Bu, uygulamanın kendini toparlayabilmesini sağlar:
tablo bozulsa, iOS bildirimleri düşürse veya yedek geri yüklense bile bir
sonraki senkron doğru duruma döner.

### Anahtar biçimleri

```
task:{taskId}:{occurrenceKey}:main     görevin kendisi
task:{taskId}:{occurrenceKey}:lead     önceden hatırlatma
task:{taskId}:weekly                   haftalık tekrarlayan alarm (tek kayıt)
list:{ruleId}:{occurrenceKey}          zamanlı liste hatırlatması
expiry:{itemId}:{2|1}                  son kullanma uyarısı
summary:{YYYY-MM-DD}                   günlük özet
preview:{YYYY-MM-DD}                   akşam önizlemesi
signature:{48|24}h                     imza uyarısı (bildirim)
signature:12h                          imza uyarısı (alarm)
```

Alarm UUID'si = `uuidv5(key, NAMESPACE)` — aynı anahtar her zaman aynı UUID.

### Tetikleyiciler

- Uygulama öne geldiğinde (`AppState → active`)
- Her veri değişikliğinden sonra (`scheduleSync()`, 1 sn debounce)
- Bildirim eylemi işlendiğinde
- Konum olayı işlendiğinde
- `expo-background-task` çalıştığında (en az 60 dk arayla, garanti değil)
- İmza tarihi değiştiğinde

Aynı anda tek senkron çalışır (promise mutex). Çalışırken gelen ikinci istek
yeni bir tur kuyruklar, böylece sonuç her zaman en güncel veriyi yansıtır.

### Bütçe

iOS aynı anda en fazla 64 bekleyen bildirim tutar. Planlayıcı **60**'ta keser.
Öncelik: `fireAt` yakınlığı; eşitlikte görev > imza > liste kuralı > SKT >
özet. Sığmayanlar bir sonraki senkronda kurulur.

---

## Konum ve arka plan

```
index.ts
  └─ import './src/background/tasks'   ← router'dan ÖNCE
  └─ import 'expo-router/entry'
```

`TaskManager.defineTask` çağrıları modül düzeyindedir ve giriş noktasında
router'dan önce import edilir. iOS uygulamayı hiç arayüz açmadan doğrudan bir
bölge olayına uyandırabilir; görev o anda tanımlı olmalıdır.

### Bölge seçimi (20 sınırı)

19 gerçek yer + 1 **rotasyon bölgesi**. Öncelik sırası:

1. Ev ve İş — her zaman
2. Aktif konum tetikleyicili görevlerin yerleri
3. Listede eşleşen kategoride ürün olan yer tipleri
4. Aynı öncelikte en yakınlar

Liste boşken market bölgesi hiç izlenmez.

**Rotasyon bölgesi** mevcut konum merkezlidir; yarıçapı seçilen en uzak yerin
yarısı, `[800 m, 3000 m]` aralığına sıkıştırılmış. Bu bölgeden **çıkmak**,
aday kümesinin bayatladığı anlamına gelir → konum alınır, yeniden seçim yapılır.

### Arka plan olay işleyicisi

iOS bölge olayına yalnızca birkaç saniye tanır. `geofenceHandler.ts` hedefi
**5 saniyenin altı**dır:

```
veritabanını aç → olayı logla → karar (kurallar, bekleme süreleri, sessiz saat)
→ gerekirse anında bildirim (trigger: null) → gerekirse rotasyon → hafif senkron
```

Ağ isteği arka planda yalnızca önbellek boşsa ve 3 sn zaman aşımıyla yapılır.

### Spam önleme

| Kural | Süre |
|---|---|
| Aynı yer için | 3 saatte 1 |
| Tüm konum bildirimleri arası | 20 dk (Ayarlar'dan değiştirilebilir) |
| Aynı marka farklı şube | 1 saatte 1 |
| Sessiz saatlerde | hiç |
| Evden çıkış | bu sınırların dışında (günde bir kez olur, kaçırılmamalı) |

---

## Veri modeli

`src/db/schema.ts` — 13 tablo. Öne çıkan tasarım kararları:

- **Katalog ile liste ayrıdır.** Ürün `items` tablosunda kalıcıdır; `on_list`
  bayrağı açılıp kapanır. Böylece alım geçmişi (`purchase_events`) birikir ve
  tüketim tahmini mümkün olur.
- **Oluşum durumları ayrı tabloda.** `task_occurrence_states` yalnızca
  tamamlanan/atlanan/ertelenen oluşumları tutar; tekrarlayan bir görevin
  gelecekteki oluşumları satır üretmez.
- **Zaman gösterimi.** Anlık zamanlar epoch ms (`integer`); takvim tarihleri
  `YYYY-MM-DD` ve saatler `HH:mm` metin. Saat dilimi değişince "her sabah 08:00"
  hâlâ 08:00 kalır.
- `event_log` son 500 kaydı tutar, her yazımda budanır.
- `scheduled_refs` ve `event_log` yedeğe **dahil edilmez** (türetilmiş durum).

---

## Arayüz

- Expo Router, dosya tabanlı yönlendirme (`src/app/`).
- Düzenleme ekranları `formSheet` sunumu, detent'lerle.
- Renkler `src/theme/tokens.ts`'de açık/koyu çiftler; `useTheme()` sistem
  görünümünü izler.
- İkonlar SF Symbols (`expo-symbols`); `@expo/vector-icons` kullanılmaz.
- Dynamic Type için sabit yükseklik yok; minimum dokunma alanı 44 pt; ikon
  butonlarının tamamında Türkçe `accessibilityLabel`.

---

## CI/CD

```
check.yml   (ubuntu)  tsc → eslint → jest → expo-doctor → yapılandırma kontrolü
ios.yml     (macOS)   check → prebuild → imzasız IPA → release → source.json
```

`scripts/check-config.mjs`, `npx expo config --type introspect` çıktısında
`NSMicrophoneUsageDescription` ve `aps-environment` olmadığını,
`NSAlarmKitUsageDescription` olduğunu ve minimum iOS'un 26.0 olduğunu doğrular.

IPA **imzasız** üretilir; imzayı telefonda AltStore atar. `build-ios.sh`
sonunda `embedded.mobileprovision` dosyasının bulunmadığını kontrol eder.

`publish-release.mjs` sabit `altstore-source` etiketindeki `source.json`'u
indirir, yeni sürümü ilgili uygulama girdisinin başına ekler (son 5 tutulur) ve
geri yükler. Birleştirme mantığı `scripts/altstoreSource.mjs`'de saf ve testli.
