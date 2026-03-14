# Finansçım - Kişisel Finans Yönetim Sistemi

**Finansçım**, Python tabanlı yönetim araçları ve Capacitor destekli modern bir Next.js mobil uygulamasından oluşan kapsamlı bir finans yönetim paketidir.

## 🚀 Öne Çıkan Özellikler

- **Varlık Yönetimi:** Nakit ve banka hesaplarınızı birden fazla para birimiyle (TRY, USD) takip edin.
- **Canlı Kur Dönüşümü:** USD varlıklarınız için otomatik canlı döviz kuru entegrasyonu.
- **İşlem Geçmişi:** Gelir ve giderlerinizi kategorize ederek kaydedin.
- **Borç/Alacak Takibi:** Borçlarınızı ve alacaklarınızı vadeleriyle birlikte yönetin.
- **Premium Mobil Deneyim:** Next.js ve Capacitor ile akıcı ve şık native uygulama deneyimi.

## 🆕 Son Güncellemeler (v1.1.0)
Uygulama genelinde yapılan büyük iyileştirmeler, hata düzeltmeleri ve yeni eklenen özellikler için lütfen [CHANGELOG.md](./CHANGELOG.md) dosyasını inceleyin.

## 🛠 Teknoloji Yığını

- **Mobil:** Next.js (React), Lucide Icons, Capacitor (Android).
- **Stil:** Özel karanlık tema (Vanilla CSS).
- **Veritabanı:** Firebase Firestore (Gerçek zamanlı senkronizasyon).
- **Araçlar:** Python (Firebase Admin SDK).

## 📁 Proje Yapıları

- `/mobile`: Next.js web uygulaması ve Android proje dosyaları.
- `finance_app.py`: Veri yönetimi için ana Python mantığı.
- `add_expenses.py`: Toplu işlem ekleme yardımcı aracı.

## ⚙️ Kurulum ve Çalıştırma

### Mobil Uygulama
1. `/mobile` dizinine gidin.
2. `npm install` ile paketleri kurun.
3. Geliştirme modu: `npm run dev`
4. Telefonuna yükle: `./deploy-to-phone.ps1` (ADB gereklidir)

---
❤️ Finansal özgürlüğünüz için geliştirildi.
