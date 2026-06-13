# Objectives Dashboard v3.1

Энэ хувилбар нь одоогийн GitHub Pages + Google Apps Script dashboard дээр дараах сайжруулалтуудыг нэмсэн.

## Шинэ боломжууд

- Manager summary card
- Due soon window сонголт: 7, 14, 30, 90, 180 хоног
- Recent updates / Change_Log харах хэсэг
- Copy summary товч
- Export CSV товч
- Sidebar дээр Update objective болон Search / My objectives shortcut
- Optional update passcode хамгаалалт

## Update хийх алхам

1. GitHub repository дээр `index.html` файлыг энэ ZIP доторх `index.html`-ээр солино.
2. GitHub дээр `assets/config.js` өмнөх Apps Script URL хэвээр байж болно.
3. Google Apps Script дээр `Code.gs` файлыг ZIP доторх `apps-script/Code.gs`-ээр солино.
4. Apps Script дээр Save дарна.
5. `Deploy -> Manage deployments -> Edit -> Version: New version -> Deploy` хийнэ.
6. GitHub Pages site дээр Ctrl+F5 дарж refresh хийнэ.

## Optional update passcode

Update хийхэд passcode шаарддаг болгох бол Apps Script editor дээр:

1. Project Settings
2. Script Properties
3. Add script property
4. Name: `UPDATE_PASSCODE`
5. Value: өөрийн passcode, жишээ нь `ot2026`
6. Save

Дараа нь Apps Script-ийг New version deploy хийнэ.

Хэрэв `UPDATE_PASSCODE` property байхгүй бол update хийхэд passcode шаардахгүй.

## Анхаарах зүйл

Компанийн сүлжээнд `script.google.com` block хэвээр байвал dashboard data татахгүй. Ашиглахдаа mobile data, home Wi-Fi эсвэл unblock сүлжээгээр орно.
