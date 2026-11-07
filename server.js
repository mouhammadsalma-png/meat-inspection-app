const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const JSONBIN_BIN_ID = '6aef796dffd5d16053afa539';
const JSONBIN_SECRET_KEY = '$2a$10$AdRF7cjE23X9ZuLMR5H44u4epvP3N.k3Ptgreg7ypQWp1ySZyqxvS';

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

// 1. تسجيل الدخول
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (username === 'admin' && password === 'admin123') {
    return res.json({ success: true, role: 'admin', username: 'admin' });
  }
  if (username === 'inspector1' && password === '1234') {
    return res.json({ success: true, role: 'inspector', username: 'inspector1' });
  }

  const db = await getCloudDB();
  const user = db.users && db.users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }
  res.json({ success: true, role: user.role, username: user.username });
});

// 2. إضافة كشف جديد
app.post('/api/inspections', async (req, res) => {
  try {
    const db = await getCloudDB();
    if (!db.inspections) db.inspections = [];
    
    const maxId = db.inspections.reduce((max, i) => Math.max(max, i.id || 0), 0);
    const nextId = maxId + 1;

    const newInspection = {
      ...req.body, // التقاط كل الحقول بما فيها checklist
      id: nextId,
      ministry: req.body.ministry || 'الهيئة اللبنانية لسلامة الغذاء',
      created_at: new Date().toISOString()
    };

    db.inspections.unshift(newInspection);
    await saveCloudDB(db);

    res.json({ success: true, id: nextId, message: `تم حفظ الكشف بنجاح برقم: REC-2026-${nextId}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ البيانات.' });
  }
});

// 3. جلب كل الكشوفات
app.get('/api/inspections', async (req, res) => {
  const db = await getCloudDB();
  res.json(db.inspections || []);
});

// 4. جلب كشف واحد
app.get('/api/inspections/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const db = await getCloudDB();
  const inspection = (db.inspections || []).find(i => i.id === id);
  if (!inspection) return res.status(404).json({ error: 'الكشف غير موجود' });
  res.json(inspection);
});

// 5. تعديل كشف (هذا المسار يحل مشكلة 404)
app.put('/api/inspections/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const db = await getCloudDB();
    if (!db.inspections) db.inspections = [];

    const index = db.inspections.findIndex(i => i.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'الكشف غير موجود' });
    }

    db.inspections[index] = {
      ...db.inspections[index],
      ...req.body,
      id: id, 
      updated_at: new Date().toISOString()
    };

    await saveCloudDB(db);
    res.json({ success: true, message: 'تم تحديث الكشف بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'حدث خطأ أثناء التحديث.' });
  }
});

app.listen(PORT, () => {
  console.log(`السيرفر يعمل على البورت ${PORT}`);
});
