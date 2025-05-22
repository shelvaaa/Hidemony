Untuk menjalankan stegano hidemony ini diperlukan konfigurasi ulang Spotify agar tidak REDIRECT_URI, Berikut merupakan langkah langkah konfigurasi nya : 
1. buka https://developer.spotify.com/dashboard lalu login menggunakan akun spotify anda
2. klik 'create app' untuk mengkonfigurasikan aplikasi dengan Spotify
3. Isi Redirect URIs dengan 'http://127.0.0.1:5500/index.html'
4. Setelah terbuat sesuaikan Client ID dan Secret Client yang di dapatkan dari spotify api yang telah kamu buat dengan Client ID dan Secret Client dengan kode yang ada di file script.js line 2-4.
