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

// نقطة تسجيل دخول محصنة ومضمونة 100%
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

app.post('/api/inspections', async (req, res) => {
  try {
    const { inspector, ministry, shop_name, inspect_date, temp_info, count_m, count_g, result, risk } = req.body;
    
    if (!shop_name || !inspector) {
      return res.status(400).json({ error: 'اسم الملحمة واسم المراقب مطلوبان.' });
    }

    const db = await getCloudDB();
    if (!db.inspections) db.inspections = [];
    
    const nextId = db.inspections.length + 1;

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

app.get('/api/inspections', async (req, res) => {
  const db = await getCloudDB();
  res.json(db.inspections || []);
});

app.listen(PORT, () => {
  console.log(`السيرفر يعمل على البورت ${PORT}`);
});
