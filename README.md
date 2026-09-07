# ModRock (PixelMods) — Vercel Kurulum Rehberi

Bu proje **paylaşımlı** çalışır: bir ziyaretçi mod/texture pack eklediğinde,
siteye giren herkes aynı listeyi görür. Veriler tarayıcıda değil, Vercel'in
bulut veritabanında (**Vercel KV**) ve görseller **Vercel Blob**'da tutulur.

İçerik ekleyip kaldırabilmek artık gerçek bir **hesap sistemine** bağlı:
kullanıcılar e-posta (gmail) + şifre ile kayıt olur/giriş yapar.

## Proje yapısı

```
index.html      → Sitenin tamamı (tek dosya, statik olarak sunulur)
api/items.js    → İçerik listesini okuma/ekleme/indirme sayısı/silme (Vercel KV)
api/upload.js   → Simge görseli yükleme (Vercel Blob) — girişli kullanıcı gerektirir
api/auth.js     → Kayıt / giriş / çıkış / oturum doğrulama (Vercel KV)
package.json    → @vercel/kv ve @vercel/blob bağımlılıkları
```

## Kurulum adımları

### 1. Projeyi Vercel'e bağla
- Bu klasörü bir GitHub reposuna at, ya da doğrudan Vercel CLI ile deploy et:
  ```
  npm i -g vercel
  vercel
  ```
- Vercel projeyi "Other" (framework yok) olarak algılar; `api/` klasörünü otomatik
  olarak serverless function'lara çevirir, geri kalan dosyaları statik olarak sunar.

### 2. Vercel KV (veritabanı) oluştur
1. Vercel Dashboard → projen → **Storage** sekmesi.
2. **Create Database → KV** seç, bir isim ver, oluştur.
3. Oluşan KV veritabanını projenle **Connect** et.
4. Bu adım `KV_REST_API_URL` ve `KV_REST_API_TOKEN` ortam değişkenlerini
   otomatik olarak projene ekler — elle bir şey yazmana gerek yok.

### 3. Vercel Blob (görsel depolama) oluştur
1. Aynı **Storage** sekmesinde **Create Database → Blob** seç.
2. Projenle **Connect** et.
3. Bu da `BLOB_READ_WRITE_TOKEN` değişkenini otomatik ekler.

### 4. Yeniden deploy et
Storage bağlantılarını ekledikten sonra projeyi bir kez daha deploy et
(Dashboard'dan "Redeploy" ya da `vercel --prod`), böylece yeni ortam
değişkenleri fonksiyonlara yansır.

### 5. (Opsiyonel) Yerel geliştirme
```
vercel env pull .env.local   # KV ve Blob değişkenlerini yerele çeker
vercel dev                   # localde çalıştırır, api/ fonksiyonları da çalışır
```
`index.html`'i doğrudan çift tıklayarak açarsan `/api/...` istekleri çalışmaz —
bu proje bir sunucu (Vercel) üzerinde çalışacak şekilde tasarlandı.

## Hesap sistemi nasıl çalışıyor

- **Kayıt:** kullanıcı e-posta + şifre girer. Şifre asla düz metin olarak
  saklanmaz — sunucuda rastgele bir salt ile `scrypt` kullanılarak hash'lenir
  ve yalnızca bu hash Vercel KV'de `account:<e-posta>` anahtarı altında tutulur.
- **Tekil hesap kuralı:** aynı e-posta ile ikinci bir kayıt denemesi sunucu
  tarafında reddedilir (`Bu e-posta ile zaten bir hesap var.`) — yani bir
  gmail adresiyle yalnızca bir hesap açılabilir.
- **Giriş:** girilen şifre, kayıtlı salt ile yeniden hash'lenip saklanan hash
  ile karşılaştırılır. Doğruysa `session:<token>` anahtarı altında 60 gün
  geçerli bir oturum jetonu (token) üretilir ve tarayıcıya döndürülür.
  Hesaba girmek için tek gereken bilgi e-posta ve şifredir; ekstra bir
  doğrulama (kod, e-posta linki vb.) istenmez.
- **Oturum:** tarayıcı bu jetonu `localStorage`'da tutar ve sayfa her
  açıldığında `GET /api/auth?token=...` ile jetonun hâlâ geçerli olup
  olmadığını sorar.
- **İçerik ekleme/silme/görsel yükleme:** bu üç işlem artık jeton ister;
  jeton geçersizse istek `401` ile reddedilir. Bir içeriği yalnızca onu
  ekleyen hesap (e-posta eşleşmesi) kaldırabilir.

## Neyin paylaşımlı, neyin kişisel olduğu

- **Paylaşımlı (herkes görür):** mod/texture pack/animasyon/vb. içerikler,
  indirme sayıları, simge görselleri, hesap kayıtları — hepsi Vercel KV/Blob'da,
  sunucu tarafında.
- **Kişisel (sadece o tarayıcıda kalır):** favoriler ve oturum jetonu.
  Bir ziyaretçinin favori listesi başka ziyaretçilere görünmez.

## Sınırlamalar

- Simge görselleri istemci tarafında **160px**'e küçültülüp JPEG'e çevrilir,
  sunucuda **2MB** ile sınırlıdır (Vercel serverless function'ların varsayılan
  istek boyutu sınırı ~4.5MB'dir).
- Yalnızca **PNG** ve **JPEG** kabul edilir (JPEG'e çevrilerek yüklenir).
- Şifre sıfırlama akışı yoktur (e-posta gönderimi gerektirir); şu an için
  şifresini unutan kullanıcı yeni bir hesap açamaz, çünkü e-postası zaten
  kayıtlıdır — bu özelliği eklemek istersen ayrıca bir "şifremi unuttum"
  akışı (e-posta gönderim servisi ile) kurulması gerekir.
- Liste; sekmeler arası geçişte otomatik tazelenir, ama gerçek zamanlı
  (anlık/websocket) değildir — biri içerik eklediğinde diğer ziyaretçiler
  sayfayı yenilediğinde ya da sekme değiştirdiğinde görür.
