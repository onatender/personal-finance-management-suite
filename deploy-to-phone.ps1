Write-Host "--- 🚀 Baslatiliyor: Finansçım Build & Deploy ---" -ForegroundColor Cyan

# 1. Next.js Build
Write-Host "[1/5] Next.js projesi derleniyor..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Build hatası!"; exit $LASTEXITCODE }

# 2. Capacitor Sync
Write-Host "[2/5] Android dosyaları senkronize ediliyor..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) { Write-Error "Sync hatası!"; exit $LASTEXITCODE }

# 3. Java 21 -> 17 Fix
Write-Host "[3/5] Java versiyon uyumsuzlugu gideriliyor..." -ForegroundColor Yellow
./fix-java.ps1

# 4. Android Build (APK)
Write-Host "[4/5] APK dosyası oluşturuluyor..." -ForegroundColor Yellow
Set-Location android
./gradlew.bat assembleDebug
if ($LASTEXITCODE -ne 0) { Write-Error "Android build hatası!"; Set-Location ..; exit $LASTEXITCODE }
Set-Location ..

# 5. ADB Install & Launch
Write-Host "[5/5] Telefona yükleniyor ve başlatılıyor..." -ForegroundColor Yellow
$connectedDevice = adb devices | Select-String "\tdevice$"
if (-not $connectedDevice) {
	Write-Warning "Bağlı ve yetkili bir telefon bulunamadı. APK hazır: android/app/build/outputs/apk/debug/app-debug.apk"
	Write-Host "--- ✅ Build tamamlandı, kurulum cihaz bağlantısı bekliyor ---" -ForegroundColor Green
	exit 0
}

adb install -r android/app/build/outputs/apk/debug/app-debug.apk
if ($LASTEXITCODE -ne 0) { Write-Error "Yükleme hatası! Telefonun bağlı olduğundan emin olun."; exit $LASTEXITCODE }

adb shell monkey -p com.whatdoubuy.app -c android.intent.category.LAUNCHER 1

Write-Host "--- ✅ Başarıyla Tamamlandı! ---" -ForegroundColor Green
