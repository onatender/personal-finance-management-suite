import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import random
import os

# Firebase'e bağlanmak için servis hesabı anahtarı (JSON dosyası) gereklidir.
key_path = "serviceAccountKey.json"

if not os.path.exists(key_path):
    print(f"Hata: {key_path} dosyası bulunamadı!")
    print("Lütfen Firebase konsolundan indirdiğiniz JSON dosyasını bu klasöre '{key_path}' adıyla kopyalayın.")
    exit(1)

# Firebase'i başlat
cred = credentials.Certificate(key_path)
firebase_admin.initialize_app(cred)

db = firestore.client()

# Örnek veriler
kategoriler = ["Mutfak", "Ulaşım", "Eğlence", "Fatura", "Giyim", "Sağlık", "Teknoloji"]
aciklamalar = [
    "Market alışverişi",
    "Otobüs bileti",
    "Sinema bileti",
    "Elektrik faturası",
    "Yeni tişört",
    "Eczane harcaması",
    "Kulaklık",
    "Restoran yemeği",
    "Kitap alımı",
    "İnternet faturası"
]

def rastgele_harcama_ekle(adet=10):
    print(f"{adet} tane rastgele harcama ekleniyor...")
    
    for i in range(adet):
        harcama = {
            "açıklama": random.choice(aciklamalar),
            "kategori": random.choice(kategoriler),
            "fiyat": round(random.uniform(50.0, 1500.0), 2),
            "tarih": firestore.SERVER_TIMESTAMP # Opsiyonel: İzlenebilirlik için tarih eklendi
        }
        
        # 'harcamalar' koleksiyonuna ekle
        db.collection("harcamalar").add(harcama)
        print(f"Eklendi {i+1}/{adet}: {harcama['açıklama']} - {harcama['fiyat']} TL")

if __name__ == "__main__":
    try:
        rastgele_harcama_ekle(10)
        print("\nİşlem başarıyla tamamlandı!")
    except Exception as e:
        print(f"Bir hata oluştu: {e}")
