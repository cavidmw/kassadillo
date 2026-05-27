# YouTube Kanal Ön İzleme Aracı

YouTube kanal banner, profil fotoğrafı, video kartları ve mobil/desktop görünümünü yayınlamadan önce test etmek için hazırlanmış kişisel ön izleme aracıdır.

## Lokal Çalıştırma

1. Proje klasöründe terminal açın.
2. Paketleri kurun:

```bash
npm install
```

3. Geliştirme sunucusunu başlatın:

```bash
npm run dev
```

4. Terminalde görünen `localhost` adresini tarayıcıda açın.

## Supabase Feedback Kurulumu

Feedback modalından gelen notlar Supabase üzerinde `feedback_notes` tablosuna kaydedilir. Frontend sadece Supabase `anon` key kullanır. `service_role` key asla frontend veya Vercel ortam değişkenlerine eklenmemelidir.

### 1. Supabase Projesi Oluşturma

1. [Supabase](https://supabase.com) hesabınıza girin.
2. `New project` butonuna basın.
3. Proje adı girin.
4. Güçlü bir database password belirleyin ve saklayın.
5. Bölge seçin ve projeyi oluşturun.

### 2. Tabloyu Oluşturma

1. Supabase panelinde projenizi açın.
2. Sol menüden `SQL Editor` bölümüne girin.
3. `New query` seçin.
4. Aşağıdaki SQL kodunu yapıştırıp `Run` butonuna basın.

```sql
create extension if not exists pgcrypto;

create table if not exists public.feedback_notes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  message text not null default '' check (char_length(message) <= 1200),
  page_path text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.feedback_notes enable row level security;

drop policy if exists "Anyone can send feedback" on public.feedback_notes;
create policy "Anyone can send feedback"
on public.feedback_notes
for insert
to anon
with check (
  char_length(name) between 1 and 80
  and char_length(message) <= 1200
);
```

Bu SQL dosya olarak da projede var: `supabase/feedback_notes.sql`.

### 3. RLS ve Güvenlik Mantığı

RLS açık kalmalı. Yukarıdaki policy sadece `anon` kullanıcıların yeni feedback eklemesine izin verir. Public `select`, `update` veya `delete` policy eklemeyin. Böylece site ziyaretçileri başkasının gönderdiği notları okuyamaz, değiştiremez veya silemez.

İsim ve not alanları frontend tarafında düz metne çevrilir. Kullanıcı HTML veya script yazsa bile çalıştırılmaz; Supabase tarafına metin olarak gider.

### 4. Supabase URL ve Anon Key Alma

1. Supabase projenizde `Project Settings` bölümüne girin.
2. `API` sayfasını açın.
3. `Project URL` değerini kopyalayın.
4. `Project API keys` içindeki `anon public` key değerini kopyalayın.

### 5. Vercel Environment Variables

Vercel projenizde şu iki değişkeni ekleyin:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Vercel ayarlarında:

1. Projeyi açın.
2. `Settings` bölümüne girin.
3. `Environment Variables` sayfasını açın.
4. Yukarıdaki iki değişkeni ekleyin.
5. `Production`, `Preview` ve `Development` için aktif bırakın.
6. Kaydedin ve projeyi yeniden deploy edin.

### 6. Vercel Deploy

Vercel proje ayarlarında build komutu:

```bash
npm run build
```

Output directory:

```bash
dist
```

Deploy bittikten sonra siteyi açın, sağdaki alt feedback butonuna basın, isim ve not yazıp gönderin.

### 7. Gelen Notları Nereden Görürüm?

En kolay yol:

1. Supabase projenizi açın.
2. Sol menüden `Table Editor` bölümüne girin.
3. `feedback_notes` tablosunu seçin.
4. Gönderilen isim, not, sayfa bilgisi ve tarih burada görünür.

SQL ile görmek isterseniz `SQL Editor` bölümünde şunu çalıştırabilirsiniz:

```sql
select created_at, name, message, page_path
from public.feedback_notes
order by created_at desc;
```

## Lokal Env Testi

Kendi bilgisayarınızda Supabase kaydını test etmek için `.env.example` dosyasını `.env` adıyla kopyalayın ve değerleri doldurun. `.env` dosyası `.gitignore` içinde olduğu için repoya eklenmez.
