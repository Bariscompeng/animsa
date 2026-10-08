# Anımsa

Kişisel iOS gün & ev asistanı. Tek kullanıcılı, tek telefona kurulan,
**tamamen cihaz üzerinde çalışan** bir hatırlatıcı.

- **Görevler** — Türkçe yazarak ekle (`yarın 9'da ilaç`), bildirim **veya**
  sessiz modu aşan gerçek alarm.
- **Ev listesi** — ürün kataloğu, reyon sırası, barkodla ekleme, son kullanma
  takibi.
- **Konum** — markete yaklaşınca listeni, evden çıkarken kontrol listeni
  hatırlatır.
- **Tahmin** — alım alışkanlığından "süt bitmek üzere" der.
- **İmza bekçisi** — kendi imza süresini izler, dolmadan uyarır.

Sunucu yok, hesap yok, telemetri yok. Veriler yalnızca telefonda.

---

## Kurulum

Telefonuna kurmak için: **[docs/KURULUM.md](docs/KURULUM.md)** — adım adım,
ekran ekran.

AltStore kaynağı (depoyu oluşturduktan sonra, `<kullanıcı>` yerine kendi GitHub
kullanıcı adın):

```
https://raw.githubusercontent.com/<kullanıcı>/animsa/master/source.json
```

---

## Neden App Store'da değil

Ücretli Apple Developer hesabı gerekmiyor. Ücretsiz Apple ID ile imzalanıyor;
Apple bu imzayı 7 günde bir geçersiz kılıyor, AltStore da otomatik yeniliyor.
Uygulama ayrıca kendi imza bitişini okuyup süre dolmadan seni uyarıyor.

Bunun bedeli: hiçbir özel entitlement kullanılamıyor. Bu yüzden uzak bildirim,
iCloud, App Group ve uygulama uzantısı yok — her hatırlatma lokal bildirim,
AlarmKit alarmı veya bölge izlemeyle yapılıyor.

---

## Geliştirme

**Mac gerekmiyor.** Tüm iOS derlemeleri GitHub Actions macOS runner'ında yapılır.

```bash
npm ci
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # jest — 371 test
npm run icon        # assets/icon.svg → PNG'ler
npm run db:generate # şema değişince migration üret
```

iOS derlemesi:

```bash
gh workflow run ios.yml -f variant=release   # veya dev
gh run watch
```

Sürüm çıkarmak:

```bash
npm version patch && git push --follow-tags
```

---

## Yapı

```
src/domain/     saf TypeScript — tekrar motoru, NLP, planlayıcı, tahmin
src/services/   bildirim, alarm, konum, senkron, yedek, imza
src/db/         Drizzle şeması ve repository'ler
src/app/        Expo Router ekranları
modules/        AlarmKit yerel modülü (Swift)
scripts/        derleme, release, ikon
```

Ayrıntı: **[docs/MIMARI.md](docs/MIMARI.md)**

| Belge | İçerik |
|---|---|
| [docs/KURULUM.md](docs/KURULUM.md) | Telefona kurulum, günlük kullanım, sorun giderme |
| [docs/MIMARI.md](docs/MIMARI.md) | Katmanlar, senkron, konum, veri modeli |
| [docs/KARARLAR.md](docs/KARARLAR.md) | Alınan teknik kararlar ve gerekçeleri |
| [docs/TEST_LISTESI.md](docs/TEST_LISTESI.md) | Telefonda yürütülecek test listesi |

---

## Teknoloji

Expo SDK 57 · React Native New Architecture · TypeScript (strict) ·
Expo Router · expo-sqlite + Drizzle · expo-notifications (yalnızca lokal) ·
expo-location (geofencing) · AlarmKit (yerel Swift modülü) · expo-maps ·
OpenStreetMap Overpass · Open Food Facts

Minimum iOS **26.0** (AlarmKit için).

---

## Sorun giderme

Uygulama içinde **Ayarlar › Gelişmiş › Tanılama**: bekleyen bildirimler, kurulu
alarmlar, izlenen bölgeler, izin durumları, son 200 olay kaydı ve test
düğmeleri (test bildirimi, test alarmı, sahte konum olayı).
