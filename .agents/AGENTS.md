# Autonax Projesi - Mobil Uygulama (Capacitor) Geliþtirme Notlarý

Bu projede mobil uygulama mimarisi, standart bir web sitesinin Capacitor ile sarmalanmýþ halidir (App Shell / WebView). Gelecekteki geliþtirmelerde veya hata çözümlerinde her zaman aþaðýdaki kurallara dikkat edilmelidir:

1. Canlý Baðlantý (Live URL): Mobil uygulama (APK/AAB), capacitor.config.ts dosyasýnda belirtilen canlý sunucuya (https://autonax.com.tr) doðrudan baðlýdýr. 
2. Anýnda Güncelleme: Web sitesi üzerinde (public/standalone/desktop.html, hesabim.html vb.) yapýlan herhangi bir HTML, CSS veya JS deðiþikliði, Vercel'de yayýna girdiði anda mobil uygulamaya da anýnda yansýr. Mobil uygulama için ayrýca APK derlemeye veya App Store/Play Store onayý beklemeye gerek yoktur.
3. Sert Önbellek (Aggressive Caching): Telefonlarýn dahili tarayýcý motorlarý (WebView) .html dosyalarýný çok agresif bir þekilde önbelleðe alýr (Cache). Bir kod güncellenmesine raðmen kullanýcý mobil uygulamada eski sürümü görüyorsa, bunun %100 sebebi WebView önbelleðidir. Çözüm olarak Android Ayarlar > Uygulamalar > Autonax > Depolama > Önbelleði Temizle iþlemi yapýlmalý veya Edge Cache'in süresinin dolmasý beklenmelidir. Uygulamayý sadece arka plandan kapatýp açmak önbelleði temizlemez.
4. Ortak Kod Tabaný: "Mobil Uygulama" ve "Mobil Tarayýcý" tamamen ayný kod tabanýný (desktop.html ve içindeki JS) kullanýr. Bu nedenle mobil tarayýcý için yapýlan hýzlandýrma veya tasarým iyileþtirmeleri doðrudan APK'ya da etki eder. Tasarým kararlarý alýrken iki tarafýn da ayný kodu tükettiði unutulmamalýdýr.
