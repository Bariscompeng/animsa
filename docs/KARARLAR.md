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

## 18. Pod adı `AnimsaAlarmKit` — `AlarmKit` olamaz

17'deki düzeltmeden sonra pod gerçekten kuruldu (`Installing AlarmKit (1.0.0)`,
`Target 'AlarmKit' in project 'Pods'`) ama derleme tek bir hatayla düştü:

```
ExpoModulesProvider.swift:96:16: error: cannot find 'AlarmKitModule' in scope
      (module: AlarmKitModule.self, name: nil),
```

Autolinking, Swift modül adını **pod adından** türetiyor (`getSwiftModuleNames`)
ve üretilen `ExpoModulesProvider.swift` dosyasına `import <podAdı>` yazıyor.
Pod'a `AlarmKit` dediğim için bu satır **Apple'ın kendi AlarmKit framework'üne**
gidiyordu; benim sınıfım orada yok.

Çözüm: pod `AnimsaAlarmKit` olarak yeniden adlandırıldı.

- Provider artık `import AnimsaAlarmKit` yazıyor → `AlarmKitModule` görünür.
- Kendi dosyamdaki `import AlarmKit` artık tek anlamlı: Apple'ın framework'ü.
- **JS tarafı etkilenmiyor**: `requireOptionalNativeModule('AlarmKit')` Swift'teki
  `Name("AlarmKit")` ile eşleşir, pod adıyla değil.

**Yan bulgu:** bu derlemede `AlarmKitModule.swift` için tek bir hata çıkmadı.
Yani spec §6'daki Swift taslağından uyarlanan AlarmKit API kullanımı
(`AlarmManager.shared.schedule`, `AlarmAttributes`, `Alarm.Schedule.Relative`,
`Locale.Weekday` eşlemesi) Xcode 26 ile olduğu gibi derleniyor.

## 19. Podspec'te `swift_version` zorunlu

18'den sonra pod doğru adla kuruldu (`Installing AnimsaAlarmKit (1.0.0)`) ve
hedef oluştu, ama derleme yine tek hatayla düştü:

```
ExpoModulesProvider.swift:11:17: error: no such module 'AnimsaAlarmKit'
```

Log'da `AnimsaAlarmKit` için **hiçbir `swiftc` çağrısı yok** — diğer pod'larda
`builtin-SwiftDriver -- swiftc -module-name EXDevMenuInterface ...` satırları
varken bunda yoktu. Yani hedef kaynaksız derlendi, modül hiç üretilmedi.

İlk teşhisim `s.swift_version` eksikliğiydi ve **yanlıştı** (bkz. §20).
`swift_version` yine de eklendi: kurulu her Expo modülünde var
(`expo-haptics`: `s.swift_version = '5.9'`) ve CocoaPods bunu Swift derlemesini
kurmak için kullanıyor. Podspec artık `expo-haptics`'inkiyle aynı iskelete
oturuyor: `swift_version`, gerçek bir `source` URL'si ve
`source_files = '**/*.{h,m,swift}'`.

Gerçek sebep bir sonraki maddede.

## 20. `.gitignore`'da `ios/` sabitlenmeli: `/ios/`

19'daki `swift_version` düzeltmesini gönderdim ve `check` işi 49 saniyede
kırmızı döndü — ama yeni yazdığım koruma sayesinde, macOS derlemesi harcanmadan:

```
✗ /home/runner/work/animsa/animsa/modules/alarm-kit/ios içinde hiç .swift dosyası yok.
```

**Asıl sebep buydu.** `.gitignore`'daki `ios/` kalıbı sabitlenmemişti; git'te
eğik çizgi içermeyen bir kalıp **her derinlikteki** aynı adlı dizini eşler. Yani
prebuild çıktısını hariç tutmak için yazdığım satır,
`modules/alarm-kit/ios/` klasörünü de hariç tutuyordu:

| Dosya | Durum |
|---|---|
| `modules/alarm-kit/ios/AlarmKitModule.swift` | **ignore edildi, hiç commit edilmedi** |
| `modules/alarm-kit/ios/AnimsaAlarmKit.podspec` | izleniyordu — `git mv` ignore'u zorla geçtiği için |

Bu yüzden runner'da podspec vardı ama Swift dosyası yoktu: pod kuruluyor, hedef
oluşuyor, derlenecek kaynak bulunamıyor, modül üretilmiyor ve uygulama
"no such module" ile düşüyordu. Yerelde her şey doğru göründüğü için fark
edilmesi zordu.

Düzeltme: kalıplar köke sabitlendi (`/ios/`, `/android/`). Kök `ios/` hâlâ
hariç, modül dizini artık değil.

`scripts/check-alarmkit.mjs` artık dosyanın diskte olmasıyla yetinmiyor,
`git ls-files --error-unmatch` ile **izlendiğini** de doğruluyor. Yapay olarak
geri getirilip test edildi: dosya `git rm --cached` ile izlemeden çıkarıldığında
koruma doğru şekilde kırmızı veriyor.

## 21. `source.json` hem eski hem yeni AltStore şemasını yazar

Kaynak AltStore'a eklenirken şu hatayı verdi:

```
No value associated with key CodingKeys
```

Bu bir Swift `Decodable` hatası: beklenen bir alan yok, ama hangisi olduğu
söylenmiyor. `faq.altstore.io/developers/make-a-source` dokümanındaki zorunlu
alanların **tamamı bizde vardı** — çünkü o doküman yeni şemayı anlatıyor.

Kurulu AltStore Classic sürümü, sürüm bilgisini `versions[]` dizisinden değil,
**uygulama nesnesinin kendisinden** okuyor: `version`, `versionDate`,
`versionDescription`, `downloadURL`, `size`, ayrıca `screenshotURLs` ve
`permissions` alanlarının var olmasını bekliyor.

Karar: **ikisi birden yazılıyor.** Yeni sürümler tanımadığı alanları yok sayar,
eski sürümler çalışır; maliyeti birkaç satır.

`legacyFields()` her zaman **en yeni sürümü** yansıtır, `versions[]` dizisi de
olduğu gibi durur. `src/domain/altstoreSource.test.ts` bu alanların varlığını
ve en yeni sürümü yansıttığını doğruluyor.

## 22. `source.json` depodan servis edilir, release dosyasından değil

AltStore kaynağı eklemeyi ısrarla reddetti:

```
No value associated with key CodingKeys(stringValue: "name")
```

Dosyayı, AltStore'un **kabul ettiği** bir kaynağın (OatmealDome) yapısal **alt
kümesine** indirdik — fazladan tek alan kalmadı, tipler birebir aynı — ve yine
reddedildi. Aynı AltStore o kaynağı sorunsuz ekliyordu. Yani sorun içerikte
değildi.

Fark barındırmadaydı:

| | Bizimki | Çalışan |
|---|---|---|
| Yönlendirme | `302` → imzalı URL | yok |
| URL ömrü | ~1 saat | kalıcı |
| Content-Type | `application/octet-stream` | normal |
| Yönlendirmesiz gövde | **0 bayt** | — |

GitHub release dosyaları `302` ile süresi dolan imzalı bir URL'ye yönlendiriyor.
AltStore bu yönlendirmeyi izlemiyor; eline boş gövde geçiyor ve boş gövdeyi
çözerken ilk zorunlu alanı bulamadığını söylüyor. Hata mesajı bu yüzden
yanıltıcıydı: eksik olan alan değil, dosyanın kendisiydi.

Karar: kaynak **`raw.githubusercontent.com`** üzerinden, depodaki dosyadan
servis ediliyor — ikon zaten oradan yükleniyordu ve sorunsuz çalışıyordu.

```
https://raw.githubusercontent.com/<kullanıcı>/animsa/master/source.json
```

`publish-release.mjs` her derlemede dosyayı GitHub contents API'siyle depoya
işliyor (CI'nin git push yapmasına gerek kalmadan). Release dosyası arşiv
kopyası olarak duruyor. Bu adım başarısız olursa iş **kırmızı düşüyor**: sessizce
bayatlarsa AltStore bir daha hiç güncelleme göstermez.

## 23. Depo oluşturma kullanıcıya bırakıldı

Geliştirme makinesinde GitHub CLI (`gh`) kurulu değil, dolayısıyla
`gh repo create` çalıştırılamadı. Kod ve iş akışları hazır; depo oluşturma
adımları `docs/KURULUM.md` bölüm 0'da. CI ilk push'ta çalışmaya başlar.
