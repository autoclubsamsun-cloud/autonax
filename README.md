# Autonax Admin Panel — v2.0

Premium araç koruma platformu yönetim paneli. Next.js 14 + TypeScript ile geliştirilmiştir.

---

## 🚀 Hızlı Başlangıç

```bash
# Bağımlılıkları kur
npm install

# .env dosyasını oluştur
cp .env.example .env.local

# Geliştirme modunda başlat
npm run dev
```

`http://localhost:3000` → otomatik `/admin/dashboard` yönlendirir.

**Demo Giriş:** `admin` / `admin123`

---

## 📁 Proje Yapısı

```
autonax/
├── app/
│   ├── layout.tsx                  # Root layout (font, meta)
│   ├── page.tsx                    # / → /admin/dashboard yönlendirme
│   ├── api/
│   │   ├── randevular/route.ts     # GET/POST/PUT/DELETE
│   │   ├── fiyatlar/route.ts       # GET/PUT
│   │   ├── personel/route.ts       # GET/POST/PUT/DELETE
│   │   ├── bayiler/route.ts        # GET/POST/PUT/DELETE
│   │   ├── musteriler/route.ts     # GET
│   │   ├── rapor/route.ts          # GET
│   │   ├── ayarlar/route.ts        # GET/PUT
│   │   ├── odeme/route.ts          # POST (gateway)
│   │   └── edm/route.ts            # GET/POST (e-fatura)
│   └── pages/
│       ├── auth/login.tsx          # Login sayfası
│       └── admin/
│           ├── layout.tsx          # Auth guard + sidebar + header
│           ├── dashboard/page.tsx  # Dashboard
│           ├── randevular/page.tsx # Randevu yönetimi
│           ├── musteriler/page.tsx # Müşteri listesi
│           ├── hizmetler/page.tsx  # Hizmet geçmişi
│           ├── fiyatlar/page.tsx   # Ürün & fiyat yönetimi
│           ├── raporlar/page.tsx   # Analitik & raporlar
│           ├── bayiler/page.tsx    # Bayi yönetimi
│           └── ayarlar/page.tsx    # Sistem ayarları
├── components/
│   ├── layout/
│   │   ├── Header.tsx              # Üst bar
│   │   └── Sidebar.tsx             # Sol menü (nav linkleri)
│   └── ui/
│       ├── Modal.tsx               # Yeniden kullanılabilir modal
│       ├── StatCard.tsx            # Dashboard stat kartı
│       └── Toast.tsx               # Global bildirim sistemi
├── lib/
│   ├── types.ts                    # Tüm TypeScript interface'leri
│   ├── data/
│   │   ├── randevular.ts           # Demo randevu verisi
│   │   ├── urunler.ts              # Ürün & kategori verisi
│   │   ├── bayiler.ts              # Demo bayi verisi
│   │   └── personel.ts             # Demo personel & rol verisi
│   ├── hooks/
│   │   └── useStore.ts             # localStorage-backed state hook
│   └── utils/
│       ├── auth.ts                 # Oturum yönetimi
│       ├── format.ts               # Para, tarih formatlama
│       └── storage.ts              # localStorage wrapper (SSR safe)
├── styles/
│   └── globals.css                 # Tüm CSS (design system)
├── public/
│   ├── assets/
│   │   ├── placeholder-car.svg
│   │   └── placeholder-urun.svg
│   └── icons/
│       ├── favicon.svg
│       ├── logo.svg
│       └── ppf-shield.svg
├── config/
│   └── constants.ts                # Route, API, sabit değerler
├── next.config.js
├── tsconfig.json
├── vercel.json
└── .env.example
```

---

## ☁️ Vercel Deploy

### 1. GitHub'a Push

```bash
git init
git add .
git commit -m "feat: autonax panel v2"
git remote add origin https://github.com/kullanici/autonax-panel.git
git push -u origin main
```

### 2. Vercel'e Bağla

1. [vercel.com](https://vercel.com) → "New Project"
2. GitHub repo'yu seç
3. Framework: **Next.js** (otomatik algılar)
4. Environment Variables ekle:

```
NEXT_PUBLIC_APP_URL=https://panel.autonax.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=guclu-sifre-buraya
JWT_SECRET=cok-gizli-key-buraya
```

5. Deploy →  ✅

### 3. Custom Domain (opsiyonel)

Vercel Dashboard → Domains → `panel.autonax.com` ekle → DNS kaydı güncelle.

---

## 🔌 API Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/randevular` | Tüm randevular (filtre: ?tarih=, ?durum=, ?q=) |
| POST | `/api/randevular` | Yeni randevu |
| PUT | `/api/randevular` | Randevu güncelle |
| DELETE | `/api/randevular?id=` | Randevu sil |
| GET | `/api/fiyatlar` | Tüm ürün & kategoriler |
| PUT | `/api/fiyatlar` | Fiyat güncelle |
| GET | `/api/personel` | Personel listesi |
| POST | `/api/personel` | Personel ekle |
| PUT | `/api/personel` | Personel güncelle |
| DELETE | `/api/personel?id=` | Personel sil |
| GET | `/api/bayiler` | Bayi listesi |
| POST | `/api/bayiler` | Bayi ekle |
| PUT | `/api/bayiler` | Bayi güncelle |
| DELETE | `/api/bayiler?id=` | Bayi sil |
| GET | `/api/musteriler?q=` | Müşteri listesi |
| GET | `/api/rapor?donem=` | Rapor özeti |
| GET/PUT | `/api/ayarlar` | Site ayarları |
| POST | `/api/odeme` | Ödeme linki oluştur |
| GET/POST | `/api/edm` | e-Fatura bağlantı / kesme |

---

## 🗄️ Veritabanı (Production)

Şu an **localStorage** (client-side) + **in-memory** (API). Production için:

```bash
# PostgreSQL ile Prisma
npm install prisma @prisma/client
npx prisma init
```

`lib/data/*.ts` dosyalarındaki STORE değişkenlerini Prisma sorgularıyla değiştir.

Önerilen: **Vercel Postgres** (tek tıkla bağlantı) ya da **PlanetScale** (MySQL).

---

## 🔐 Güvenlik

- Şu an localStorage-based session (demo)
- Production için: **NextAuth.js** veya **Clerk** entegrasyonu önerilir
- API route'larına middleware ekle: `middleware.ts`

```ts
// middleware.ts (root)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const token = req.cookies.get('autonax_auth');
  if (req.nextUrl.pathname.startsWith('/admin') && !token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*', '/api/:path*'] };
```

---

## 📦 Bağımlılıklar

- **Next.js 14** — App Router, Server Components
- **TypeScript 5** — Tam tip güvenliği
- **React 18** — Hooks, Suspense
- **js-cookie** — Cookie yönetimi
- **uuid** — ID üretimi

---

## 🎨 Tasarım Sistemi

CSS Variables (`styles/globals.css`):

| Değişken | Değer | Kullanım |
|----------|-------|---------|
| `--r` | `#B01C2E` | Ana renk (kırmızı) |
| `--ink` | `#0D0D0D` | Koyu metin |
| `--bg` | `#F2F2F2` | Arka plan |
| `--bd` | `#E0E0E0` | Border |
| `--green` | `#16A34A` | Başarı |
| `--amber` | `#D97706` | Uyarı |
| `--blue` | `#2563EB` | Bilgi |

Font: **Outfit** (normal) + **Bebas Neue** (başlıklar)

---

## 🌐 URL Yapısı

| URL | Sayfa | Açıklama |
|-----|-------|----------|
| `/` | Ana Site | `desktop.html` → PPF/Seramik katalog |
| `/hesabim` | Müşteri Paneli | Garajım, randevular, profil |
| `/admin/dashboard` | Admin Dashboard | Stat kartları, bugünkü randevular |
| `/admin/randevular` | Randevu Yönetimi | Filtre, ödeme al, detay |
| `/admin/musteriler` | Müşteri Listesi | Tüm müşteriler |
| `/admin/hizmetler` | Hizmet Geçmişi | Tamamlanan işlemler |
| `/admin/fiyatlar` | Fiyat Yönetimi | PPF, Seramik, Bakım ürünleri |
| `/admin/raporlar` | Raporlar | Gelir, hizmet analitiği |
| `/admin/bayiler` | Bayi Yönetimi | Bayi CRUD, indirim oranları |
| `/admin/ayarlar` | Ayarlar | Personel, SEO, Ödeme, EDM |
| `/panel` | → Admin Panel | Yönlendirme |
| `/login` | Admin Girişi | `admin` / `admin123` |
| `/api/randevular` | REST API | GET/POST/PUT/DELETE |
| `/api/fiyatlar` | REST API | GET/PUT |

## 📂 standalone/ Klasörü

`/public/standalone/` dizininde çalışır-açılır HTML dosyaları:

| Dosya | Açıklama |
|-------|----------|
| `desktop.html` | Ana müşteri sitesi (386KB) |
| `hesabim.html` | Müşteri paneli (57KB) |
| `panel.html` | Admin panel — tek dosya (359KB) |

Bu dosyalar Next.js build gerektirmez, direkt tarayıcıda açılabilir.
Vercel'e deploy edildiğinde `/standalone/desktop.html` vb. URL ile erişilir.
