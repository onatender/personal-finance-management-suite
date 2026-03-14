# Güncelleme Geçmişi (CHANGELOG)

Tüm son güncellemeler ve iyileştirmeler aşağıda listelenmiştir.

## [1.1.0] - 2026-03-15

### ✨ Yeni Özellikler
- **Marka Güncellemesi:** Uygulama ismi resmi olarak **Finansçım** olarak değiştirildi.
- **Borç/Alacak Girişi:** Borçlar sekmesine manuel olarak yeni borç veya alacak ekleme özelliği getirildi.
- **Gelişmiş Düzenleme:** İşlem düzenleme ekranına "Kategori" ve "Tür" (Gelir/Gider) değiştirme seçenekleri eklendi.
- **Özel Onay Modalları:** Silme işlemleri için tarayıcı bağımlılığını ortadan kaldıran, şık ve güvenli özel onay ekranları (Modals) eklendi.
- **Otomasyon Scriptleri:** Geliştiriciler için tek tıkla build ve telefona yükleme sağlayan `deploy-to-phone.ps1` scripti eklendi.

### 🎨 Görsel İyileştirmeler
- **Header Revizyonu:** Uygulama ismi ve sayfa başlıkları sola, ayarlar butonu sağa alınarak standart mobil hiyerarşisine geçildi.
- **Türkçe Yerelleştirme:** Tüm sekme ve buton isimleri Türkçeleştirildi (Özet, Varlıklarım, Geçmiş, Borçlar).
- **İkon Renkleri:** Kapatma ve ayarlar ikonları temaya uygun yumuşak gri tona (`var(--text-dim)`) güncellendi.
- **Varlık Özeti:** Varlıklar sekmesinde "Varlık", "Alacak" ve "Borç" kalemleri 3'lü sütun yapısında optimize edildi.

### 🔧 Teknik Düzeltmeler ve Optimizasyonlar
- **Para Birimi Standardı:** Uygulama genelinde 'TL' ibareleri 'TRY' olarak standardize edildi ve veritabanı otomatik migrate edildi.
- **Java Uyumluluğu:** Derleme (Build) sırasında yaşanan Java 21/17 uyumsuzluğu giderildi.
- **Zoom Koruması:** Mobil cihazlarda form girişlerinde veya çift tıklamada oluşan istenmeyen sayfa zoomlama özelliği kapatıldı.
- **Build Fix:** Capacitor senkronizasyonunda oluşan Java versiyon hatalarını otomatik düzelten `fix-java.ps1` entegre edildi.

---
*Finansçım - Kişisel Finans Yönetim Sistemi*
