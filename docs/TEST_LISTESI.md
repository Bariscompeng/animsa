# Cihaz Test Listesi

Bu maddeleri telefonda sırayla yürüt. Her maddede **ne yapacağın** ve
**ne beklemen gerektiği** yazıyor. Beklenen sonuç çıkmazsa
**Ayarlar › Gelişmiş › Tanılama** ekranını aç, "Log'u paylaş" ile kaydı al.

Otomatik testler (371 birim testi) CI'da her push'ta çalışıyor; burası yalnızca
gerçek cihazda doğrulanabilecek şeyler.

---

## A. Kurulum sonrası ilk kontroller

### A1 — Uygulama izinsiz açılıyor
1. Onboarding'de **her adımı "Şimdilik atla"** ile geç.
2. Dört sekmeyi de gez.

**Beklenen:** Hiçbir ekran çökmez. Yerler sekmesinde turuncu "Konum izni 'Her
Zaman' değil" bandı görünür.

### A2 — İzinler veriliyor
1. Ayarlar › İzinler → Bildirimler, Alarmlar, Konum, Kamera.
2. Konumda önce "Kullanırken", sonra satıra tekrar dokunup "Her Zaman".

**Beklenen:** Her satırın alt yazısı "İzin verildi" olur. Alarm satırı
"Bu cihazda kullanılamıyor" diyorsa AlarmKit yok demektir — alarmlar bildirime
düşer (bu bir hata değil, A6'ya bak).

### A3 — Test bildirimi
1. Ayarlar › Gelişmiş › Tanılama → **"5 sn sonra test bildirimi"**.
2. Uygulamayı kapat.

**Beklenen:** ~5 saniye sonra bildirim gelir.

---

## B. Görevler ve bildirimler

### B1 — Uygulama kapalıyken bildirim
1. Bugün sekmesinde alt satıra `1 dk sonra test` yaz, Enter.
2. Uygulamayı **app switcher'dan kaydırarak kapat**.

**Beklenen:** ~1 dakika sonra "Test" bildirimi gelir.

### B2 — Doğal dil ayrıştırma
Sırayla yaz ve her birinde çiplere bak:

| Yazılan | Beklenen çipler |
|---|---|
| `yarın 9'da ilaç` | 📅 Yarın · ⏰ 09:00 · 🔔 Bildirim |
| `her sabah 8'de vitamin` | 📅 Bugün · ⏰ 08:00 · 🔁 Her gün |
| `hafta içi 6:30 alarm kalk` | ⏰ 06:30 · 🔁 Hafta içi · 🔔 Alarm |
| `15 dk sonra çay` | ⏰ (şu an + 15 dk) |
| `her ayın 5'i kira` | 🔁 Her ayın 5. günü |

**Beklenen:** Başlıklar sırasıyla "İlaç", "Vitamin", "Kalk", "Çay", "Kira".
Ayrıştırılan kelimeler başlıkta kalmaz.

### B3 — Bildirim eylemleri
1. Saatli, bildirimli bir görev kur ve bildirimi bekle.
2. Bildirimi aşağı çek, **"Tamamlandı"**e bas.
3. Uygulamayı aç.

**Beklenen:** Görev Bugün listesinde görünmez (Tamamlananları göster ile
görülebilir). Aynısını "10 dk ertele" ile dene → görev 10 dakika sonraya taşınır
ve satırda "ertelendi" yazar.

### B4 — Kaydırma hareketleri
1. Bir görev satırını **sağa** kaydır.
2. Başka bir satırı **sola** kaydır.

**Beklenen:** Sağa = tamamlanır + titreşim. Sola = "Ertele" ve "Sil" düğmeleri
çıkar; Sil onay sorar.

### B5 — Tekrarlayan görevin tek oluşumu
1. `her gün 20:00 çöp` ekle.
2. Bugünkü oluşumu tamamla.

**Beklenen:** Yalnızca bugünkü kaybolur; "Yarın" bölümünde aynı görev durur.

### B6 — 50+ görevle akıcılık
1. 50'den fazla görev ekle (B2'deki gibi hızlıca).
2. Listeyi hızlı kaydır.

**Beklenen:** Takılma yok. Tanılama'da "Bekleyen bildirimler" sayısı **60'ı
geçmez** ve son senkron satırında "60/60 bütçe" yazar.

---

## C. Alarm

### C1 — Sessiz modda alarm ⭐
1. `2 dk sonra alarm test` yaz (veya tam formdan Hatırlatma = Alarm seç).
2. Telefonu **sessize al** (yan anahtar) ve **kilitle**.

**Beklenen:** 2 dakika sonra kilit ekranında tam ekran alarm çalar, "Durdur"
düğmesi görünür. **Sessiz mod alarmı susturmaz.**

### C2 — Tanılama test alarmı
Tanılama → **"1 dk sonra test alarmı"**.

**Beklenen:** 1 dakika sonra alarm çalar. İzin yoksa uyarı diyalogu çıkar ve
"Alarm kurulamadı, bildirime düşüldü" toast'u görünür.

### C3 — Bildirime düşüş görünür
1. Ayarlar › İzinler › Alarmlar → iOS Ayarları'ndan alarm iznini **kapat**.
2. Alarmlı bir görev kur, Tanılama'yı aç.

**Beklenen:** Olay kaydında "Alarm bildirime düşürüldü" satırı var; hatırlatma
yine de gelir (bildirim olarak).

### C4 — Haftalık alarm tekilleştirme
1. `hafta içi 7:00 alarm kalk` ekle.
2. Tanılama → "Kurulu alarmlar".

**Beklenen:** Tek bir alarm kaydı görünür (her gün için ayrı değil).

---

## D. Ev listesi

### D1 — Miktar ayrıştırma
Liste sekmesine sırayla yaz: `2 kg domates`, `3 süt`, `1 lt ayran`, `ekmek`.

**Beklenen:** Satırlarda "2 kg", "3 adet", "1 lt" yazar; "Ekmek" miktarsız.
Domates Manav, Süt "Süt & Kahvaltılık", Ekmek Fırın kategorisine düşer.

### D2 — Otomatik tamamlama ve Türkçe normalize
1. `sut` yaz (ı/ü olmadan).

**Beklenen:** Üstte "Süt" çipi çıkar; dokununca listeye eklenir.

### D3 — Alındı akışı ve geri alma
1. Listedeki bir ürüne dokun.
2. **5 saniye içinde** "Geri al"a bas.
3. Sonra başka bir ürüne dokun ve bekle.

**Beklenen:** İlkinde ürün listeye geri döner. İkincisinde 5 sn sonra listeden
düşer; ürünün detayında "Alım geçmişi" 1 artar.

### D4 — Reyon sırası
1. Ayarlar › Liste › Kategori sırası → bir kategoriyi yukarı taşı.
2. Liste sekmesine dön.

**Beklenen:** Gruplar yeni sıraya göre dizilir.

### D5 — Listeyi paylaş
Liste › "Paylaş".

**Beklenen:** iOS paylaşım sayfası açılır, düz metin liste içerir.

### D6 — Zamanlı liste hatırlatması, liste boşken
1. Ayarlar › Liste › Liste hatırlatmaları → birkaç dakika sonrası için kural
   ekle.
2. **Listeyi tamamen boşalt.**
3. Tanılama → Bekleyen bildirimler.

**Beklenen:** `list:` ile başlayan bildirim **yok**. Listeye bir ürün ekleyip
Tanılama'yı tazele → bildirim belirir.

---

## E. Barkod

### E1 — Katalogda olan barkod
1. Bir ürünü barkodla ekle (E2), sonra **aynı barkodu tekrar** okut.

**Beklenen:** Doğrudan listeye eklenir, titreşim ve toast; soru sorulmaz.

### E2 — Katalogda olmayan barkod, internet var
Liste › barkod simgesi → bilinmeyen bir ürün okut.

**Beklenen:** "Bu ürün mü?" ekranı, Open Food Facts'ten gelen adla. Düzeltip
"Listeye ekle" denebilir.

### E3 — İnternet yok
1. Uçak modunu aç.
2. Bilinmeyen bir barkod okut.

**Beklenen:** "Bu barkod tanınmadı. Ürünün adını yaz." — manuel giriş çalışır,
uygulama donmaz (5 sn zaman aşımı).

---

## F. Dolap ve son kullanma

### F1 — SKT hatırlatması
1. Bir ürüne git (Liste › Tüm Ürünler › ürün) → Son kullanma tarihi = **2 gün
   sonrası**.
2. Tanılama → Bekleyen bildirimler.

**Beklenen:** `expiry:` ile başlayan iki bildirim, biri yarın 09:00, biri
ertesi gün 09:00.

### F2 — Dolap görünümü
Liste › Dolap segmenti.

**Beklenen:** SKT'si olan ürünler en yakın tarih üstte; geçmiş tarihliler
kırmızı ve "geçmiş" etiketli.

---

## G. Konum ⭐

### G1 — Sahte GİRİŞ olayı, listede ürün varken
1. Yerler'e bir market ekle (Yer ekle → tür Market).
2. Listeye market kategorisinde bir ürün koy (ör. `süt`).
3. Tanılama → **"Seçili yere sahte GİRİŞ olayı"** → marketi seç.

**Beklenen:** Hemen bildirim gelir: "📍 … yakınında — … markete yakınsın —
listende 1 ürün var: Süt". Tanılama sonucu `notified`.

### G2 — Sahte GİRİŞ olayı, liste boşken
1. Listeyi boşalt.
2. Aynı sahte olayı tekrarla.

**Beklenen:** Bildirim **gelmez**. Tanılama sonucu `nothing-to-say` veya
`place-cooldown` (3 saat içinde ikinci deneme ise).

### G3 — Bölge seçimi liste boşken
1. Liste boşken Tanılama → "Bölgeleri yeniden seç".

**Beklenen:** Toast'ta izlenen bölge sayısı düşer; market bölgeleri izlenmez
(yalnızca Ev/İş ve rotasyon kalır).

### G4 — Gerçek market ziyareti ⭐
1. Listede market ürünü olsun.
2. Telefonu cebine koy, kayıtlı bir markete **yürüyerek/arabayla git**.

**Beklenen:** Markete yaklaşınca (1–3 dakika gecikme normaldir) bildirim gelir.
Uygulama kapalı olsa bile.

### G5 — Evden çıkış ⭐
1. Yerler'e evini **Ev** türüyle ekle (evdeyken "Konumumu kullan").
2. Ayarlar › Konum › Evden çıkarken listesi → maddeleri kontrol et.
3. Evden çık (en az 200 m uzaklaş).

**Beklenen:** "🚪 Evden çıkarken — Anahtar · Cüzdan · Telefon şarjı" bildirimi.

### G6 — Eve gelince
1. Bir göreve "Eve gelince hatırlat" işaretle.
2. Eve dön.

**Beklenen:** "🏠 Eve geldin" bildirimi, o görevin başlığıyla.

### G7 — Spam önleme
G1'i **arka arkaya üç kez** çalıştır.

**Beklenen:** Yalnızca ilki bildirim verir; sonrakiler `place-cooldown` veya
`global-cooldown` döner.

---

## H. Sessiz saatler ve özet

### H1 — Günlük özet
1. Ayarlar › Hatırlatmalar › Sessiz saatler → Özet saatini **birkaç dakika
   sonrasına** al.
2. Bekle.

**Beklenen:** "☀️ Günlük özet — Bugün N görev … · Listede N ürün" bildirimi.
İçerik o anki gerçek duruma uyuyor.

### H2 — Sessiz saat kaydırması
1. Sessiz saatleri **şu anı kapsayacak** şekilde ayarla (ör. başlangıç bir saat
   önce, bitiş bir saat sonra).
2. Bir ürüne yarın tarihli SKT ver.
3. Tanılama → Bekleyen bildirimler.

**Beklenen:** `expiry:` bildiriminin saati sessiz saat **bitişine** kaymış.

### H3 — Kullanıcı saati kaymaz
Sessiz saat içine düşen, **elle saat verilmiş** bir görev kur.

**Beklenen:** Bildirim tam verdiğin saatte kurulu (kaymamış).

---

## I. İmza bekçisi

### I1 — Kalan süre görünüyor
Ayarlar › İmza › "İmza geçerliliği".

**Beklenen:** "N gün M saat kaldı (tarih saat)". AltStore ile kurulmadıysa
"Bilinmiyor" yazar — bu bir hata değildir.

### I2 — AltStore açılıyor
Ayarlar › İmza › "AltStore'u aç".

**Beklenen:** AltStore açılır. Kurulu değilse açıklayıcı diyalog çıkar.

### I3 — Yenileme sonrası güncelleme ⭐
1. Kalan süreyi not et.
2. AltStore'da Anımsa'yı **Yenile**.
3. Anımsa'yı aç, Ayarlar › İmza'ya bak.

**Beklenen:** Kalan süre ~7 güne sıfırlanmış.

### I4 — Uyarı bandı
Süre 48 saatin altına düştüğünde Bugün sekmesini aç.

**Beklenen:** Üstte turuncu bant; dokununca AltStore açılır.

---

## J. Yedekleme ⭐

### J1 — Yedekle → değiştir → geri yükle
1. Ayarlar › Veri › **Yedekle** → Dosyalar'a kaydet.
2. Birkaç görev sil, birkaç ürün ekle.
3. Ayarlar › Veri › **Geri yükle** → kaydettiğin dosyayı seç.
4. Önizlemedeki sayıları kontrol et, onayla.

**Beklenen:** Veriler yedek anındaki hâline döner. Tüm hatırlatmalar yeniden
kurulur (Tanılama'da bekleyen bildirim sayısı dolu).

### J2 — Bozuk dosya reddediliyor
Geri yükle → rastgele bir JSON veya metin dosyası seç.

**Beklenen:** Türkçe hata mesajı; mevcut veriler **değişmez**.

### J3 — Otomatik yedek
Dosyalar uygulaması › iPhone'umda › Anımsa › Yedekler.

**Beklenen:** Haftalık anlık görüntüler burada (en fazla 4 tane).

---

## K. Derin bağlantılar ve Siri

### K1 — Listeye ekle
Safari'ye yaz: `animsa://ekle?urun=2 kg domates`

**Beklenen:** Anımsa açılır, Liste sekmesine gider, "Domates listeye eklendi"
toast'u, satırda "2 kg".

### K2 — Görev oluştur
`animsa://gorev?metin=yarın 9'da ilaç`

**Beklenen:** Bugün sekmesi açılır, yarın 09:00'a "İlaç" görevi eklenmiş.

### K3 — Siri kısayolu
KURULUM.md bölüm D'deki kısayolu kur, "Hey Siri, listeye ekle" de.

**Beklenen:** Siri metni sorar, söylediğin ürün listeye eklenir.

---

## L. Erişilebilirlik ve görünüm

### L1 — Karanlık mod
Ayarlar (iOS) › Ekran ve Parlaklık › Koyu.

**Beklenen:** Tüm ekranlar koyu temaya geçer; metinler okunabilir.

### L2 — Büyük yazı boyutu
Ayarlar (iOS) › Erişilebilirlik › Görüntülenen Boyut ve Metin Boyutu → en büyük.

**Beklenen:** Metinler büyür, taşma/kırpılma olmaz, düğmeler tıklanabilir kalır.

### L3 — VoiceOver
VoiceOver'ı aç, Bugün sekmesinde temel akışı dene.

**Beklenen:** Her ikon butonunun Türkçe adı okunur ("Barkod tara", "Tam formu
aç", "İlaç görevini tamamla" gibi). Tamamlama dairesi onay kutusu olarak
duyurulur.

---

## M. Dayanıklılık

### M1 — Uygulama tamamen kapalıyken hatırlatma
1. Birkaç saat sonrasına bildirimli görev kur.
2. Uygulamayı app switcher'dan kapat, telefonu bir süre kullanma.

**Beklenen:** Bildirim zamanında gelir.

### M2 — Saat dilimi değişimi
1. Ayarlar (iOS) › Genel › Tarih ve Saat → otomatiği kapat, başka bir saat
   dilimi seç.
2. Anımsa'yı aç, Tanılama → "Senkronu şimdi çalıştır".

**Beklenen:** "Her sabah 08:00" görevi hâlâ yerel 08:00'de kurulu.

### M3 — Tüm hatırlatmaları yeniden kur
Ayarlar › Gelişmiş › "Tüm hatırlatmaları yeniden kur".

**Beklenen:** Toast'ta kurulan sayı görünür; Tanılama'daki bekleyen bildirim
listesi dolu ve tutarlı.

---

## Sorun bildirimi

Bir madde başarısız olursa:

1. Tanılama ekranını aç.
2. İlgili filtreyi seç (Konum / Alarm / Hata).
3. **"Log'u paylaş"** → kendine gönder.

Log'da hangi kararın verildiği (`notified`, `quiet`, `place-cooldown`,
`nothing-to-say` …) ve her senkronun özeti yazılıdır.
