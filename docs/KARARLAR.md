# Kararlar

SPEC.md belirsiz bıraktığı ya da kurulu sürümlerin farklı davrandığı her noktada
verilen karar ve gerekçesi. Yeni bir karar alındığında buraya eklenir.

---

## 1. Expo SDK 57 (stabil)

`npm view expo dist-tags` çıktısında `latest: 57.0.24`, `next: 58.0.0-preview.3`.
SPEC.md §0.3 beta/RC yasakladığı için **SDK 57** seçildi. Tüm Expo ve React
Native paketleri `npx expo install` ile kuruldu, böylece sürümler SDK ile uyumlu.

## 2. Sekmeler: native tabs değil, JS tabs

SPEC.md §2 "SDK'da stabilse native tabs" diyor. SDK 57'de bu API hâlâ
`expo-router/unstable-native-tabs` adıyla, yani **unstable** olarak yayınlanıyor.
Bu yüzden `expo-router/js-tabs` kullanıldı.

- İçe aktarma yolu `expo-router/js-tabs`; kök `expo-router` paketindeki `Tabs`
  aynı bileşen ama **deprecated** olarak işaretli.
- Sonuç: iOS 26 Liquid Glass sekme çubuğu görünümü yok; işlevsel fark yok.
- SDK 58+ ile native tabs stabilleşirse tek dosya (`src/app/(tabs)/_layout.tsx`)
  değiştirilerek geçilebilir.

## 3. `newArchEnabled` ve `splash` anahtarları kaldırıldı

SDK 57'de `ExpoConfig` tipi bu iki üst düzey anahtarı artık tanımıyor:

- New Architecture zaten varsayılan; ayrı bayrak gerekmiyor.
- Açılış ekranı `expo-splash-screen` eklentisinin seçeneklerine taşındı.

## 4. Push entitlement'ı kaldıran eklenti **listenin başında**

`expo-notifications` eklentisi, uzak bildirim kullanılmasa bile entitlements
dosyasına `aps-environment` yazıyor. Ücretsiz Apple ID bunu imzalayamaz.

Expo config-plugin mod'ları **ters sırada** çalışır: en son kaydedilen eklentinin
mod'u en önce çalışır. Bu yüzden `withStripPushEntitlement`
`plugins` dizisinin **en başına** konuldu; böylece mod'u en sonda,
`expo-notifications` anahtarı ekledikten *sonra* çalışıp siliyor.

Doğrulandı: `npx expo config --type introspect` çıktısında `ios.entitlements`
boş, `NSMicrophoneUsageDescription` yok. `scripts/check-config.mjs` bunu CI'da
her push'ta kontrol ediyor.

## 5. Mikrofon izni: `microphonePermission: false`

`expo-camera` varsayılan olarak `NSMicrophoneUsageDescription` ekliyor. Uygulama
ses kaydetmediği için eklenti seçeneğiyle kapatıldı ve CI kontrolüne eklendi.

## 6. Harita: dokunma ile iğne taşıma (uzun basma yok)

SPEC.md §3.6 "haritada uzun bas" diyor, ancak `expo-maps` SDK 57'de
`AppleMaps.View` için `onMapClick` sağlıyor; uzun basma olayı yok.

Karar: **haritaya dokunmak** iğneyi taşıyor. Yer eklemenin diğer iki yolu
(mevcut konum, adres arama) SPEC.md'deki gibi duruyor. `react-native-maps`'e
geçmek yalnızca uzun basma için yeni bir bağımlılık demek olurdu; değmez.

## 7. Alarm UUID'leri `uuidv5` ile türetiliyor

AlarmKit `Alarm.ID` olarak `UUID` istiyor; planlayıcı ise okunabilir
deterministik anahtarlar üretiyor (`task:{id}:{occurrenceKey}:main`).
`uuidv5(key, NAMESPACE)` ikisini birbirine bağlıyor: aynı anahtar her zaman aynı
UUID'yi veriyor, böylece senkron hangi alarmın kurulu olduğunu tablo tutmadan
da bilebiliyor.

## 8. Senkron: sistem her zaman haklı

`scheduled_refs` tablosu bir **önbellek**, doğruluk kaynağı değil. Her senkronda
`Notifications.getAllScheduledNotificationsAsync()` ve `AlarmKit.listIds()`
okunuyor; tablo ile sistem çeliştiğinde sistem kazanıyor. Böylece uygulama
silinip yeniden kurulsa, iOS bildirimleri düşürse veya tablo bozulsa bile
senkron kendini toparlıyor.

## 9. Bildirim bütçesi 60, alarmlar bütçesiz

iOS aynı anda en fazla 64 bekleyen lokal bildirim tutuyor. Planlayıcı 60'ta
kesiyor (§5.3). Alarmlar bu bütçeye dahil değil: AlarmKit'in kendi, çok daha
küçük çalışma kümesi var ve haftalık tekrarlar zaten tek kayda indirgeniyor.

## 10. Veritabanı: epoch ms + yerel tarih metni

Anlık zamanlar `integer` epoch ms; takvim tarihleri `YYYY-MM-DD` ve saatler
`HH:mm` **metin**. Böylece kullanıcı saat dilimi değiştirdiğinde "her sabah
08:00" hâlâ 08:00 kalıyor — epoch'a çevrilseydi kayardı.

## 11. Test edilebilirlik için `scripts/altstoreSource.mjs` ayrıldı

SPEC.md §10 "publish-release kaynak güncelleme mantığı (saf kısmı ayrı
fonksiyon)" istiyor. `publish-release.mjs` yalnızca `gh`, dosya sistemi ve
hash işlerini yapıyor; kaynak JSON'un birleştirme mantığı saf bir modülde ve
`src/domain/altstoreSource.test.ts` ile test ediliyor.

Jest `.mjs` dosyalarını varsayılan olarak dönüştürmediği için `jest.config.js`
preset'in `transform` ayarına `'^.+\\.mjs$': 'babel-jest'` eklendi (preset'in
kendi ayarları korunarak — üzerine yazmak TS dönüşümünü bozardı).

## 12. Veri yükleme efektleri `useFocusEffect` ile

React 19 lint kuralı `react-hooks/set-state-in-effect`, `useEffect` içinden
state yazan bir fonksiyon çağırmayı hata sayıyor. Ekranların çoğu zaten
odaklandığında tazelenmeli olduğu için bu efektler `useFocusEffect`'e taşındı:
hem kural sağlanıyor hem de davranış doğrulanıyor (ör. görev ekleyip geri
dönünce liste güncel geliyor).

`Toast`'taki `useRef(new Animated.Value(0)).current` de `useMemo`'ya çevrildi;
`Animated.Value` render sırasında okunan bir ref değil, kalıcı bir değer.

## 13. "Belirsiz saat" kuralı testte de uygulanıyor

SPEC.md §5.8: açık "sabah/akşam" yoksa 7–11 → sabah. Dolayısıyla `7'ye kadar`
→ **07:00**, 19:00 değil. Testler bu kuralı olduğu gibi doğruluyor.

## 14. `12.10` tarih değil, saat

Noktalı iki sayı `HH.mm` ile karışıyor (`9.30`). Karar: **yıl verilmediyse**
noktalı biçim saat sayılıyor; tarih için `12/10` veya `12/10/2026` ya da
`12 ekim` kullanılıyor. Bölü işaretli biçim her zaman tarih.

## 15. Kategori sözlüğü 470 ürün

SPEC.md en az 300 istiyor; `src/data/categoryKeywords.ts` 470 normalize edilmiş
anahtar içeriyor ve test bu alt sınırı koruyor. Eşleştirme sırası: tam ad →
sondan başa kelime (Türkçe tamlamalarda baş isim sonda: "zeytin **yağı**") →
en uzun alt dize.

## 16. Aşama 8 (widget) yapılmadı

SPEC.md §11'de varsayılan olarak "YAPMA" işaretli. Riskleri: her uzantı ayrı bir
App ID tüketir (7 günde 10 sınırı), App Group entitlement'ı ücretsiz imzada
sorun çıkarır, ve AltStore yenilemesi uzantıyla birlikte daha kırılgandır.
Kullanıcı açıkça isterse ayrıca değerlendirilir.

## 17. Yerel modülün podspec'i `ios/` altında olmalı

İlk gerçek derleme yeşil bitti ama üretilen IPA'da **AlarmKit modülü yoktu** —
`Frameworks/` içinde yok, ikilide tek sembol yok. Hiçbir adım hata vermedi:
`requireOptionalNativeModule` `null` döndüğü için `alarms.ts` sessizce bildirime
düşüyordu. Yani alarm özelliği, kullanıcı sabah kalkamayana kadar "çalışıyor"
görünecekti.

Sebep: podspec'i `modules/alarm-kit/AlarmKit.podspec` (modül kökü) yazmıştım.
`expo-modules-autolinking` podspec ararken modülün yalnızca **alt dizinlerini**
tarıyor (`listFilesInDirectories`), kökteki dosyalara bakmıyor. Podspec
bulunamayınca `resolveModuleAsync` `null` dönüyor ve modül Podfile'a hiç
girmiyor.

Kanıt (`expo-modules-autolinking resolve -p apple`):

| Podspec konumu | Sonuç |
|---|---|
| `modules/alarm-kit/AlarmKit.podspec` | çözümlenmedi |
| `modules/alarm-kit/ios/AlarmKit.podspec` | `pod=AlarmKit` |

Bu yüzden podspec `ios/` altına taşındı — kurulu tüm gerçek modüller de böyle
(`expo-haptics/ios/ExpoHaptics.podspec`). `package.json`'a ayrıca
`expo.autolinking.nativeModulesDir: "./modules"` eklendi (`create-expo-module
--local` bunu kendiliğinden yapar).

**İki koruma eklendi**, çünkü bu hatanın kendini belli etme yolu yok:

- `check.yml` → `scripts/check-alarmkit.mjs`: autolinking pod'u ve modül
  sınıfını çözümleyebiliyor mu? (15 dakikalık macOS derlemesinden **önce**)
- `build-ios.sh` → aynı betik, derlenmiş `.app` ile: `AlarmKit` izi ana ikilide
  veya bir framework'te gerçekten var mı?

## 18. Depo oluşturma kullanıcıya bırakıldı

Geliştirme makinesinde GitHub CLI (`gh`) kurulu değil, dolayısıyla
`gh repo create` çalıştırılamadı. Kod ve iş akışları hazır; depo oluşturma
adımları `docs/KURULUM.md` bölüm 0'da. CI ilk push'ta çalışmaya başlar.
