# ANIMSA — Kişisel iOS Gün & Ev Asistanı
## Yapay Zekâ Kodlama Ajanı İçin Eksiksiz Uygulama Spesifikasyonu

> **Kullanım:** Bu dosyayı boş bir klasöre `SPEC.md` adıyla koy, klasörde kodlama ajanını (ör. Claude Code) başlat ve şunu yaz:
> **"SPEC.md dosyasını baştan sona oku ve eksiksiz uygula. Aşamaları sırayla tamamla, her aşamada CI yeşil olmadan ilerleme."**

---

## Yapılandırma (tek yerden değiştir)

| Anahtar | Değer |
|---|---|
| Görünen ad | `Anımsa` (dev: `Anımsa Dev`) |
| Teknik ad (ASCII, Xcode proje adı) | `Animsa` |
| Bundle ID (release) | `com.bariscoskun.animsa` |
| Bundle ID (dev) | `com.bariscoskun.animsa.dev` |
| URL şeması | `animsa` (dev: `animsa-dev`) |
| Geliştirici adı | `Barış Coşkun` |
| GitHub repo adı | `animsa` (kullanıcı adı `gh api user -q .login` ile bulunur) |
| Minimum iOS | `26.0` |
| Vurgu rengi | `#FF7A1A` |

Bundle ID'ler bir kez belirlendikten sonra **asla değiştirilmez** (ücretsiz Apple ID haftalık App ID limiti, bkz. §1.2).

---

## 0. Ajan için çalışma kuralları

1. **Bu dosya tek doğruluk kaynağıdır.** Belirsizlikte en basit ve en güvenilir çözümü seç, gerekçesiyle `docs/KARARLAR.md`'ye yaz, devam et. Kullanıcıya yalnızca §12'deki insan adımları veya çözülemeyen bir engel için soru sor.
2. **Mac yok.** Geliştirme makinesi Windows veya Ubuntu'dur. Yerelde asla Xcode, `pod install`, `npx expo run:ios`, iOS simülatörü kullanmaya çalışma. Tüm iOS derlemeleri GitHub Actions macOS runner'ında yapılır (§9).
3. **Sürüm politikası.** Başlamadan `npm view expo version` ile en son **stabil** Expo SDK'yı bul (bu dosya yazılırken SDK 57 stabil, SDK 58 beta idi). Beta/RC kullanma. Tüm Expo ve React Native paketlerini `npx expo install <paket>` ile kur. Kütüphane API'lerini ezberden yazma: kurulu sürümün `node_modules/<paket>` tip tanımlarından ve resmi dokümanından doğrula (özellikle expo-notifications trigger tipleri, expo-file-system yeni API'si, expo-location geofencing, Expo Router sekmeleri).
4. **Dil.** Kod, tanımlayıcılar, commit mesajları İngilizce. Kullanıcıya görünen tüm metinler Türkçe, `tr-TR` biçimlendirmeyle.
5. **Kalite kapısı (her aşamanın sonunda):** `npx tsc --noEmit`, `npx eslint .`, `npx jest` yeşil → commit → push → `gh run watch` ile iOS derlemesini izle → kırmızıysa `gh run view --log-failed` ile log'u oku, düzelt, tekrar push. **Yeşil olmadan sonraki aşamaya geçme.**
6. **Native kod minimal.** Swift yerelde derlenemez; tek native modül AlarmKit'tir (§6). Swift derleme hatalarını CI log'undan düzelt.
7. **Güvenlik.** Repoya gizli anahtar, token veya kişisel veri girmez. Repo **public** olacak (gerekçe §9.1).
8. **Satır sonları.** İlk commit'te `.gitattributes` içine `* text=auto eol=lf` ekle (Windows'ta yazılan `.sh` dosyaları macOS runner'da bozulmasın). Yerel yardımcı betikler Node ile yazılır (çapraz platform); yalnızca CI'da çalışan betikler bash olabilir.
9. **Teslim:** Sonunda `README.md`, `docs/KURULUM.md` (kullanıcı için adım adım Türkçe kurulum, §12), `docs/MIMARI.md`, `docs/KARARLAR.md`, `docs/TEST_LISTESI.md` hazır olmalı.
10. Repo oluşturma: `gh repo create animsa --public --source . --remote origin --push`.

---

## 1. Proje özeti ve kısıtlar

### 1.1 Amaç
Tek kullanıcılı, tek iPhone'a kurulacak, App Store'a çıkmayacak, **tamamen cihaz üzerinde çalışan (sunucusuz)** bir uygulama:
- Gün içi görevleri hatırlatır: bildirim **veya gerçek alarm** (sessiz modu aşan, AlarmKit).
- Evin ihtiyaç listesini tutar; belirli zamanlarda ve **konuma göre** (markete yaklaşınca) hatırlatır.
- Tüketim alışkanlığından "bitmek üzere" tahmini yapar, son kullanma tarihlerini izler.
- Kendi imza süresini izleyip süresi dolmadan kullanıcıyı uyarır.

### 1.2 Kurulum ve imza modeli (kritik)
- **Ücretli Apple Developer hesabı yok.** Ücretsiz Apple ID ile imzalanır; imza **7 gün** geçerlidir. Bu Apple kuralıdır, kaldırılamaz.
- Yenileme **AltStore Classic** ile otomatiktir: AltServer'ın çalıştığı bilgisayarla aynı Wi-Fi'dayken arka planda yenilenir (AltStore 2.3+ "Remote AltServer" ile bilgisayarsız da mümkün). Uygulama ayrıca kendi imza bitişini okuyup uyarır (§3.10).
- Ücretsiz hesap limitleri:
  - Aynı anda en fazla **3 aktif** sideload uygulama → AltStore + Anımsa + Anımsa Dev = 3.
  - 7 günde en fazla **10 yeni App ID** → bundle ID değiştirme, **uygulama uzantısı ekleme** (widget, bildirim uzantısı vb. her biri ayrı App ID ve imza sorunu demektir). Uzantı yalnızca opsiyonel §11 Aşama 8'de.
- **Uygulama hiçbir özel entitlement gerektirmeyecek.** Push, iCloud/CloudKit, App Groups, Time Sensitive, Critical Alerts kullanılmaz. Tüm hatırlatmalar: lokal bildirim + AlarmKit + bölge izleme (hepsi yalnızca Info.plist anahtarı ister).
- IPA, CI'da **imzasız** üretilir; imzayı telefonda AltStore atar.
- **Veri güvenliği:** AltStore ile yenileme/güncelleme veriyi silmez (bundle ID aynı kaldıkça). Uygulamayı silmek veriyi siler → yedekleme özelliği zorunlu (§3.11).

---

## 2. Teknoloji yığını

| Katman | Seçim | Not |
|---|---|---|
| Çatı | Expo (en son stabil SDK), React Native New Architecture, TypeScript `strict` | `npm` kullan |
| Navigasyon | Expo Router (`src/app`) | Sekmeler: SDK'da stabilse native tabs (iOS 26 Liquid Glass görünümü), değilse standart `Tabs`. Karar `KARARLAR.md`'ye |
| Veri | `expo-sqlite` + `drizzle-orm` + `drizzle-kit` | Migration: `drizzle-kit generate` (driver `expo`), uygulamada `useMigrations`. `.sql` dosyaları için `babel-plugin-inline-import` ve `metro.config.js`'de `sourceExts.push('sql')`. Reaktif okuma: `useLiveQuery` |
| Geçici UI durumu | `zustand` | Kalıcı her şey SQLite'ta |
| Bildirim | `expo-notifications` | Yalnızca lokal |
| Konum | `expo-location` (geofencing) + `expo-task-manager` | |
| Arka plan | `expo-background-task` | Periyodik senkron; zamanlama iOS'a bağlı, garanti değil |
| Alarm | Yerel Expo modülü `modules/alarm-kit` (Swift, AlarmKit) | §6 |
| Harita | `expo-maps` (Apple Maps; marker, daire, uzun basma destekliyorsa) yoksa `react-native-maps` | API anahtarı gerekmez |
| Market keşfi | OpenStreetMap Overpass API | Ücretsiz, anahtar yok |
| Barkod | `expo-camera` (`CameraView` barkod tarama) + Open Food Facts API | |
| İkonlar | `expo-symbols` (SF Symbols) | `@expo/vector-icons` kullanma |
| Tarih | `date-fns` + `tr` locale | |
| Kimlik | `expo-crypto` (`randomUUID`), `uuid` (v5, deterministik alarm ID'leri) | |
| Diğer | `expo-haptics`, `@react-native-community/datetimepicker`, `expo-file-system`, `expo-sharing`, `expo-document-picker`, `expo-linking`, `expo-build-properties`, `expo-dev-client` | |
| Test | `jest` + `jest-expo` | Domain katmanı saf TS, yüksek kapsam |
| Lint | ESLint (flat config, `eslint-config-expo`) + Prettier | |

---

## 3. Özellikler (spesifikasyon + kabul kriterleri)

### 3.1 Görevler — "Bugün" sekmesi
**Alanlar:** başlık (zorunlu), not, tarih (opsiyonel), saat (opsiyonel; saatsiz = "Gün içinde"), tekrar kuralı (§3.2), hatırlatma tipi `Yok | Bildirim | Alarm`, önceden hatırlat (0, 5, 15, 30, 60 dk, 1 gün), önemli bayrağı, konum tetikleyici (opsiyonel: bir yere varınca/çıkınca, §3.6), "evden çıkarken" / "eve gelince" bayrakları.

**Ekran:**
- Büyük başlık "Bugün", alt başlık tarih ("18 Eylül Cuma").
- Üstte (koşullu) imza uyarı bandı (§3.10) ve "Bitmek üzere" öneri kartı (§3.8).
- Bölümler: **Gecikmiş** (kırmızı vurgu) · **Bugün** (saate göre; saatsizler en altta "Gün içinde") · **Yarın** · **Bu hafta** (katlanabilir). Tamamlananlar varsayılan gizli, "Tamamlananları göster" anahtarı.
- Satırda: tamamlama dairesi, başlık, saat, tekrar ikonu (`repeat`), alarm ikonu (`alarm`), konum ikonu (`location`).
- Kaydırma: sağa = tamamla (haptik `success`); sola = **Ertele** menüsü (15 dk · 1 saat · Bu akşam 20:00 · Yarın 09:00 · Tarih seç) ve **Sil** (onaylı).
- Tekrarlayan görev tamamlanınca yalnızca o oluşum tamamlanır; sonraki oluşum otomatik görünür.

**Hızlı ekleme:** Ekranın altında klavyeyle birlikte yükselen sabit giriş satırı. Türkçe doğal dil ayrıştırıcı (§5.8) canlı çalışır; ayrıştırılan parçalar giriş satırının üstünde çipler olarak görünür: `📅 Yarın` `⏰ 09:00` `🔁 Her gün` `🔔 Alarm`. Çipe dokununca ilgili seçici açılır, düzeltilebilir. Enter = kaydet. `+` butonu tam formu (form sheet) açar.

**Kabul kriterleri:**
- Saatli + bildirimli görev, uygulama kapalıyken zamanında bildirim verir.
- Alarmlı görev, telefon sessizde ve kilitliyken tam ekran alarm çalar.
- 50+ görevle liste akıcıdır.

### 3.2 Tekrar kuralları
Desteklenen: yok · her gün · hafta içi · hafta sonu · haftanın seçili günleri · her N günde bir · her N haftada bir (seçili günlerle) · her ayın X. günü (31 → o ayın son günü) · her ayın son günü · her yıl (gün+ay; 29 Şubat → artık olmayan yılda 28 Şubat). Bitiş: hiç · tarih · N kez.
Temsil: JSON (`RecurrenceRule` TS tipi), saf fonksiyonlar §5.2.

### 3.3 Hatırlatma tipleri
- **Bildirim:** lokal bildirim, ses açık. Kategori eylemleri §5.4.
- **Alarm:** AlarmKit; sessiz modu ve Odak'ı aşar, kilit ekranında tam ekran, "Durdur" butonu.
  - Haftalık ifade edilebilen tekrarlar (her gün, hafta içi, hafta sonu, seçili günler) **tek bir tekrarlayan alarm** olarak kurulur.
  - İfade edilemeyenler (aylık, N günde bir, yıllık) sonraki oluşumlar için tek tek sabit alarm olarak, 14 günlük pencerede kurulur (§5.3).
  - Önceden hatırlatma varsa: önceden hatırlatma **bildirim**, asıl zaman **alarm** olur.
- Alarm izni yoksa veya AlarmKit kullanılamıyorsa: otomatik bildirime düşer; kullanıcıya bir kez açıklama gösterilir; tanılama ekranında görünür.

### 3.4 Ev İhtiyaçları — "Liste" sekmesi
**Kavram:** Ürün **kataloğu** (evin bilinen ürünleri) ile **Alınacaklar** listesi ayrıdır. Ürün katalogdadır; `on_list` bayrağı açılıp kapanır. Böylece alım geçmişi ve tahmin tutulur.

**Üst segment:** `Alınacaklar | Tüm Ürünler | Dolap`

**Ürün alanları:** ad, kategori, miktar + birim (`adet, kg, g, lt, ml, paket`), not, barkod, son kullanma tarihi (opsiyonel).

**Varsayılan kategoriler (sıralanabilir, `place_type` eşlemeli):** Manav · Süt & Kahvaltılık · Et, Tavuk & Balık · Fırın · Temel Gıda · Atıştırmalık · İçecek · Dondurulmuş · Temizlik · Kişisel Bakım · Evcil Hayvan · Eczane (`pharmacy`) · Hırdavat (`hardware`) · Diğer. Market kategorilerinin `place_type`'ı `market`; Fırın'ınki `bakery` **ve** `market` (her ikisinde de hatırlatır).

**Alınacaklar görünümü:**
- Kategoriye göre gruplu; grup sırası = kullanıcının belirlediği reyon sırası (Ayarlar'da sürükle-bırak).
- Dokun = alındı (üstü çizili + haptik + 5 sn "Geri al" toast'u); 5 sn sonra listeden düşer ve `purchase_events` kaydı oluşur.
- "Tümünü alındı işaretle" ve "Listeyi paylaş" (düz metin, iOS paylaşım sayfası).

**Hızlı ekleme:**
- Katalogdan otomatik tamamlama; Türkçe duyarlı normalize (§5.11): "sut" → "Süt", "IŞIK" ≈ "ışık".
- "2 kg domates", "3 süt" gibi girişlerden miktar/birim ayrıştırılır.
- Yeni ürünün kategorisi anahtar kelime sözlüğüyle tahmin edilir (`src/data/categoryKeywords.ts`, **en az 300 yaygın Türkçe ürün**, ör. domates→Manav, deterjan→Temizlik, parol→Eczane). Kullanıcı düzeltirse o ürün için öğrenilir (katalogda saklanır).

**Barkodla ekle:** Kamera açılır (EAN-13, EAN-8, UPC-A/E). Barkod katalogda varsa o ürün listeye eklenir (haptik + toast). Yoksa Open Food Facts'ten ad çekilir (`https://world.openfoodfacts.org/api/v2/product/{barkod}.json?fields=product_name,product_name_tr,brands`, `User-Agent: Animsa/1.0 (kişisel kullanım)`, 5 sn zaman aşımı); kullanıcı onaylar/düzenler. İnternet yoksa manuel ad.

**Dolap görünümü:** SKT'si olan ürünler, en yakın SKT üstte; geçmiş olanlar kırmızı. SKT'den **2 gün** ve **1 gün önce 09:00**'da bildirim ("Yoğurdun SKT'si yarın").

**Tüm Ürünler:** Katalog; arama, düzenleme, silme, "Listeye ekle".

### 3.5 Zamanlı liste hatırlatmaları
- Kullanıcı kural tanımlar: "Cumartesi 10:00 market listesini hatırlat", "Hafta içi 18:30 liste".
- **Yalnızca listede ürün varsa** gösterilir: bildirim içeriği zamanlama anında hesaplanır; liste boşalınca ilgili bildirimler iptal, dolunca yeniden kurulur (senkron §5.3 bunu doğal olarak yapar).
- Metin: "🛒 Listende 7 ürün var: süt, ekmek, yumurta ve 4 ürün daha".

### 3.6 Konum hatırlatmaları — "Yerler" sekmesi
**Yer tipleri:** Ev · İş · Market · Eczane · Fırın · Hırdavat · Diğer. Yarıçap: market 150 m, eczane/fırın 120 m, ev/iş 200 m; minimum 100 m, maksimum 1000 m.

**Yer ekleme:** haritada uzun bas · mevcut konum · adres arama (`Location.geocodeAsync`) · "Yakındakileri bul" (OSM, §5.6).

**Otomatik market keşfi** (ayar, varsayılan **açık**): kullanıcının kaydetmediği marketler/eczaneler de OSM'den aday olur.

**Tetik kuralları:**
- **Markete GİRİŞ** + listede `market` kategorili ürün varsa → "📍 Migros'a yakınsın — listende 5 ürün var: süt, ekmek…". Eczane/fırın/hırdavat için yalnızca eşleşen kategoriler.
- **Ev ÇIKIŞ** → "Evden çıkarken" kontrol listesi (Ayarlar'da düzenlenir; ör. Anahtar, Cüzdan, Çöp) + o günün "evden çıkarken" işaretli görevleri, tek bildirimde.
- **Ev GİRİŞ** → "eve gelince" işaretli görevler.
- Görev konum tetikleyicisi: seçili yere giriş/çıkışta o görevin bildirimi.

**Spam önleme:** aynı yer için 3 saatte en fazla 1 bildirim; tüm konum bildirimleri arasında global 20 dk bekleme (ev çıkış hariç); sessiz saatlerde konum bildirimi yok; aynı gün aynı market zincirinin farklı şubeleri için 1 saatte en fazla 1.

**iOS limiti:** bir uygulama en fazla 20 bölge izler → dinamik rotasyon (§5.5).

**İzin:** "Her Zaman" değilse bölge izleme kurulmaz; Yerler ekranında açıklayıcı bant + "Ayarları aç".

**Kabul:** "Her Zaman" izniyle, uygulama arka plandayken veya sistem tarafından sonlandırılmışken bir markete girince (listede ürün varken) bildirim gelir.

### 3.7 Günlük özet
- Ayarlanabilir saat (varsayılan 08:00): "☀️ Bugün 4 görev (ilki 09:30 Diş hekimi) · Listede 6 ürün · Süt bitmek üzere olabilir".
- İçerik zamanlama anında hesaplanır; her senkronda sonraki 2 günün özeti yeniden hesaplanıp güncellenir.
- Akşam önizlemesi (opsiyonel, varsayılan kapalı, 21:00): "🌙 Yarın: 3 görev, ilki 08:00 …".

### 3.8 Tüketim tahmini — "Bitmek üzere"
- En az 3 alımı olan ürünlerde alım aralıklarının **medyanı** M (gün). Son alımdan bu yana geçen süre ≥ 0.85 × M ise ürün **öneri** olur (zaten listedeyse değil).
- Liste ve Bugün ekranında kart: "Bitmek üzere olabilir: Süt, Deterjan" — her birinde `Ekle` / `Yoksay`. Yoksay → bir sonraki alıma kadar gizli.
- Ayar: "Önerileri listeye otomatik ekle" (varsayılan kapalı).

### 3.9 Sessiz saatler
- Varsayılan 23:00–07:30.
- Kullanıcının **açıkça saat verdiği** görev bildirimleri ve **tüm alarmlar etkilenmez**.
- Otomatik üretilenler (özet, SKT, öneri, liste kuralları hariç — onlar da kullanıcı saatidir): zamanlılar sessiz saat bitimine kaydırılır; konum bildirimleri atlanır.

### 3.10 İmza Bekçisi
- Uygulama kendi `embedded.mobileprovision` dosyasından `ExpirationDate`'i okur (§5.9).
- Ayarlar'da: "İmza geçerliliği: 4 gün 6 saat kaldı (25 Eylül 14:32)".
- Bitişe **48 s** ve **24 s** kala bildirim, **12 s** kala alarm (izin varsa): "Anımsa'nın süresi dolmak üzere. AltStore'u açıp Yenile'ye bas."
- Bitişe < 48 saat kala Bugün ekranında turuncu bant; dokununca AltStore açılır (`altstore-classic://`, olmazsa `altstore://`; ikisi de açılamazsa talimat sayfası).
- Dosya yoksa (ör. geliştirme ortamı) "Bilinmiyor" gösterir, asla çökmez.
- AltStore yenilediğinde dosya değişir; uygulama öne her gelişte yeniden okur, tarih değiştiyse senkron yeni tarihe göre planlar.

### 3.11 Yedekleme
- **Manuel:** Ayarlar → "Yedekle" → tüm tablolar JSON (`{ app, schemaVersion, exportedAt, tables }`) → iOS paylaşım sayfası (Dosyalar'a kaydet).
- **Geri yükle:** JSON seç → doğrula → önizleme ("128 ürün, 42 görev, 9 yer") → onay → tek transaction'da değiştir → tüm hatırlatmalar yeniden kurulur.
- **Otomatik:** haftada bir `Documents/Yedekler/` içine anlık görüntü (son 4 tutulur). `UIFileSharingEnabled` + `LSSupportsOpeningDocumentsInPlace` ile Dosyalar uygulamasında "iPhone'umda › Anımsa" altında görünür. Uyarı metni: "Uygulamayı silersen bu klasör de silinir; önemli yedekleri iCloud Drive'a kopyala."

### 3.12 Siri ve Kısayollar (native kod gerektirmeden)
- Derin bağlantılar:
  - `animsa://ekle?urun=süt` → ürünü listeye ekler (miktar ayrıştırmalı)
  - `animsa://gorev?metin=yarın 9'da ilaç` → NLP ile görev oluşturur
  - `animsa://liste`, `animsa://bugun`
- İşlem yapılır, kısa onay toast'u gösterilir.
- `docs/KURULUM.md`'de Kısayollar uygulamasıyla "Listeye ekle" kısayolu tarifi: *Metin İste → URL (`animsa://ekle?urun=` + Metin) → URL'leri Aç*. Böylece "Hey Siri, listeye ekle".

### 3.13 Ayarlar
Bölümler: **İzinler** (bildirim, alarm, konum, kamera — her biri durum + "Ayarları aç") · **Hatırlatmalar** (sessiz saatler, günlük özet saati, akşam önizlemesi, varsayılan önceden hatırlatma) · **Konum** (otomatik market keşfi, konum bildirimi bekleme süresi, evden çıkarken listesi) · **Liste** (kategori sırası, önerileri otomatik ekle) · **İmza** (§3.10) · **Veri** (yedekle, geri yükle, otomatik yedek) · **Gelişmiş** (Tüm hatırlatmaları yeniden kur, Tanılama).

### 3.14 Tanılama ekranı (Mac olmadan hata ayıklamanın ana aracı)
- Bekleyen bildirim sayısı ve listesi (id, zaman, başlık), kurulu alarmlar, izlenen bölgeler (ad, yarıçap, mesafe), rotasyon bölgesi, son senkron zamanı ve özeti, imza bitişi, izin durumları.
- `event_log`'un son 200 kaydı (filtrelenebilir: senkron, konum, bildirim, hata).
- Test butonları: "5 sn sonra test bildirimi", "1 dk sonra test alarmı", "Seçili yere sahte GİRİŞ olayı" (konum mantığını yürümeden test etmek için), "Senkronu şimdi çalıştır", "Log'u paylaş".

### 3.15 İlk açılış (onboarding)
Tanıtım → bildirim izni → alarm izni → konum (önce "Kullanırken", sonra neden gerektiğini anlatan ekranla "Her Zaman" yükseltmesi) → ev konumunu ayarla (atlanabilir). Her adım atlanabilir; izinsiz özellikler zarifçe devre dışı kalır ve ilgili ekranda açıklanır.

---

## 4. Veri modeli (Drizzle / SQLite)

Genel: ID'ler `text` UUID. Anlık zamanlar `integer` epoch ms. Yerel takvim tarihleri `text` (`YYYY-MM-DD`), yerel saatler `text` (`HH:mm`). `created_at`, `updated_at` her tabloda.

```
tasks
  id, title, notes?, due_date?, due_time?, rrule_json?,
  reminder_type ('none'|'notification'|'alarm'), lead_minutes (int, 0),
  important (bool), location_trigger_json? ({placeId, on:'enter'|'exit'}),
  on_home_exit (bool), on_home_arrive (bool), archived_at?

task_occurrence_states          -- PK (task_id, occurrence_key)
  task_id, occurrence_key (orijinal oluşumun yerel ISO tarih-saati veya tarihi),
  status ('done'|'skipped'|'snoozed'), snoozed_until?, completed_at?

categories
  id, name, sort_order, place_types_json (ör. ["market","bakery"]), sf_symbol

items
  id, name, name_normalized, category_id, unit, default_qty,
  barcode? (unique), notes?, on_list (bool), list_qty?, list_added_at?,
  expiry_date?, suggestion_dismissed (bool), category_locked (bool)

purchase_events
  id, item_id, purchased_at, qty?

places
  id, name, type ('home'|'work'|'market'|'pharmacy'|'bakery'|'hardware'|'other'),
  lat, lng, radius_m, source ('user'|'osm'), osm_id?, brand?, enabled (bool),
  last_notified_at?

osm_cache                        -- keşif önbelleği
  cell_key (PK), fetched_at, payload_json

osm_hidden                       -- kullanıcının gizlediği OSM yerleri
  osm_id (PK)

list_reminder_rules
  id, rrule_json, time, enabled

home_exit_checklist
  id, text, sort_order, enabled

settings                         -- anahtar/değer
  key (PK), value_json

scheduled_refs                   -- senkronun kurduklarını bilmesi için
  key (PK), kind ('notification'|'alarm'), external_id, source_type, source_id?,
  fire_at?, content_hash

event_log                        -- son 500 kayıt tutulur (eskiler budanır)
  id, at, type, message, payload_json?
```

Seed: varsayılan kategoriler, varsayılan evden çıkarken listesi (Anahtar, Cüzdan, Telefon şarjı), varsayılan ayarlar.

---

## 5. Servisler ve algoritmalar

### 5.1 Katmanlama
- `src/domain/` — **saf TypeScript**; React/Expo import etmez; tamamı jest ile test edilir: tekrar motoru, NLP, planlayıcı, tahmin, bölge seçimi, sessiz saat, Türkçe normalize, metin biçimleme, imza ayrıştırma, yedek şeması doğrulama.
- `src/services/` — yan etkili adaptörler: bildirim, alarm, konum, OSM, Open Food Facts, senkron, imza, yedek, izinler, log.
- `src/db/` — şema, istemci, repository'ler.
- `src/app/` — Expo Router ekranları; `src/components/` — UI bileşenleri.
- Bağımlılık yönü: `app → services → domain`, `services → db`. Domain hiçbir şeye bağlı değildir.

### 5.2 Tekrar motoru
```ts
expandOccurrences(task: TaskLike, windowStart: Date, windowEnd: Date, states: OccurrenceState[]): Occurrence[]
nextOccurrence(rule: RecurrenceRule, after: Date): Date | null
toWeeklyAlarmSpec(rule, time): { weekdays: number[]; hour: number; minute: number } | null  // AlarmKit'e eşlenebilir mi?
```
Yerel saatle çalışır; ertelenen oluşum `snoozed_until`'a taşınır; `done/skipped` olanlar çıkarılır.

### 5.3 Hatırlatma senkronu (ReminderSync) — en kritik parça
**Deklaratif ve idempotent:**
1. `desired = planner.build(state, now)` → istenen tüm bildirim ve alarmlar; her birinin **deterministik `key`**'i (ör. `task:{id}:{occurrenceKey}:main`), `fireAt`, içeriği ve `contentHash`'i vardır.
   - Pencere: bildirimler 7 gün, sabit alarmlar 14 gün; haftalık tekrarlayan alarm tek kayıt.
   - **Bütçe:** iOS aynı anda en fazla 64 lokal bildirim tutar → en fazla **60** kur. Öncelik: `fireAt` yakınlığı; eşitlikte görev > imza > liste kuralı > SKT > özet. Sığmayanlar sonraki senkronlarda kurulur.
   - Sessiz saat kaydırmaları burada uygulanır.
2. `actual` = `Notifications.getAllScheduledNotificationsAsync()` + `AlarmKit.listIds()` (+ `scheduled_refs`). **Sistem gerçek kaynaktır**; tablo uyumsuzsa sistem kazanır.
3. Fark: istenip kurulu olmayanı kur; kurulu olup istenmeyeni veya `contentHash`'i değişeni iptal et/yeniden kur. Bildirim `identifier` = `key`. Alarm UUID'si = `uuidv5(key, NAMESPACE)`.
4. **Tetikleyiciler:** uygulama öne gelince; her veri değişikliğinden sonra (1 sn debounce); bildirim eylemi işlenince; konum olayı işlenince (arka planda, zaman sınırlı); `expo-background-task` çalışınca (minimum aralık 60 dk); saat dilimi değişince; imza tarihi değişince.
5. Aynı anda tek senkron (promise mutex). Her çalışma `event_log`'a özet yazar ("+3 kuruldu, −1 iptal, 57/60 bütçe").

### 5.4 Bildirim kategorileri ve eylemler
- `task`: **Tamamlandı**, **10 dk ertele**
- `list`: **Listeyi aç**
- `signature`: **AltStore'u aç**
- Eylemlerde `opensAppToForeground: true` (arka planda JS çalışması garanti değil). Yanıt: `addNotificationResponseReceivedListener` + soğuk açılışta `getLastNotificationResponseAsync`. Eylem işlendikten sonra senkron.
- Bildirim `data`: `{ kind, sourceId, occurrenceKey }`. Bildirime dokunma ilgili ekrana götürür.
- Uygulama öndeyken de banner + ses gösterilir (`setNotificationHandler`; kurulu sürümün alan adlarını doğrula).

### 5.5 Konum: bölge seçimi ve rotasyon
- **Adaylar:** etkin kullanıcı yerleri + OSM önbelleğinden keşfedilenler (gizlenenler hariç) + görev konum tetikleyicilerinin yerleri.
- **Limit 20** → en fazla 19 aday + 1 **rotasyon bölgesi**.
- `selectRegions(candidates, here, context)` önceliği:
  1. Ev ve İş (varsa) her zaman.
  2. Aktif konum tetikleyicili görevlerin yerleri.
  3. Listede eşleşen kategoride ürün olan yer tipleri (liste boşken marketler hiç izlenmez).
  4. Aynı öncelikte mesafeye göre en yakınlar.
- **Rotasyon bölgesi:** mevcut konum merkezli; yarıçap = seçilen en uzak adayın mesafesinin yarısı, `[800 m, 3000 m]` aralığına sıkıştırılır. Bu bölgeden **ÇIKIŞ** → konum al (`getLastKnownPositionAsync`, 5 dk'dan eskiyse `getCurrentPositionAsync` Balanced, 8 sn zaman aşımı) → yeniden seç → `startGeofencingAsync` ile bölgeleri güncelle.
- Liste içeriği veya yerler değişince de yeniden seçim yapılır (öndeyken).
- **Görev tanımları** (`TaskManager.defineTask`) `src/background/tasks.ts`'de modül en üst seviyesinde tanımlanır ve **giriş noktasında router'dan önce** import edilir (`index.ts` → `import './src/background/tasks'; import 'expo-router/entry';`, `package.json` `"main": "index.ts"`).
- **Arka plan olay işleyicisi** (iOS bölge olayında çok kısa süre tanır): toplam hedef **< 5 sn**. Sıra: `openDatabaseSync` → olayı log'la → karar (§3.6 kuralları, bekleme süreleri, sessiz saat) → gerekiyorsa anında bildirim (`trigger: null`) → gerekiyorsa rotasyon → hafif senkron. Ağ isteği (Overpass) arka planda yalnızca önbellek yoksa ve 3 sn zaman aşımıyla; aksi hâlde bir sonraki öne gelişe ertelenir.

### 5.6 OSM keşfi (Overpass)
- Uç nokta `https://overpass-api.de/api/interpreter` (POST, `data=` form alanı). Yedek uç nokta: `https://overpass.kumi.systems/api/interpreter`.
- Sorgu (merkez etrafında 2500 m):
```
[out:json][timeout:10];
(
  nwr(around:2500,{lat},{lng})["shop"~"^(supermarket|convenience|greengrocer)$"];
  nwr(around:2500,{lat},{lng})["amenity"="pharmacy"];
  nwr(around:2500,{lat},{lng})["shop"="bakery"];
  nwr(around:2500,{lat},{lng})["shop"~"^(hardware|doityourself)$"];
);
out center 250;
```
- Tip eşlemesi: supermarket/convenience/greengrocer → `market`; pharmacy → `pharmacy`; bakery → `bakery`; hardware/doityourself → `hardware`. Ad: `name` → `brand` → tip adı.
- Önbellek: ~1.2 km ızgara hücresi (geohash 6 karakter) başına 7 gün. Günlük istek tavanı 30; 429/504'te üstel geri çekilme; `User-Agent: Animsa/1.0`.
- Yerler ekranında "Yakındakiler" bölümü: OSM yerleri gri, "Kaydet" (kullanıcı yerine dönüşür) ve "Gizle" eylemleri.

### 5.7 Tüketim tahmini
`predict(purchases: Date[], now: Date): { medianDays: number; dueRatio: number; isDue: boolean } | null` — en az 3 alım yoksa `null`; aynı gün içindeki çoklu alımlar tek sayılır; aykırı aralıklar (> 4×medyan) hesaba katılmaz.

### 5.8 Türkçe doğal dil ayrıştırıcı
`parseTaskInput(text: string, now: Date): { title: string; date?: string; time?: string; rule?: RecurrenceRule; reminderType?: 'notification'|'alarm'; spans: Span[] }`

Desteklenecek kalıplar (**hepsi test edilir, en az 60 test**):
- Göreli gün: bugün, yarın, öbür gün / ertesi gün, bu akşam (20:00), bu gece (22:00), sabah (09:00), öğlen / öğle (12:30), öğleden sonra (15:00), akşam (19:00), gece (22:00)
- Gün adları: pazartesi…pazar, "cuma günü", "haftaya salı", "gelecek hafta" (sonraki pazartesi)
- Saat: `9'da`, `9da`, `saat 9`, `09:30`, `9.30`, `21:15`, `sabah 9`, `akşam 7` (→19:00), `öğleden sonra 3` (→15:00); ekler: `'da/'de/'ta/'te/'ya/'ye/'e/'a`, `buçuk` (9 buçuk → 09:30)
- Göreli süre: `15 dk sonra`, `15 dakika sonra`, `2 saat sonra`, `yarım saat sonra`, `3 gün sonra`
- Tarih: `12 ekim`, `12 Ekim'de`, `12.10`, `12/10/2026`
- Tekrar: `her gün`, `her sabah 8'de`, `hafta içi (her gün)`, `hafta sonu`, `her pazartesi`, `her pazartesi ve perşembe`, `iki haftada bir`, `3 günde bir`, `her ayın 5'i`, `ayın son günü`, `her yıl 3 mart`
- Tip: metinde `alarm`/`alarmlı` → alarm; saat varsa varsayılan bildirim.
- **Belirsiz saat kuralı:** açık "sabah/akşam" her zaman önceliklidir. Aksi hâlde 7–11 → sabah, 1–6 → öğleden sonra (13–18), 12 → öğle, 0/24 → gece yarısı.
- Saat verilip gün verilmezse: saat geçmişse yarın, değilse bugün.
- Ayrıştırılan ifadeler başlıktan çıkarılır; kalan metin kırpılır, ilk harf `tr-TR` büyütülür ("ilaç" → "İlaç").

Liste girişleri için ayrı ayrıştırıcı: `parseItemInput("2 kg domates")` → `{ name: "Domates", qty: 2, unit: "kg" }`.

### 5.9 İmza bekçisi — dosya okuma
- Yol: uygulama paketinin kökündeki `embedded.mobileprovision`. `expo-file-system`'in kurulu sürümdeki API'siyle paket dizinindeki dosyayı bayt/base64 olarak oku (yeni API'de `Paths.bundle`, eski API'de `bundleDirectory` — kurulu sürümde doğrula).
- Dosya CMS imzalı ikili bir kapsayıcıdır ama içinde düz metin XML plist bulunur: baytları latin1 olarak çöz, `/<key>ExpirationDate<\/key>\s*<date>([^<]+)<\/date>/` ile tarihi bul.
- Saf fonksiyon `parseProvisionExpiry(text): Date | null` + örnek fixture ile test.

### 5.10 Yedek formatı
`{ app: "animsa", schemaVersion: number, exportedAt: ISO, tables: { [tablo]: Row[] } }`. Geri yüklemede şema sürümü farklıysa önce migrate; tek transaction; `event_log` ve `scheduled_refs` yedeğe dahil edilmez.

### 5.11 Türkçe normalize
`normalizeTr(s)`: `toLocaleLowerCase('tr-TR')` → aksan katlama (ç→c, ğ→g, ı→i, ö→o, ş→s, ü→u, â→a, î→i, û→u) → boşluk sadeleştirme. Arama ve eşleşmede her iki taraf da normalize edilir. Test: "İLAÇ", "ilac", "Süt", "SUT".

---

## 6. AlarmKit yerel modülü

- Oluştur: `npx create-expo-module@latest --local alarm-kit` → `modules/alarm-kit/`.
- Uygulama minimum iOS'u **26.0** (`expo-build-properties` → `ios.deploymentTarget: "26.0"`); böylece `@available` korumaları gerekmez. Modülün podspec platformu da 26.0.
- Info.plist: `NSAlarmKitUsageDescription` = "Alarmlı görevlerin sessiz modda da çalabilmesi için alarm kurma izni gerekiyor."
- Uyarlama için referans: `react-native-nitro-ios-alarm-kit` açık kaynak paketinin Swift kodu (bağımlılık olarak ekleme, yalnızca API kullanımını doğrulamak için incele).

**TypeScript sözleşmesi:**
```ts
export type AlarmAuthState = 'authorized' | 'denied' | 'notDetermined' | 'unavailable';

isAvailable(): boolean
getAuthorizationState(): AlarmAuthState
requestAuthorization(): Promise<AlarmAuthState>
scheduleFixed(o: { id: string; epochMs: number; title: string }): Promise<void>
scheduleWeekly(o: { id: string; hour: number; minute: number; weekdays: number[] /* 1=Pzt … 7=Paz */; title: string }): Promise<void>
cancel(id: string): Promise<void>
listIds(): Promise<string[]>
```
`id` bir UUID string'idir (AlarmKit `Alarm.ID` = `UUID`).

**Swift taslağı** (API adlarını kurulu Xcode SDK'sına ve Apple dokümanına göre doğrula; derleme hatalarını CI'dan düzelt):
```swift
import ExpoModulesCore
import AlarmKit
import SwiftUI

struct AnimsaAlarmMetadata: AlarmMetadata {}

public class AlarmKitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AlarmKit")

    Function("isAvailable") { true }

    Function("getAuthorizationState") { () -> String in
      Self.map(AlarmManager.shared.authorizationState)
    }

    AsyncFunction("requestAuthorization") { () async throws -> String in
      Self.map(try await AlarmManager.shared.requestAuthorization())
    }

    AsyncFunction("scheduleFixed") { (id: String, epochMs: Double, title: String) async throws in
      let config = Self.config(
        schedule: .fixed(Date(timeIntervalSince1970: epochMs / 1000)), title: title)
      _ = try await AlarmManager.shared.schedule(id: try Self.uuid(id), configuration: config)
    }

    AsyncFunction("scheduleWeekly") { (id: String, hour: Int, minute: Int, weekdays: [Int], title: String) async throws in
      let days: [Locale.Weekday] = weekdays.compactMap(Self.weekday)
      let rel = Alarm.Schedule.Relative(
        time: .init(hour: hour, minute: minute), repeats: .weekly(days))
      let config = Self.config(schedule: .relative(rel), title: title)
      _ = try await AlarmManager.shared.schedule(id: try Self.uuid(id), configuration: config)
    }

    AsyncFunction("cancel") { (id: String) throws in
      try AlarmManager.shared.cancel(id: try Self.uuid(id))
    }

    AsyncFunction("listIds") { () throws -> [String] in
      try AlarmManager.shared.alarms.map { $0.id.uuidString.lowercased() }
    }
  }

  static func config(schedule: Alarm.Schedule, title: String)
    -> AlarmManager.AlarmConfiguration<AnimsaAlarmMetadata> {
    let stop = AlarmButton(text: "Durdur", textColor: .white, systemImageName: "stop.fill")
    let alert = AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: title), stopButton: stop)
    let attrs = AlarmAttributes<AnimsaAlarmMetadata>(
      presentation: AlarmPresentation(alert: alert), tintColor: .orange)
    return .alarm(schedule: schedule, attributes: attrs, stopIntent: nil, secondaryIntent: nil, sound: .default)
  }
  // uuid(_:), weekday(_:) (1=monday … 7=sunday), map(_:) yardımcılarını yaz.
}
```
- Kapsam dışı (v1): erteleme butonu (geri sayım sunumu Live Activity uzantısı gerektirir → ücretsiz hesapta uzantı yok), özel alarm sesi.
- `src/services/alarms.ts`: modülü sarar; AlarmKit kullanılamaz/izin yoksa aynı API ile bildirim kurar ve `event_log`'a "alarm→bildirim düşüşü" yazar.

---

## 7. Uygulama yapısı ve arayüz

### 7.1 Klasör ağacı
```
animsa/
├─ SPEC.md
├─ app.config.ts
├─ index.ts                      # önce background tasks, sonra expo-router/entry
├─ package.json  tsconfig.json  eslint.config.js  jest.config.js
├─ metro.config.js  babel.config.js  drizzle.config.ts  .gitattributes
├─ drizzle/                      # üretilmiş migration'lar
├─ plugins/withStripPushEntitlement.js
├─ modules/alarm-kit/
├─ assets/ icon.svg icon.png(1024, alfa kanalsız) splash-icon.png
├─ scripts/ build-ios.sh  publish-release.mjs  make-icon.mjs
├─ .github/workflows/ check.yml  ios.yml
├─ docs/ KURULUM.md MIMARI.md KARARLAR.md TEST_LISTESI.md
└─ src/
   ├─ app/
   │  ├─ _layout.tsx             # DB migration kapısı, tema, bildirim yanıtları, derin bağlantılar, AppState→senkron
   │  ├─ (tabs)/_layout.tsx      # Bugün · Liste · Yerler · Ayarlar
   │  ├─ (tabs)/index.tsx        # Bugün
   │  ├─ (tabs)/list.tsx
   │  ├─ (tabs)/places.tsx
   │  ├─ (tabs)/settings.tsx
   │  ├─ task/new.tsx  task/[id].tsx          # formSheet
   │  ├─ item/[id].tsx  scan.tsx
   │  ├─ place/new.tsx  place/[id].tsx  place/pick.tsx   # harita seçici
   │  ├─ settings/*.tsx          # alt sayfalar (sessiz saat, kategoriler, evden çıkış listesi, imza, yedek)
   │  ├─ diagnostics.tsx
   │  └─ onboarding/*.tsx
   ├─ domain/  recurrence.ts nlp/ planner.ts predictor.ts regions.ts quietHours.ts
   │           normalize.ts format.ts provision.ts backupSchema.ts types.ts
   ├─ db/      schema.ts client.ts seed.ts repos/*.ts
   ├─ services/ notifications.ts alarms.ts location.ts osm.ts openFoodFacts.ts
   │            sync.ts signature.ts backup.ts permissions.ts log.ts deeplinks.ts
   ├─ background/ tasks.ts
   ├─ components/ …
   ├─ theme/  tokens.ts
   └─ data/   categoryKeywords.ts defaultCategories.ts
```

### 7.2 Arayüz ilkeleri
- **iOS yerli hissi:** büyük başlıklar (native stack `headerLargeTitle`), düzenleme ekranları `formSheet` sunumu (detent'lerle), SF Symbols, sistem renkleri, karanlık mod (renkler `theme/tokens.ts`'de açık/koyu çiftler), Liquid Glass sekme çubuğu (native tabs varsa).
- **Erişilebilirlik:** Dynamic Type (sabit font boyutu yok), 44 pt minimum dokunma alanı, tüm ikon butonlarında `accessibilityLabel` (Türkçe), yeterli kontrast.
- **Geri bildirim:** tamamla/sil/tarama için haptik; tüm hatalar kısa Türkçe toast, ayrıntı `event_log`'a.
- **Boş durumlar:** her liste için ikon + açıklama + birincil eylem ("Henüz görev yok. Aşağıya yazarak ekle: *yarın 9'da ilaç*").
- **Performans:** `SectionList`/`FlatList`, `keyExtractor`, memoize edilmiş satırlar; ağır işler (senkron) UI iş parçacığını bloklamaz.
- **İkon:** `assets/icon.svg` (turuncu zemin, beyaz çan + ev silüeti), `scripts/make-icon.mjs` ile `sharp` kullanarak 1024×1024 **alfa kanalsız** PNG üret.

---

## 8. `app.config.ts` gereksinimleri

- `APP_VARIANT` ortam değişkeni (`release` varsayılan | `dev`) ile ad, bundle ID, şema, ikon rozetini değiştir.
- `name: "Animsa"` (ASCII — Xcode proje/şema adı), `ios.infoPlist.CFBundleDisplayName: "Anımsa"` / `"Anımsa Dev"`.
- `version`: `package.json`'dan; `ios.buildNumber`: `process.env.BUILD_NUMBER ?? "1"`.
- `ios.supportsTablet: false`, `userInterfaceStyle: "automatic"`, `scheme` varyanta göre.
- `ios.infoPlist`:
  - `NSLocationWhenInUseUsageDescription`: "Yakındaki marketleri ve kayıtlı yerlerini gösterebilmek için konumuna ihtiyaç var."
  - `NSLocationAlwaysAndWhenInUseUsageDescription`: "Markete yaklaştığında veya evden çıktığında uygulama kapalıyken de hatırlatabilmek için 'Her Zaman' konum izni gerekiyor."
  - `NSCameraUsageDescription`: "Ürün barkodlarını okuyarak listeye eklemek için kamera kullanılır."
  - `NSAlarmKitUsageDescription`: (§6)
  - `UIFileSharingEnabled: true`, `LSSupportsOpeningDocumentsInPlace: true`
  - `LSApplicationQueriesSchemes: ["altstore-classic", "altstore"]`
  - `ITSAppUsesNonExemptEncryption: false`, `CFBundleDevelopmentRegion: "tr"`
- `plugins`:
  - `expo-router`, `expo-sqlite`, `expo-background-task`
  - `["expo-location", { isIosBackgroundLocationEnabled: true, locationAlwaysAndWhenInUsePermission: … }]`
  - `["expo-notifications", { … }]`
  - `["expo-camera", { cameraPermission: …, microphonePermission: false }]` (mikrofon izni eklenmesin)
  - `["expo-build-properties", { ios: { deploymentTarget: "26.0" } }]`
  - `"./plugins/withStripPushEntitlement"` → üretilen entitlements dosyasından `aps-environment` anahtarını kaldırır (ücretsiz imzada push yok; imzasız derlemede de temiz kalsın).
  - Dev varyantında `expo-dev-client`.
- `npx expo config --type introspect` çıktısında mikrofon izni ve push entitlement'ı **olmamalı**; bu, check.yml'de doğrulanır.

---

## 9. CI/CD — derleme, paketleme, dağıtım

### 9.1 Neden public repo
- Public repolarda GitHub Actions dakikaları (macOS runner dahil) ücretsizdir; private repolarda macOS dakikası kotadan çarpanlı düşer.
- Release dosyaları herkese açık URL alır → AltStore **kaynak JSON'u** IPA'yı doğrudan indirip telefonda güncelleme sunabilir.
- Repoda kişisel veri yoktur; veriler yalnızca telefondadır.
- (Kullanıcı private isterse: `docs/KURULUM.md`'de alternatif — IPA'yı Actions artifact'ından indirip AltServer "Sideload .ipa" ile kurma.)

### 9.2 `check.yml` (ubuntu-latest; her push/PR ve `workflow_call`)
`npm ci` → `npx tsc --noEmit` → `npx eslint .` → `npx jest --ci` → `npx expo-doctor` → `npx expo config --type introspect` çıktısında yasak anahtar kontrolü (`NSMicrophoneUsageDescription`, `aps-environment` yok; `NSAlarmKitUsageDescription` var).

### 9.3 `ios.yml` (macOS; elle tetikleme + `v*` etiketi)
Referans iskelet (action sürümlerini güncel major sürümlerle, runner etiketini güncel macOS görüntüsüyle doğrula; **Xcode ≥ 26 şart**, AlarmKit SDK'sı için):
```yaml
name: iOS Build
on:
  workflow_dispatch:
    inputs:
      variant:
        type: choice
        options: [release, dev]
        default: release
  push:
    tags: ["v*"]
permissions:
  contents: write
concurrency:
  group: ios-${{ inputs.variant || 'release' }}
  cancel-in-progress: true
jobs:
  check:
    uses: ./.github/workflows/check.yml
  build:
    needs: check
    runs-on: macos-26            # yoksa Xcode 26+ içeren en güncel macOS etiketi
    timeout-minutes: 60
    env:
      APP_VARIANT: ${{ inputs.variant || 'release' }}
      BUILD_NUMBER: ${{ github.run_number }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: lts/*, cache: npm }
      - uses: maxim-lobanov/setup-xcode@v1
        with: { xcode-version: latest-stable }
      - run: xcodebuild -version
      - run: npm ci
      - run: npx expo prebuild --platform ios --clean
      - run: bash scripts/build-ios.sh
      - uses: actions/upload-artifact@v4
        with:
          name: ipa-${{ env.APP_VARIANT }}-${{ github.run_number }}
          path: dist/*.ipa
          retention-days: 30
      - run: node scripts/publish-release.mjs
        env:
          GH_TOKEN: ${{ github.token }}
```

### 9.4 `scripts/build-ios.sh` (imzasız IPA)
```bash
#!/usr/bin/env bash
set -euo pipefail
CONFIG=$([ "${APP_VARIANT:-release}" = "dev" ] && echo Debug || echo Release)
WS=$(ls -d ios/*.xcworkspace | head -n1)
SCHEME=$(basename "$WS" .xcworkspace)      # xcodebuild -list ile doğrula
xcodebuild -workspace "$WS" -scheme "$SCHEME" -configuration "$CONFIG" \
  -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" \
  COMPILER_INDEX_STORE_ENABLE=NO build
APP=$(ls -d build/Build/Products/${CONFIG}-iphoneos/*.app | head -n1)
rm -rf dist Payload && mkdir -p dist Payload
cp -R "$APP" Payload/
VER=$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$APP/Info.plist")
BLD=$(/usr/libexec/PlistBuddy -c 'Print CFBundleVersion' "$APP/Info.plist")
zip -qry "dist/Animsa-${APP_VARIANT:-release}-${VER}-${BLD}.ipa" Payload
plutil -convert json -o dist/Info.json "$APP/Info.plist"
test ! -f "$APP/embedded.mobileprovision"   # imzasız olmalı
```

### 9.5 `scripts/publish-release.mjs`
1. `dist/Info.json` ve IPA'dan sürüm, build, boyut, SHA-256 hesapla.
2. `gh release create "${variant}-${version}-${build}" dist/*.ipa` (dev için `--prerelease`), notlara son commit mesajları.
3. Sabit etiketli `altstore-source` release'indeki mevcut `source.json`'u indir (yoksa yeni oluştur), ilgili uygulama girdisinin `versions` dizisinin **başına** yeni sürümü ekle (son 5 tutulur), `gh release upload altstore-source source.json --clobber`.
4. `appPermissions.privacy`: `Info.json`'daki `*UsageDescription` ile biten tüm anahtarlar ve metinleri (AltStore, kaynaktaki izinlerle IPA'dakileri karşılaştırır; eşleşmeli). `entitlements`: `[]` (imzasız IPA).
5. Kaynağın sabit URL'si: `https://github.com/<kullanıcı>/animsa/releases/download/altstore-source/source.json` — `README.md` ve `docs/KURULUM.md`'ye yaz.

**Kaynak JSON biçimi** (alan adlarını AltStore'un güncel "Make a Source" dokümanına göre doğrula, faq.altstore.io):
```json
{
  "name": "Anımsa",
  "identifier": "com.bariscoskun.animsa.source",
  "subtitle": "Kişisel kaynak",
  "iconURL": "https://raw.githubusercontent.com/<kullanıcı>/animsa/main/assets/icon.png",
  "tintColor": "#FF7A1A",
  "apps": [
    {
      "name": "Anımsa",
      "bundleIdentifier": "com.bariscoskun.animsa",
      "developerName": "Barış Coşkun",
      "localizedDescription": "Görev, alarm, ev listesi ve konum hatırlatıcı.",
      "iconURL": "https://raw.githubusercontent.com/<kullanıcı>/animsa/main/assets/icon.png",
      "tintColor": "#FF7A1A",
      "category": "utilities",
      "versions": [
        {
          "version": "1.0.0",
          "buildVersion": "42",
          "date": "2026-09-18T12:00:00Z",
          "localizedDescription": "Değişiklikler…",
          "downloadURL": "https://github.com/<kullanıcı>/animsa/releases/download/release-1.0.0-42/Animsa-release-1.0.0-42.ipa",
          "size": 12345678,
          "sha256": "…",
          "minOSVersion": "26.0"
        }
      ],
      "appPermissions": { "entitlements": [], "privacy": { "NSCameraUsageDescription": "…" } }
    }
  ],
  "news": []
}
```
Dev varyantı aynı kaynakta ikinci uygulama girdisidir (`com.bariscoskun.animsa.dev`).

### 9.6 Sürümleme
- `package.json` `version` = kullanıcıya görünen sürüm (semver). `BUILD_NUMBER` = `github.run_number` (her zaman artar, AltStore güncellemeyi buna göre görür).
- Release: `npm version patch && git push --follow-tags` veya Actions'tan elle "release".

---

## 10. Test stratejisi

**Birim testleri (jest, domain):**
- `recurrence`: ≥ 30 vaka (ay sonu taşması, artık yıl, seçili günler, N haftada bir, bitiş tarihi/sayısı, ertelenen/atlanan oluşumlar).
- `nlp`: ≥ 60 vaka (§5.8 listesinin tamamı, belirsiz saat kuralı, başlık temizleme, büyük İ).
- `planner`: 60 bütçe sınırı, öncelik sırası, sessiz saat kaydırma, deterministik key'ler, contentHash değişimi, liste boşken liste bildirimi yok, haftalık alarm tekilleştirme.
- `regions`: 20 limiti, öncelikler, liste boşken market yok, rotasyon yarıçapı sıkıştırma.
- `predictor`, `normalizeTr`, `parseItemInput`, `parseProvisionExpiry` (fixture), `backupSchema` gidiş-dönüş, `publish-release` kaynak güncelleme mantığı (saf kısmı ayrı fonksiyon).

**Cihaz test listesi** (`docs/TEST_LISTESI.md`, kullanıcı telefonda yürütür; her madde adım + beklenen sonuç):
- 2 dk sonraya alarmlı görev kur, telefonu sessize al, kilitle → alarm çalmalı.
- Uygulamayı app switcher'dan kapat, 1 dk sonraya bildirimli görev → bildirim gelmeli.
- Tanılama → sahte GİRİŞ (market) → listede ürün varken bildirim, yokken bildirim yok.
- Gerçek market ziyareti (listede ürünle).
- Evden çıkış bildirimi.
- Barkod okutma (katalogda olan / olmayan / internetsiz).
- Yedekle → uygulamada veri değiştir → geri yükle.
- İmza ekranında kalan süre, AltStore ile yenileme sonrası güncelleniyor mu.
- Karanlık mod, büyük yazı boyutu, VoiceOver ile temel akış.

---

## 11. Aşamalar ve "Bitti" tanımı

Her aşama sonunda §0.5 kalite kapısı + `docs/KARARLAR.md` güncellemesi + anlamlı commit'ler.

| Aşama | Kapsam | Bitti tanımı |
|---|---|---|
| **0 — İskelet & CI** | Expo projesi, TS strict, ESLint/Prettier, jest, `.gitattributes`, `app.config.ts` varyantları, boş 4 sekme, tema, ikon betiği, `check.yml` + `ios.yml` + betikler, repo oluşturma | Actions'ta **dev ve release IPA yeşil**; `altstore-source` release'inde geçerli `source.json` var |
| **1 — Çekirdek** | DB şema/migration/seed, görev CRUD, tekrar motoru, NLP + çipli hızlı ekleme, bildirim servisi + kategoriler, **ReminderSync**, imza bekçisi (okuma + Ayarlar + uyarılar), `event_log`, temel Tanılama | Birim testleri yeşil; telefonda görev bildirimi çalışıyor (TEST_LISTESI ilgili maddeler) |
| **2 — Ev listesi** | Katalog, kategoriler + sıralama, Türkçe normalize ve otomatik tamamlama, kategori sözlüğü (300+), miktar ayrıştırma, alındı akışı + `purchase_events`, zamanlı liste kuralları, günlük özet + akşam önizlemesi, sessiz saatler | Liste akışı uçtan uca; özet bildirimi içerik doğru |
| **3 — Alarm** | AlarmKit modülü, izin akışı, haftalık/sabit alarm eşlemesi, bildirime düşüş, Tanılama test alarmı | Sessiz modda alarm çalıyor |
| **4 — Konum** | Yerler ekranı + harita seçici, geofencing arka plan görevi, bölge seçimi + rotasyon, OSM keşfi + önbellek, ev çıkış/giriş, konum tetikleyicili görevler, spam önleme, sahte olay testi | Sahte olay testleri ve gerçek market testi başarılı |
| **5 — Akıllı özellikler** | Tüketim tahmini + öneri kartları, Dolap/SKT, barkod + Open Food Facts | İlgili testler ve cihaz maddeleri geçiyor |
| **6 — Güvence** | Yedekle/geri yükle + otomatik haftalık yedek, derin bağlantılar, onboarding, Ayarlar'ın tamamı, Tanılama'nın tamamı | Yedek gidiş-dönüşü telefonda doğrulandı |
| **7 — Cila & belgeler** | Erişilebilirlik, boş durumlar, animasyonlar, performans, `README.md`, `docs/*` eksiksiz | Tüm TEST_LISTESI maddeleri yazılı; v1.0.0 release etiketi |
| **8 — OPSİYONEL (varsayılan YAPMA)** | Ana ekran widget'ı (`expo-apple-targets` + App Group) | Yalnızca kullanıcı açıkça isterse. Ücretsiz hesapta ek App ID tüketir; App Group imzası sorun çıkarabilir — önce KARARLAR.md'de riskleri yaz |

---

## 12. İnsan adımları (ajan bunları `docs/KURULUM.md`'ye ayrıntılı, ekran ekran yazacak)

**A. Bilgisayar** (AltServer için **Windows önerilir**; geliştirme Ubuntu'da da yapılabilir)
1. Node.js LTS, Git, GitHub CLI (`gh auth login`), kodlama ajanı.
2. Windows: **iTunes ve iCloud'u Apple'ın sitesinden** kur (Microsoft Store sürümleri değil).
3. altstore.io'dan **AltServer**'ı kur ve çalıştır (sistem tepsisinde). Windows güvenlik duvarında AltServer'a özel ve genel ağ izni ver.
4. iPhone iOS güncellemesinden önce AltServer/AltStore'un güncel olduğunu kontrol et (iOS güncellemeleri sideload araçlarını zaman zaman bozabilir).

**B. iPhone (bir kerelik, ~20 dk)**
1. Kabloyla bağla → "Bu Bilgisayara Güven".
2. AltServer menüsü → *Install AltStore* → cihazı seç → Apple ID (ücretsiz; istersen yalnızca bunun için ayrı bir Apple ID).
3. Ayarlar › Genel › VPN ve Cihaz Yönetimi → geliştirici profiline **Güven**.
4. Ayarlar › Gizlilik ve Güvenlik › **Geliştirici Modu** → aç → yeniden başlat → onayla.
5. AltStore › Ayarlar: arka plan yenilemeyi doğrula; istersen *Set up Remote AltServer* (Wi-Fi olan her yerden yenileme).
6. AltStore › Kaynaklar › **+** → `source.json` URL'si → **Anımsa**'yı kur (geliştirme için ayrıca **Anımsa Dev**).
7. **Yenileme garantisi:** Kısayollar › Otomasyon › Her gün 03:00 → AltStore "Uygulamaları Yenile" → "Hemen Çalıştır". (AltServer'lı bilgisayar o saatte açık ve aynı Wi-Fi'da olmalı, ya da Remote AltServer kurulu olmalı.)
8. Anımsa'yı aç → onboarding → konumda **Her Zaman**.

**C. Geliştirme döngüsü**
- **JS/TS değişikliği:** Anımsa Dev kurulu → bilgisayarda `npx expo start --dev-client` (telefonla aynı Wi-Fi) → Dev uygulamasında sunucuyu seç → değişiklikler anında yansır. Bağlanamazsa `npx expo start --dev-client --tunnel`. WSL2 kullanılıyorsa mirrored networking veya `--tunnel`. Windows güvenlik duvarında 8081 portuna izin.
- **Native değişiklik** (yeni native paket, `app.config.ts`, Swift, izin metinleri): Actions › iOS Build › *Run workflow* (dev) → AltStore › Güncellemeler.
- **Günlük kullanım sürümü:** `npm version patch && git push --follow-tags` → ~15–25 dk sonra AltStore'da "Güncelle". Veriler korunur.

---

## 13. Riskler ve geri dönüş planları

| Risk | Önlem / Geri dönüş |
|---|---|
| AltStore otomatik yenileme başarısız | İmza bekçisi 48/24/12 saat kala uyarır; kabloyla bağlayıp AltStore'da Yenile. İmza dolarsa uygulama açılmaz ama **veri silinmez**; yenileyince döner. Süre dolduğunda hatırlatmaların çalışması garanti değildir. |
| iOS güncellemesi sideload'u bozar | KURULUM.md'de "güncellemeden önce AltServer sürüm notlarını kontrol et" uyarısı. |
| AlarmKit ücretsiz imzada/izinsiz çalışmaz | `alarms.ts` bildirime düşer, Tanılama'da görünür. |
| Overpass erişilemez / yavaş | Yalnızca kullanıcı yerleri + önbellek; yedek uç nokta. |
| `expo-background-task` seyrek çalışır | Senkron diğer tetikleyicilerle sık çalışır; 7 günlük pencere yeterli tampon. |
| 64 bildirim limiti | Planlayıcı bütçesi 60, öncelikli. |
| Bölge bildirimi gecikmesi | 1–3 dk normal; 100 m altı yarıçap güvenilmez → minimum 100 m. |
| Haftalık 10 App ID limiti | Bundle ID sabit, uzantı yok. |
| Ağ yok | Tüm çekirdek özellikler çevrimdışı; yalnızca OSM ve Open Food Facts ağ ister. |

---

## 14. Ajanın son kontrol listesi

- [ ] `check.yml` ve `ios.yml` son commit'te yeşil; dev ve release IPA'ları release'lerde.
- [ ] `source.json` geçerli JSON, iki uygulama girdisi, `privacy` IPA ile birebir.
- [ ] Mikrofon izni ve `aps-environment` yok; `NSAlarmKitUsageDescription` var; minimum iOS 26.0.
- [ ] Domain testleri: recurrence ≥ 30, nlp ≥ 60, planner, regions, predictor, normalize, provision, backup.
- [ ] Tüm kullanıcı metinleri Türkçe; tarih biçimleri `tr-TR`.
- [ ] Uygulama izinsiz de çökmeden açılıyor; her izin reddi zarifçe ele alınıyor.
- [ ] Tanılama ekranı test butonları çalışıyor.
- [ ] `README.md`, `docs/KURULUM.md`, `docs/MIMARI.md`, `docs/KARARLAR.md`, `docs/TEST_LISTESI.md` eksiksiz.
- [ ] Kullanıcıya son mesaj: kaynak URL'si, kurulum için yapması gereken adımların kısa özeti ve TEST_LISTESI'ne yönlendirme.
