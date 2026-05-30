# Vampir Köylü 🧛

Çok oyunculu gerçek zamanlı sosyal çıkarım oyunu. Among Us tarzı 6 haneli oda kodu sistemi.

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript
- **Backend**: NestJS + Socket.io
- **Veritabanı**: Redis (in-memory, 24h TTL)
- **Deploy**: Docker Compose

## Oyun Akışı

1. **Lobi**: Oda oluştur veya 6 haneli kodla katıl
2. **Karakter Seçimi**: Oda sahibi karakterleri ayarlar
3. **Rol Dağıtımı**: Oyun başlayınca roller gizlice dağıtılır
4. **Gündüz**: Tartışma + Oylama (seçilen kişi elimine edilir)
5. **Gece**: Her rol kendi aksiyonunu yapar
6. **Sabah**: Gece sonuçları açıklanır
7. **Tekrar**: Ta ki bir taraf kazanana kadar

## Karakterler

| Karakter | Takım | Yetenek |
|----------|-------|---------|
| 🧑‍🌾 Köylü | İyi | Oylama ile vampiri bul |
| 🧛 Vampir | Kötü | Gece köylü öldür |
| 🕵️ Dedektif | İyi | Gece sorgula (vampir mi?) |
| 👨‍⚕️ Doktor | İyi | Gece birini koru |
| 🧙‍♀️ Cadı | İyi | 1x öldür / 1x koru iksiri |
| 🏹 Avcı | İyi | Ölünce birini vurur |
| 🃏 Joker | Nötr | Linç edilmek ister |
| 🐺 Hizmetkar | Kötü | Vampirleri bilir ama vampir değil |

## Kurulum & Deployment

### Gereksinimler
- Docker & Docker Compose
- VPS (Ubuntu önerilir)

### 1. Repoyu klonla
```bash
git clone <repo-url>
cd inceaga-vampirlemesi
```

### 2. .env dosyasını oluştur
```bash
cp .env.example .env
# .env içindeki YOUR_VPS_IP'yi değiştir
```

### 3. Docker Compose ile başlat
```bash
docker-compose up -d --build
```

### Portlar
- **80** → Frontend (React)
- **3001** → Backend (NestJS + Socket.io)
- **6379** → Redis (internal)

### Loglar
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Durdur
```bash
docker-compose down
```

## Yerel Geliştirme

```bash
# Redis
docker run -d -p 6379:6379 redis:7-alpine

# Backend
cd backend
npm install
npm run start:dev

# Frontend (ayrı terminal)
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:3001

## Oyun Kuralları

- **Minimum**: 4 oyuncu
- **Maximum**: 20 oyuncu  
- **Kazanma koşulları**:
  - İyiler: Tüm vampirler elimine edilirse
  - Kötüler: Vampir sayısı ≥ iyi oyuncu sayısı
  - Joker: Oylama ile linç edilirse
