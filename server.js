const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// زيادة حد حجم البيانات المستلمة لضمان استيعاب ملفات الـ PDF المرفوعة
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));
// إتاحة الوصول المباشر لملفات PDF المحفوظة عبر الرابط
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const DB_FILE = './database.json';
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// التأكد من وجود مجلد الرفع على السيرفر
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function readDB() {
  let db = { users: [], inspections: [] };
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
      db = { users: [], inspections: [] };
    }
  }
  
  if (!db.users || db.users.length === 0) {
    db.users = [
      { id: 1, username: 'inspector1', password: '1234', role: 'inspector' },
      { id: 2, username: 'admin', password: 'admin123', role: 'admin' }
    ];
    writeDB(db);
  }
  return db;
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// مسار تسجيل الدخول
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.username === username && u.password === password);
  
  if (!user) {
    return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }
  res.json({ success: true, role: user.role, username: user.username });
});

// حفظ الكشف ورفع ملف الـ PDF على السيرفر
app.post('/api/inspections', (req, res) => {
  const { inspector, ministry, shop_name, inspect_date, temp_info, count_m, count_g, result, risk, data_json, pdf_base64 } = req.body;
  
  if (!shop_name || !inspector) {
    return res.status(400).json({ error: 'اسم الملحمة واسم المراقب مطلوبة.' });
  }

  const db = readDB();
  const nextId = db.inspections.length + 1;
  let pdfFilename = null;

  // حفظ ملف الـ PDF على السيرفر إذا تم إرساله
  if (pdf_base64) {
    try {
      const base64Data = pdf_base64.replace(/^data:application\/pdf;base64,/, "");
      pdfFilename = `Inspection_REC-2026-${nextId}_${Date.now()}.pdf`;
      const filePath = path.join(UPLOAD_DIR, pdfFilename);
      fs.writeFileSync(filePath, base64Data, 'base64');
    } catch (err) {
      console.error("خطأ في حفظ ملف الـ PDF على السيرفر:", err);
    }
  }

  const newInspection = {
    id: nextId,
    inspector,
    ministry: ministry || 'الهيئة اللبنانية لسلامة الغذاء',
    shop_name,
    inspect_date,
    temp_info: temp_info || 'غير متاح',
    count_m: count_m || 0,
    count_g: count_g || 0,
    result: result || 'غير محدد',
    risk: risk || 'غير محدد',
    pdf_file: pdfFilename ? `/uploads/${pdfFilename}` : null,
    data_json,
    created_at: new Date().toISOString()
  };

  db.inspections.unshift(newInspection);
  writeDB(db);

  res.json({ success: true, id: nextId, message: `تم حفظ الكشف ورفع ملف PDF على السيرفر بنجاح برقم: REC-2026-${nextId}` });
});

// جلب الكشوفات للمدير
app.get('/api/inspections', (req, res) => {
  const db = readDB();
  res.json(db.inspections);
});

app.listen(PORT, () => {
  console.log(`السيرفر يعمل الآن على: http://localhost:${PORT}`);
});
