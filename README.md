# Objectives Dashboard - GitHub Pages version

Энэ багц нь Google Sheets өгөгдлийг Apps Script API-аар уншиж, GitHub Pages дээр static dashboard хэлбэрээр ажиллана.

## 1. Apps Script backend

1. Google Sheet дээрээ `Extensions > Apps Script` нээнэ.
2. `apps-script/Code.gs` файлын кодыг `Code.gs` рүү хуулж тавина.
3. Save дарна.
4. `getInitialData` функцийг Run хийж permission өгнө.
5. `Deploy > New deployment > Web app` сонгоно.
6. Execute as: `Me`
7. Who has access: `Anyone` эсвэл `Anyone with the link`
8. Deploy хийж `/exec`-ээр төгссөн Web app URL авна.

## 2. GitHub Pages frontend

1. `assets/config.js` файлыг нээнэ.
2. `PASTE_APPS_SCRIPT_WEB_APP_URL_HERE` гэдгийг Apps Script web app URL-аар солино.
3. `index.html`, `assets/config.js`, `.nojekyll` файлуудыг GitHub repository-д upload хийнэ.
4. Repository `Settings > Pages` дээр Source: `Deploy from a branch`, Branch: `main`, Folder: `/root` гэж сонгоно.
5. Save хийсний дараа сайт тань `https://<username>.github.io/<repo>/` хаягаар ажиллана.

## Анхаарах зүйл

- GitHub Pages нь static hosting тул database шууд ажиллуулахгүй. Өгөгдөл Google Sheet дээр үлдэнэ.
- Apps Script нь backend/API болно.
- Frontend нь JSONP ашиглаж Apps Script API-тай холбогдоно.
- Хэрэв dashboard data уншихгүй бол Apps Script deployment access setting-ээ шалгана уу.
