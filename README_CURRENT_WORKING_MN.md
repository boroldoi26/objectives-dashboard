# Objectives Dashboard - Current Working Package

Энэ ZIP нь одоо ажиллаж байгаа GitHub Pages + Google Apps Script + Google Sheet dashboard-ийн сүүлийн хувилбарын бүх гол файлуудыг нэгтгэсэн багц.

## Файлын бүтэц

```text
objectives_dashboard_current_working_package/
├─ index.html
├─ .nojekyll
├─ assets/
│  └─ config.js
├─ apps-script/
│  └─ Code.gs
├─ objectives_dashboard_google_sheet_template.xlsx
├─ README.md
├─ README_V3_1_MN.md
├─ README_V3_2_APPROVAL_MN.md
└─ README_CURRENT_WORKING_MN.md
```

## Одоогийн ажиллаж байгаа бүтэц

```text
GitHub Pages frontend
→ Apps Script Web App API
→ Google Sheet database
```

## GitHub дээр байрлуулах файлууд

Repository root дээр дараах файлууд байх ёстой:

```text
index.html
.nojekyll
assets/config.js
README.md
```

`assets/config.js` дотор одоогийн Apps Script `/exec` URL тавигдсан.

## Apps Script дээр тавих файл

Apps Script editor дээр:

```text
apps-script/Code.gs
```

файлын кодыг `Code.gs` дээр бүтнээр нь replace хийнэ.

Дараа нь:

```text
Deploy → Manage deployments → Edit → Version: New version → Deploy
```

хийнэ.

## Admin approval тохиргоо

Apps Script → Project Settings → Script Properties дээр дараах property байх ёстой:

```text
ADMIN_PASSCODE = таны_нууц_үг
```

Жишээ:

```text
ADMIN_PASSCODE = admin2026
```

## Dashboard ашиглах workflow

### Хэрэглэгч

1. Objective дээр `Update` дарна.
2. Status / Due date / Notes өөрчилнө.
3. Requested by дээр нэрээ бичнэ.
4. `Submit for approval` дарна.
5. Хүсэлт `Pending_Updates` sheet дээр орно.

### Admin

1. Sidebar → `Admin approvals` орно.
2. Admin passcode оруулна.
3. `Load pending` дарна.
4. Approve эсвэл Reject дарна.
5. Approve хийвэл үндсэн `Objectives` sheet шинэчлэгдэнэ.

## Анхаарах зүйл

- Компанийн сүлжээнд `script.google.com` block байвал dashboard data уншихгүй.
- Ашиглахдаа mobile data, home Wi-Fi, эсвэл Google Script нээлттэй сүлжээ ашиглана.
- `config.js` дахь URL нь Apps Script active deployment-ийн Web app URL-тэй яг ижил байх ёстой.
- Apps Script код өөрчилсний дараа заавал `New version → Deploy` хийх хэрэгтэй.
