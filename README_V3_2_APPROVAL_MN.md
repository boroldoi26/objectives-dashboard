# Objectives Dashboard v3.2 - Admin Approval Workflow

Энэ хувилбарт хэрэглэгчийн Update шууд үндсэн `Objectives` sheet дээр хадгалагдахгүй. Эхлээд `Pending_Updates` sheet дээр хүсэлт болон бүртгэгдэнэ. Admin approve хийсний дараа л үндсэн objective шинэчлэгдэж, `Change_Log` дээр бүртгэл орно.

## Нэмэгдсэн зүйлс

- `Pending_Updates` sheet автомат үүснэ
- User update -> Pending approval request
- Sidebar дээр `Admin approvals` хэсэг нэмэгдсэн
- Admin approve/reject action
- `ADMIN_PASSCODE` хамгаалалт
- Pending approval KPI
- Approval approved үед үндсэн sheet update + Change_Log бичнэ

## Update хийх дараалал

1. GitHub repository дээрх `index.html` файлыг энэ ZIP доторх шинэ `index.html`-ээр солино.
2. `assets/config.js` файлаа өөрчлөх шаардлагагүй. Одоогийн Apps Script `/exec` URL хэвээр үлдэнэ.
3. Apps Script editor дээр `Code.gs`-ийг `apps-script/Code.gs`-ээр бүтнээр нь replace хийнэ.
4. Apps Script дээр Save дарна.
5. Apps Script > Project Settings > Script Properties хэсэгт дараах property нэмнэ:

```
ADMIN_PASSCODE = admin2026
```

Та `admin2026`-г өөрийн хүссэн нууц үгээр солино.

6. Apps Script дээр нэг удаа `getInitialData` run хийж `Pending_Updates` sheet үүсгэнэ.
7. Deploy > Manage deployments > Edit > Version: New version > Deploy хийнэ.
8. GitHub Pages дээр Ctrl+F5 дарж refresh хийнэ.

## Ашиглах workflow

### Хэрэглэгч

1. Objective дээр Update дарна.
2. Status / Due date / Notes өөрчилнө.
3. Requested by дээр нэрээ бичнэ.
4. Submit for approval дарна.
5. Хүсэлт Pending_Updates sheet дээр орно.

### Admin

1. Dashboard sidebar > Admin approvals дарна.
2. Admin passcode оруулна.
3. Pending request-үүдийг харна.
4. Approve эсвэл Reject дарна.
5. Approve хийвэл үндсэн objective шинэчлэгдэнэ.

## Анхаарах зүйл

- `ADMIN_PASSCODE` тохируулаагүй бол approve/reject ажиллахгүй.
- Хэрэглэгч update request илгээхэд passcode шаардахгүй.
- Dashboard-ийн KPI хэрэглэгчийн request үед өөрчлөгдөхгүй, зөвхөн admin approve хийсний дараа өөрчлөгдөнө.
