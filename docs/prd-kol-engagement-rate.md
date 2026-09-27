# PRD — KOL Engagement Rate & Campaign Performance

| Dokumen      | Detail                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Produk       | KOL ER / Campaign Reporting                                                                                        |
| Status       | Draft v1.0                                                                                                         |
| Bahasa       | Indonesia                                                                                                          |
| Tujuan rilis | Menyimpan baseline kualitas KOL sebelum approach dan mengukur hasil aktual setelah konten campaign dipublikasikan. |

## 1. Latar belakang

Tim KOL membutuhkan dua jenis data yang menjawab pertanyaan berbeda:

1. **Seberapa baik kualitas engagement KOL sebelum dihubungi?** Data ini dipakai untuk seleksi dan negosiasi.
2. **Seberapa baik performa konten campaign setelah diposting?** Data ini dipakai untuk evaluasi hasil campaign.

Saat ini ER sebelum approach dapat dilihat melalui layanan seperti Social Blade untuk YouTube, tetapi aksesnya terbatas untuk pengecekan dalam jumlah besar. Selain itu, metrik setelah posting berasal dari performa aktual konten, sehingga tidak boleh menggantikan data awal KOL.

Produk harus menyimpan kedua data sebagai dataset dan snapshot yang berbeda, lalu menyajikannya bersama dalam report campaign.

## 2. Tujuan dan non-tujuan

### Tujuan

- Menyimpan **Total ER Before Approach** sebagai baseline KOL yang terikat pada waktu pengambilan data.
- Mencatat metrik performa aktual untuk setiap konten campaign setelah diposting.
- Menghitung **ER konten** dari metrik aktual dengan rumus yang transparan.
- Menyediakan report pada level konten, KOL dalam campaign, dan total campaign.
- Menjaga histori: pembaruan data baru membuat snapshot/rekaman baru, bukan menimpa baseline atau laporan lama.

### Non-tujuan v1

- Menjamin scraping atau akses tanpa batas dari Social Blade maupun platform lain.
- Menggantikan dashboard analytics native Instagram, TikTok, YouTube, atau platform sosial lainnya.
- Mengotomasi pembayaran, kontrak, atau approval KOL.
- Menentukan benchmark ER industri secara otomatis.

## 3. Pengguna dan kebutuhan utama

| Pengguna                 | Kebutuhan                                                        |
| ------------------------ | ---------------------------------------------------------------- |
| KOL/Influencer Executive | Membandingkan kualitas kandidat KOL sebelum menghubungi mereka.  |
| Campaign Manager         | Melihat status posting dan hasil aktual tiap deliverable.        |
| Account/Client Team      | Mengunduh atau membagikan ringkasan performa campaign.           |
| Admin                    | Mengatur sumber data, definisi ER, dan hak akses perubahan data. |

## 4. Definisi utama

| Istilah                            | Definisi                                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| KOL                                | Creator/influencer yang dapat diikutkan dalam campaign. Satu KOL dapat memiliki banyak akun platform.    |
| Akun KOL                           | Identitas KOL pada satu platform, mis. channel YouTube atau handle Instagram.                            |
| Baseline / Before Approach         | Snapshot data akun KOL yang diambil sebelum outreach pertama terkait campaign.                           |
| Deliverable                        | Konten yang wajib dibuat KOL untuk sebuah campaign. Satu KOL dapat memiliki lebih dari satu deliverable. |
| Actual performance / After Posting | Metrik yang benar-benar dicapai suatu konten setelah dipublikasikan.                                     |
| Snapshot                           | Rekaman metrik pada satu waktu tertentu. Snapshot lama bersifat immutable.                               |
| Reach                              | Jumlah akun unik yang melihat konten, jika tersedia dari platform. Bukan sinonim views.                  |

## 5. Lingkup fungsional

### 5.1. Profil KOL dan akun platform

Sistem harus dapat menyimpan:

- profil KOL: nama, kategori, kontak, status, catatan internal;
- akun per platform: platform, handle/channel URL, display name, follower/subscriber count, dan status verifikasi;
- hubungan satu KOL ke banyak akun serta satu akun hanya dimiliki satu KOL dalam sistem;
- status kelengkapan data baseline per akun.

### 5.2. Baseline ER sebelum approach

Pada saat KOL akan di-approach untuk campaign, user dapat membuat baseline dari data awal akun KOL.

Data minimum baseline:

| Field                                    | Wajib               | Keterangan                                                                                      |
| ---------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| Campaign                                 | Ya                  | Campaign yang memicu assessment.                                                                |
| KOL dan akun platform                    | Ya                  | Identitas akun yang dinilai.                                                                    |
| Waktu pengambilan                        | Ya                  | Tanggal dan jam snapshot.                                                                       |
| Followers/subscribers                    | Ya                  | Jumlah audiens saat data diambil.                                                               |
| Jumlah konten yang dianalisis            | Ya                  | Contoh: 12 posting/video terakhir.                                                              |
| Rata-rata views/reach                    | Sesuai platform     | Denominator pilihan bila follower tidak digunakan.                                              |
| Rata-rata likes, comments, shares, saves | Sesuai ketersediaan | Komponen engagement yang tersedia.                                                              |
| ER baseline                              | Ya                  | Nilai persen hasil perhitungan atau nilai referensi yang diinput.                               |
| Sumber dan bukti                         | Ya                  | Manual, Social Blade, platform analytics, API, atau CSV; simpan URL/berkas/notes bila tersedia. |
| Diinput oleh                             | Ya                  | User yang membuat snapshot.                                                                     |

Aturan bisnis:

1. Setelah baseline disimpan dan KOL sudah berstatus `Approached`, data tersebut **tidak boleh diedit atau dihapus** oleh user biasa.
2. Koreksi dilakukan dengan membuat snapshot baseline baru berstatus `Corrected`, yang menyimpan referensi ke snapshot sebelumnya dan alasan koreksi.
3. Campaign selalu menampilkan baseline yang aktif/terpilih, tetapi report audit dapat menampilkan seluruh versinya.
4. Jika satu KOL memiliki beberapa platform, baseline dihitung dan disimpan per akun/platform; agregat KOL hanya ditampilkan jika basis perhitungannya sejenis.

### 5.3. Sumber baseline

V1 menyediakan jalur berikut, dengan prioritas pada jejak audit daripada otomasi:

| Metode                          | Status v1               | Perilaku                                                                              |
| ------------------------------- | ----------------------- | ------------------------------------------------------------------------------------- |
| Input manual                    | Wajib                   | User memasukkan angka dan menyertakan sumber/notes.                                   |
| Impor CSV                       | Wajib                   | Mengimpor banyak baseline sekaligus dan menghasilkan error report per baris.          |
| Social Blade URL/reference      | Wajib sebagai referensi | URL dapat disimpan sebagai bukti; sistem tidak menjanjikan pengambilan data otomatis. |
| API platform / API pihak ketiga | Fase lanjutan           | Data masuk sebagai snapshot baru dan diberi label sumber otomatis.                    |

Catatan: Social Blade dapat digunakan untuk screening YouTube, namun keterbatasan paket/kuota tidak boleh menghambat input manual atau impor massal.

### 5.4. Pencatatan actual metrics setelah posting

Setiap deliverable harus memiliki record konten terpisah, dengan data berikut:

| Field                            | Wajib                        | Keterangan                                             |
| -------------------------------- | ---------------------------- | ------------------------------------------------------ |
| Campaign, KOL, akun, deliverable | Ya                           | Konteks konten.                                        |
| Platform dan URL konten          | Ya setelah tayang            | URL unik/ID konten dipakai untuk mencegah duplikasi.   |
| Waktu posting                    | Ya setelah tayang            | Timestamp publikasi.                                   |
| Waktu pengambilan metrik         | Ya                           | Timestamp snapshot performa.                           |
| Views                            | Ya bila tersedia             | Total tayangan pada snapshot.                          |
| Reach                            | Opsional                     | Audiens unik bila platform menyediakan.                |
| Likes, comments, shares, saves   | Sesuai platform              | Angka aktual pada snapshot.                            |
| ER konten                        | Ya bila denominator tersedia | Dihitung otomatis.                                     |
| Sumber data dan bukti            | Ya                           | Manual, screenshot, CSV, platform analytics, atau API. |

User dapat menambahkan snapshot berkala (mis. H+1, H+7, H+30). Dashboard menampilkan snapshot terbaru secara default, sedangkan report final mengunci snapshot yang dipilih saat campaign ditutup.

### 5.5. Report campaign

Report harus menyediakan tabel per konten dengan kolom:

- KOL dan akun/platform
- Deliverable dan URL konten
- Tanggal posting
- Views
- Reach
- Likes
- Comments
- Shares
- Saves
- Total engagement
- ER konten
- Waktu pengambilan data dan sumber

Report ringkasan campaign harus menampilkan total dan agregat:

| Metrik                                       | Aturan agregasi                                                                                                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Views, reach, likes, comments, shares, saves | `SUM` dari snapshot final setiap konten yang valid.                                                                                                                    |
| Total engagement                             | `likes + comments + shares + saves`; komponen yang tidak tersedia dicatat `N/A`, bukan otomatis nol.                                                                   |
| ER campaign                                  | `SUM(total engagement) / denominator campaign × 100`; denominator default adalah total views dari konten yang memiliki views.                                          |
| Total ER Before Approach                     | Weighted ER dari baseline akun KOL yang terlibat. Default weight: followers/subscribers; bila basis baseline adalah average views/reach, gunakan denominator tersebut. |
| Coverage data                                | Jumlah deliverable dengan metrik lengkap dibanding total deliverable.                                                                                                  |

Report wajib dapat difilter menurut campaign, platform, KOL, periode posting, dan status data. Data dapat diekspor CSV; ekspor PDF dapat menjadi fase lanjutan.

## 6. Rumus dan aturan perhitungan

### 6.1. Total engagement konten

`Total engagement = likes + comments + shares + saves`

Jika metrik tidak disediakan platform, nilainya diperlakukan sebagai `N/A`. Sistem harus menunjukkan komponen yang tidak tersedia dan tidak menyamakan `N/A` dengan `0`.

### 6.2. ER konten (after posting)

Prioritas denominator:

1. `Reach`, jika tersedia dan tervalidasi;
2. `Views`, jika reach tidak tersedia;
3. `Followers/subscribers saat posting`, hanya bila views dan reach tidak tersedia.

`ER konten (%) = total engagement / denominator × 100`

UI harus selalu mencantumkan basis ER, misalnya `ER by Reach`, `ER by Views`, atau `ER by Followers`. Konten tanpa denominator memiliki ER `N/A` dan dikecualikan dari perhitungan weighted ER.

### 6.3. ER baseline (before approach)

Rumus baseline mengikuti metode/sumber data yang dipilih. Untuk input manual, sistem menawarkan:

`ER baseline by followers (%) = average engagement per content / followers × 100`

`ER baseline by views (%) = average engagement per content / average views × 100`

`average engagement per content = average likes + average comments + average shares + average saves`

Sistem harus menyimpan `formula_version`, `denominator_type`, komponen yang digunakan, dan nilai input agar hasil dapat diaudit. Nilai ER dari pihak ketiga dapat disimpan sebagai `Referenced ER` dan tidak boleh dipresentasikan sebagai hasil kalkulasi internal tanpa penanda.

### 6.4. Agregasi yang benar

ER total tidak boleh dihitung dengan rata-rata aritmetika dari persentase ER tiap konten/KOL. Gunakan weighted ER:

`Weighted ER (%) = SUM(total engagement) / SUM(denominator) × 100`

Sistem hanya boleh menggabungkan record dengan basis denominator yang sama. Jika report mencampur basis (mis. reach dan views), tampilkan breakdown per basis serta label bahwa total tidak sepenuhnya comparable.

## 7. Data model konseptual

```text
KOL 1 ── * KOLAccount
Campaign 1 ── * CampaignKOL ── 1 KOL
CampaignKOL 1 ── * BaselineAssessment
CampaignKOL 1 ── * Deliverable
Deliverable 1 ── 1 PublishedContent
PublishedContent 1 ── * PerformanceSnapshot
```

Entitas inti:

| Entitas                 | Field penting                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kol_accounts`          | `kol_id`, `platform`, `handle`, `profile_url`, `current_audience_count`                                                                                                                 |
| `campaign_kols`         | `campaign_id`, `kol_id`, `outreach_status`, `approached_at`                                                                                                                             |
| `baseline_assessments`  | `campaign_kol_id`, `account_id`, `captured_at`, `audience_count`, `averages`, `er_percent`, `denominator_type`, `source`, `evidence`, `version`, `supersedes_id`, `locked_at`           |
| `deliverables`          | `campaign_kol_id`, `platform`, `content_type`, `due_at`, `status`                                                                                                                       |
| `published_contents`    | `deliverable_id`, `content_url`, `platform_content_id`, `published_at`                                                                                                                  |
| `performance_snapshots` | `published_content_id`, `captured_at`, `views`, `reach`, `likes`, `comments`, `shares`, `saves`, `total_engagement`, `er_percent`, `denominator_type`, `source`, `evidence`, `is_final` |

Kunci dan integritas data:

- unik: `(platform, handle)` pada akun KOL;
- unik: `(platform, platform_content_id)` atau `(platform, content_url)` pada konten;
- tidak boleh ada dua snapshot `is_final = true` untuk satu konten;
- baseline dan performance snapshot adalah append-only; pembatalan memakai `voided_at` dan alasan, bukan hard delete;
- semua perubahan status/rekaman menyimpan `created_by`, `created_at`, dan audit event.

## 8. User flow

1. User membuat/menemukan profil KOL lalu menambahkan akun platform.
2. User membuat campaign dan memasukkan KOL sebagai kandidat.
3. Sebelum approach, user memasukkan atau mengimpor baseline ER dan bukti sumber.
4. Sistem menyimpan baseline snapshot, menghitung ER bila input mencukupi, lalu KOL dapat dipindahkan ke status `Approached`.
5. Setelah KOL publish, user membuat/menautkan konten ke deliverable.
6. User menginput atau mengimpor actual metrics berkala; sistem membuat performance snapshot dan menghitung ER konten.
7. Saat campaign ditutup, Campaign Manager memilih/menandai snapshot final per konten.
8. Sistem menghasilkan report campaign tanpa mengubah baseline before approach.

## 9. Hak akses dan audit

| Aksi                                     | Executive          | Campaign Manager  | Admin |
| ---------------------------------------- | ------------------ | ----------------- | ----- |
| Membuat baseline sebelum approach        | Ya                 | Ya                | Ya    |
| Mengubah baseline sebelum lock           | Ya (milik sendiri) | Ya                | Ya    |
| Membuat koreksi baseline terkunci        | Tidak              | Ya, dengan alasan | Ya    |
| Input actual metrics                     | Ya                 | Ya                | Ya    |
| Menandai snapshot final / tutup campaign | Tidak              | Ya                | Ya    |
| Mengubah formula/master data             | Tidak              | Tidak             | Ya    |
| Melihat audit trail                      | Terbatas           | Ya                | Ya    |

## 10. Acceptance criteria

1. User dapat menyimpan baseline ER untuk satu KOL–akun–campaign sebelum status `Approached`.
2. Setelah KOL berstatus `Approached`, baseline aktif tidak dapat ditimpa; koreksi membuat versi baru dan menyimpan alasan serta referensi versi lama.
3. User dapat mengunggah/import baseline massal dan menerima daftar baris yang gagal beserta alasannya.
4. User dapat memasukkan views, reach, likes, comments, shares, dan saves untuk setiap konten yang telah diposting.
5. Sistem menghitung total engagement dan ER konten otomatis, berikut label denominator yang digunakan.
6. Satu konten dapat memiliki beberapa performance snapshot tanpa mengubah snapshot lama.
7. Report campaign menampilkan baseline before approach terpisah dari actual performance after posting.
8. Total metrik campaign memakai snapshot final per konten dan Total ER menggunakan weighted calculation, bukan rata-rata ER sederhana.
9. Field yang tidak disediakan platform ditampilkan sebagai `N/A`, sedangkan nilai `0` berarti metrik memang bernilai nol.
10. Setiap angka di report dapat ditelusuri ke waktu snapshot, sumber, dan user/proses yang memasukkannya.

## 11. Kebutuhan non-fungsional

- **Auditability:** semua snapshot dan perubahan status memiliki timestamp, actor, sumber, dan bukti/notes.
- **Data integrity:** validasi angka non-negatif, ER 0–1000% (warning bila di atas threshold konfigurasi), serta validasi URL/platform.
- **Performance:** halaman report campaign dengan hingga 500 konten dimuat dalam maksimal 3 detik pada koneksi normal setelah data tersedia.
- **Security:** bukti/screenshot hanya dapat diakses oleh role berwenang; data kontak KOL tidak tampil di report client secara default.
- **Localization:** angka ditampilkan dengan locale Indonesia, sementara penyimpanan menggunakan numeric tanpa format.

## 12. KPI keberhasilan

- ≥90% KOL yang di-approach memiliki baseline ER dan sumber data tercatat.
- ≥95% deliverable published memiliki performance snapshot final saat campaign ditutup.
- Waktu membuat report campaign turun dibanding proses spreadsheet manual.
- 0 kasus baseline before approach hilang/tertukar akibat pembaruan actual metrics.

## 13. Pertanyaan keputusan sebelum implementasi

1. Platform mana yang masuk MVP: YouTube saja, atau Instagram/TikTok juga?
2. Apakah report client boleh menampilkan baseline ER per KOL, atau hanya agregat campaign?
3. Berapa checkpoint default untuk performance snapshot (mis. H+1, H+7, H+30)?
4. Apakah input actual metrics harus didukung bukti screenshot untuk seluruh platform, atau hanya saat input manual?
5. Siapa yang berwenang memilih snapshot final ketika angka terus bertumbuh setelah campaign selesai?

## 14. Rencana fase

| Fase   | Cakupan                                                                                                                                  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| MVP    | Profil akun, baseline manual/CSV, deliverable & konten, actual metrics manual/CSV, ER otomatis, snapshot, report tabel/CSV, audit trail. |
| Fase 2 | Integrasi API yang diizinkan, upload screenshot/bukti, dashboard trend H+1/H+7/H+30, template report client.                             |
| Fase 3 | Benchmark kategori/platform, quality score KOL, alert data tidak lengkap, dan konektor data pihak ketiga.                                |
