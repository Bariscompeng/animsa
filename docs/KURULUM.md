# Kurulum

Anımsa'yı iPhone'una kurmak için adım adım rehber. Toplam süre ilk seferde
**~30 dakika**; sonraki güncellemeler tek dokunuş.

> **Neden bu kadar adım var?** Uygulama App Store'da değil. Ücretsiz Apple ID
> ile imzalanıyor ve Apple bu imzayı **7 günde bir** geçersiz kılıyor. AltStore
> bu yenilemeyi otomatik yapıyor; kurulumun çoğu AltStore'u ayarlamak.

---

## 0. GitHub deposunu oluştur (bir kerelik, bilgisayarda)

Kod hazır ama henüz GitHub'a yüklenmedi. Derlemeyi GitHub Actions yapacağı için
bu adım şart.

### 0.1 GitHub CLI kur

- **Windows:** `winget install --id GitHub.cli`
  (veya <https://cli.github.com> adresinden indir)
- **Ubuntu:** <https://github.com/cli/cli/blob/trunk/docs/install_linux.md>

Kurulumdan sonra **yeni bir terminal aç** — mevcut pencere `gh`'yi göremez,
çünkü PATH'i kurulumdan önce yüklenmiştir. Yeni pencere açmak istemezsen aynı
oturumda şunu çalıştır:

```powershell
$env:Path += ";C:\Program Files\GitHub CLI"
gh --version
```

Sonra giriş yap:

```powershell
gh auth login
```

Sorulara: `GitHub.com` → `HTTPS` → `Y` (kimlik doğrulama için Git) →
`Login with a web browser` → çıkan kodu tarayıcıya yapıştır.

### 0.2 Depoyu oluştur ve gönder

Proje klasöründe:

```powershell
git init
git add .
git commit -m "Initial commit: Animsa"
gh repo create animsa --public --source . --remote origin --push
```

> **PowerShell notu:** Windows PowerShell 5.1 `&&` operatörünü desteklemez.
> Komutları ayrı satırlarda çalıştır; zincirlemen gerekiyorsa
> `komut1; if ($?) { komut2 }` biçimini kullan.

> **Depo neden public?** Public depolarda GitHub Actions dakikaları (macOS
> dahil) ücretsiz. Ayrıca release dosyaları herkese açık URL alır — AltStore
> güncellemeleri bu URL üzerinden indirir. Depoda kişisel veri yok; verilerin
> yalnızca telefonda.
>
> Private istiyorsan: depoyu `--private` ile oluştur, ama IPA'yı her seferinde
> Actions › ilgili çalışma › Artifacts'tan indirip AltServer'ın
> "Sideload .ipa" özelliğiyle elle kurman gerekir.

Kullanıcı adını öğrenmek için: `gh api user -q .login`

### 0.3 İlk derlemeyi başlat

```powershell
gh workflow run ios.yml -f variant=release
gh run watch
```

`gh run watch` hangi çalışmayı izleyeceğini sorarsa, bir önceki komutun
yazdırdığı numarayı doğrudan ver: `gh run watch <numara>`.

~15–25 dakika sürer. Bittiğinde depoda iki release olur:

- `release-1.0.0-1` → IPA dosyası
- `altstore-source` → `source.json` (AltStore'un okuduğu kaynak)

**Kaynak URL'ni not et** (`<kullanıcı>` yerine kendi adını yaz):

```
https://raw.githubusercontent.com/<kullanıcı>/animsa/master/source.json
```

Derleme kırmızıysa: `gh run view --log-failed`

---

## A. Bilgisayar hazırlığı

AltServer için **Windows önerilir** (Mac'te de çalışır; Linux'ta AltServer yok).

### A1 — iTunes ve iCloud kur (yalnızca Windows)

**Önemli:** Microsoft Store sürümleri **çalışmaz**. Apple'ın kendi sitesinden
indir:

- iTunes: <https://www.apple.com/itunes/download/win64>
- iCloud for Windows: <https://support.apple.com/en-us/HT204283>

İkisini de kur, bir kez aç ve Apple ID'nle giriş yap.

### A2 — AltServer kur

1. <https://altstore.io> → **Download for Windows**.
2. Kur ve çalıştır. Sistem tepsisinde (saatin yanında) bir AltServer simgesi
   belirir — gizliyse `^` okuna bas.
3. Windows Güvenlik Duvarı sorarsa **hem özel hem genel ağ** için izin ver.
   (İzin vermezsen telefon AltServer'ı Wi-Fi üzerinden bulamaz.)

> AltServer sürekli çalışıyor olmalı. Başlangıçta otomatik açılması için:
> `Win+R` → `shell:startup` → AltServer kısayolunu buraya kopyala.

---

## B. iPhone kurulumu (bir kerelik, ~20 dk)

### B1 — Telefonu bağla ve güven

1. iPhone'u kabloyla bilgisayara bağla.
2. Telefonda "Bu Bilgisayara Güvenilsin mi?" → **Güven**, parolanı gir.
3. iTunes açılırsa telefonu gördüğünü doğrula ve kapat.

### B2 — AltStore'u kur

1. Tepsideki **AltServer** simgesine sağ tıkla → **Install AltStore** →
   telefonunu seç.
2. Apple ID ve parolan sorulur.
   - Ücretsiz bir Apple ID yeterli.
   - İstersen yalnızca bunun için ayrı bir Apple ID açabilirsin (tavsiye edilir
     — ana hesabının parolası bilgisayara girilmemiş olur).
   - İki faktörlü doğrulama açıksa **uygulamaya özel parola** ister:
     <https://appleid.apple.com> › Oturum Açma ve Güvenlik ›
     Uygulamaya Özel Parolalar.
3. "AltStore was successfully installed" mesajını bekle.

### B3 — Geliştirici profiline güven

Telefonda:

**Ayarlar › Genel › VPN ve Cihaz Yönetimi** → Apple ID'nin altındaki profil →
**Güven** → onayla.

Bu adım yapılmazsa AltStore açılmaz ("Untrusted Developer" hatası).

### B4 — Geliştirici Modu'nu aç

**Ayarlar › Gizlilik ve Güvenlik** → en altta **Geliştirici Modu** → **Aç** →
telefon yeniden başlar → açılışta **Aç** de ve parolanı gir.

> Geliştirici Modu görünmüyorsa: bir kez AltStore'u açmayı dene, sonra Ayarlar'a
> geri dön. iOS bu anahtarı yalnızca geliştirici imzalı bir uygulama kurulduktan
> sonra gösterir.

### B5 — AltStore ayarları

AltStore'u aç → **Settings** sekmesi:

- **Background Refresh** açık olsun (arka planda yenileme).
- İstersen **Set up Remote AltServer** — bunu kurarsan bilgisayar açık
  olmadan da, herhangi bir Wi-Fi'da yenileme yapılabilir. **Şiddetle tavsiye
  edilir**, tatilde/işte imzanın dolmasını engeller.

### B6 — Anımsa'yı kur

1. AltStore › **Browse** sekmesi › sağ üstte **+** (Sources).
2. **0.3**'te not ettiğin `source.json` URL'sini yapıştır → **Add Source**.
3. "Anımsa" kaynağı listede belirir → içine gir → **Anımsa** › **FREE** / **GET**.
4. Kurulum bitince ana ekranda turuncu çanlı simge görünür.

> Geliştirme de yapacaksan aynı kaynaktaki **Anımsa Dev**'i de kurabilirsin.
> Dikkat: ücretsiz hesapta aynı anda **en fazla 3** sideload uygulama olabilir
> (AltStore + Anımsa + Anımsa Dev = 3, tam sınır).

### B7 — Yenileme garantisi (önemli)

İmza 7 günde bir dolar. AltStore arka planda yeniler ama iOS arka plan
görevlerini garanti etmez. Güvenceye almak için bir otomasyon kur:

**Kısayollar uygulaması › Otomasyon › + › Günün Saati**
→ **03:00**, "Her Gün" → **İleri**
→ **Yeni Boş Otomasyon** → eylem ara: **AltStore** → **Refresh All Apps**
→ **Çalıştırmadan Önce Sor** kapalı olsun → **Bitti**.

> O saatte AltServer'lı bilgisayar açık ve aynı Wi-Fi'da olmalı — ya da
> **Remote AltServer** kurulu olmalı (B5).

Ayrıca uygulamanın kendisi de seni uyarır: süre dolmaya 48 ve 24 saat kala
bildirim, 12 saat kala alarm gelir, Bugün ekranında turuncu bant çıkar.

### B8 — Anımsa'yı ilk kez aç

Onboarding adımlarını geç:

1. **Bildirimler** → İzin ver
2. **Alarmlar** → İzin ver (sessiz modda çalan gerçek alarmlar için)
3. **Konum** → "Uygulamayı Kullanırken İzin Ver"
4. **"Her Zaman" konum** → **"Her Zaman İzin Ver"**
   Bu izin olmadan markete yaklaşınca hatırlatma çalışmaz.
5. **Ev konumun** → evdeysen "Buradayım, kaydet"

> iOS bazen birkaç gün sonra "Anımsa arka planda konumunuzu kullandı, izin
> versin mi?" diye sorar. **"Her Zaman İzin Ver"** de.

---

## C. Günlük kullanım

### Görev ekleme

Bugün sekmesinin altındaki satıra Türkçe yaz, Enter'a bas:

```
yarın 9'da ilaç
her sabah 8'de vitamin
hafta içi 6:30 alarm kalk
15 dk sonra çay
12 ekim 14:30 alarm doktor randevusu
her ayın 5'i kira
```

Anladıklarını yazının üstünde çip olarak gösterir (📅 ⏰ 🔁 🔔). Çipe dokunursan
düzeltebilirsin. **+** düğmesi tam formu açar.

### Liste

Liste sekmesine yaz: `2 kg domates`, `3 süt`, `ekmek`. Ürüne **dokunmak**
"alındı" demektir; 5 saniye "Geri al" hakkın var. Barkod simgesiyle okutarak da
ekleyebilirsin.

### Yerler

Yerler sekmesi › **Yer ekle** (haritaya dokun, adres ara veya konumunu kullan)
ya da **Yakındakileri bul** (OpenStreetMap'ten marketler/eczaneler).

Listende market kategorisinde ürün varken bir markete yaklaşınca bildirim gelir.

---

## D. Siri ile listeye ekleme

Kısayollar uygulamasında:

1. **+** ile yeni kısayol.
2. **Metin İste** ekle → Soru: "Ne eklensin?"
3. **URL** ekle → içeriği: `animsa://ekle?urun=` yaz, hemen ardına **Metin İste**
   çıktısını sürükle.
4. **URL'leri Aç** ekle.
5. Kısayolu adlandır: **Listeye ekle**.

Artık "Hey Siri, listeye ekle" diyebilirsin.

Diğer bağlantılar:

| Bağlantı | Ne yapar |
|---|---|
| `animsa://ekle?urun=süt` | Ürünü listeye ekler (miktar ayrıştırır) |
| `animsa://gorev?metin=yarın 9'da ilaç` | Doğal dilden görev oluşturur |
| `animsa://liste` | Liste sekmesini açar |
| `animsa://bugun` | Bugün sekmesini açar |

---

## E. Güncelleme ve geliştirme

### Günlük kullanım sürümü çıkarmak

```powershell
npm version patch
git push --follow-tags
```

~15–25 dakika sonra AltStore › Updates altında "Anımsa" güncellemesi belirir.
**Verilerin korunur** (bundle ID değişmediği sürece).

### Yalnızca JS/TS değiştirdiysen (hızlı döngü)

1. Telefonda **Anımsa Dev** kurulu olsun.
2. Bilgisayarda: `npx expo start --dev-client`
3. Telefon ve bilgisayar **aynı Wi-Fi**'da olsun; Anımsa Dev'i aç, listedeki
   sunucuyu seç.
4. Değişiklikler anında yansır.

Bağlanamazsan:

- `npx expo start --dev-client --tunnel`
- Windows Güvenlik Duvarı'nda **8081** portuna izin ver.
- WSL2 kullanıyorsan mirrored networking aç veya `--tunnel` kullan.

### Native değişiklik yaptıysan

`app.config.ts`, izin metinleri, Swift kodu veya yeni bir native paket
eklediysen JS güncellemesi yetmez:

```powershell
gh workflow run ios.yml -f variant=dev
gh run watch
```

Bitince AltStore › Updates › Anımsa Dev.

---

## F. Sorun giderme

### "Uygulama açılmıyor / hemen kapanıyor"

İmza dolmuş olabilir. AltStore'u aç → Anımsa'nın yanındaki **Refresh**'e bas.
**Verilerin silinmez**, yenileyince geri döner.

### "AltStore telefonu bulamıyor"

- AltServer tepside çalışıyor mu?
- Telefon ve bilgisayar aynı Wi-Fi'da mı?
- Windows Güvenlik Duvarı'nda AltServer'a izin verdin mi (özel **ve** genel)?
- Kabloyla bağlayıp tekrar dene.

### "Konum hatırlatmaları gelmiyor"

1. Ayarlar (Anımsa) › İzinler › Konum → **"İzin verildi"** yazıyor mu?
   "Kısmen verildi" diyorsa satıra dokunup "Her Zaman"a yükselt.
2. Yerler sekmesinde turuncu bant var mı?
3. Listende o kategoride ürün var mı? (Liste boşken market izlenmez — bu
   kasıtlı, pil tasarrufu için.)
4. Tanılama › "Seçili yere sahte GİRİŞ olayı" ile mantığı yürümeden test et.

### "Alarm çalmıyor, bildirim geliyor"

Ayarlar › İzinler › Alarmlar'a bak. "Bu cihazda kullanılamıyor" diyorsa
AlarmKit erişilemiyor demektir; uygulama otomatik olarak bildirime düşer.
Tanılama › Olay kaydı › Alarm filtresinde sebebi yazar.

### "Bildirimler gelmiyor"

Tanılama › **"5 sn sonra test bildirimi"**. Gelmiyorsa iOS Ayarları ›
Bildirimler › Anımsa'dan izinleri kontrol et.

### Bir şey ters gitti, ne oldu anlamıyorum

**Ayarlar › Gelişmiş › Tanılama** → filtreyi seç → **"Log'u paylaş"**.
Son 200 olay, her senkronun özeti ve her konum kararının sebebi orada.

---

## G. Önemli uyarılar

| Konu | Bilmen gereken |
|---|---|
| **İmza** | 7 günde bir dolar. Dolarsa uygulama açılmaz ama **veri silinmez**; yenileyince döner. Süre dolduğunda hatırlatmaların çalışması garanti değildir. |
| **Veri** | Uygulamayı **silersen tüm veriler gider** (otomatik yedek klasörü dahil). Düzenli olarak Ayarlar › Veri › Yedekle ile iCloud Drive'a kopyala. |
| **iOS güncellemesi** | Güncellemeden önce AltServer/AltStore'un sürüm notlarına bak; iOS güncellemeleri sideload araçlarını zaman zaman bozar. |
| **3 uygulama sınırı** | Ücretsiz hesapta aynı anda en fazla 3 sideload uygulama: AltStore + Anımsa + Anımsa Dev. |
| **App ID sınırı** | 7 günde en fazla 10 yeni App ID. Bu yüzden bundle ID'ler **asla değiştirilmez** ve uygulama uzantısı (widget vb.) eklenmez. |
| **Ağ** | Tüm çekirdek özellikler çevrimdışı çalışır. Yalnızca OpenStreetMap yer keşfi ve barkod adı araması internet ister. |

---

Kurulum bitti. Şimdi **docs/TEST_LISTESI.md**'yi aç ve maddeleri sırayla
yürüt — özellikle ⭐ işaretli olanları (sessiz modda alarm, gerçek market
ziyareti, evden çıkış, yedek geri yükleme, imza yenileme).
