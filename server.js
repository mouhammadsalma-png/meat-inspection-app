const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// بيانات سحابة JSONbin المحدثة والصحيحة 100%
const JSONBIN_BIN_ID = '6aef796dffd5d16053afa539';
const JSONBIN_SECRET_KEY = '$2a$10$AdRF7cjE23X9ZuLMR5H44u4epvP3N.k3Ptgreg7ypQWp1ySZyqxvS';

// دوال جلب وحفظ البيانات من السحابة الخارجية الدائمة
async function getCloudDB() {
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
      headers: { 'X-Master-Key': JSONBIN_SECRET_KEY }
    });
    const data = await res.json();
    return data.record || { users: [], inspections: [] };
  } catch (err) {
    console.error("خطأ في قراءة قاعدة البيانات السحابية:", err);
    return { users: [], inspections: [] };
  }
}

async function saveCloudDB(dbData) {
  try {
    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_SECRET_KEY
      },
      body: JSON.stringify(dbData)
    });
  } catch (err) {
    console.error("خطأ في حفظ قاعدة البيانات السحابية:", err);
  }
}

// مسار تسجيل الدخول
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const db = await getCloudDB();
  
  // إعداد بيانات افتراضية أولية إذا كانت السحابة فارغة
  if (!db.users || db.users.length === 0) {
    db.users = [
      { id: 1, username: 'inspector1', password: '1234', role: 'inspector' },
      { id: 2, username: 'admin', password: 'admin123', role: 'admin' }
    ];
    await saveCloudDB(db);
  }

  const user = db.users.find(u => u.username === username && u.password === password);
  
  if (!user) {
    return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }
  res.json({ success: true, role: user.role, username: user.username });
});

// مسار حفظ الكشف ورفع الـ PDF تلقائياً وحفظ البيانات في السحابة
app.post('/api/inspections', async (req, res) => {
  try {
    const { inspector, ministry, shop_name, inspect_date, temp_info, count_m, count_g, result, risk, data_json, pdf_base64 } = req.body;
    
    if (!shop_name || !inspector) {
      return res.status(400).json({ error: 'اسم الملحمة واسم المراقب مطلوبان.' });
    }

    const db = await getCloudDB();
    if (!db.inspections) db.inspections = [];
    
    const nextId = db.inspections.length + 1;
    let fileUrl = null;

    // رفع ملف الـ PDF برمجياً والحصول على رابط مباشر ودائم
    if (pdf_base64)
