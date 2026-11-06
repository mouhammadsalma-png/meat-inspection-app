const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = './database.json';

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

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.username === username && u.password === password);
  
  if (!user) {
    return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }
  res.json({ success: true, role: user.role, username: user.username });
});

app.post('/api/inspections', (req, res) => {
  const { inspector, ministry, shop_name, inspect_date, temp_info, count_m, count_g, result, risk, data_json } = req.body;
  
  if (!shop_name || !inspector) {
    return res.status(400).json({ error: 'اسم الملحمة واسم المراقب مطلوبة.' });
  }

  const db = readDB();
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
    data_json,
    created_at: new Date().toISOString()
  };

  db.inspections.unshift(newInspection);
  writeDB(db);

  res.json({ success: true, id: nextId, message: `تم حفظ الكشف بنجاح برقم تسلسلي: REC-2026-${nextId}` });
});

app.get('/api/inspections', (req, res) => {
  const db = readDB();
  res.json(db.inspections);
});

app.listen(PORT, () => {
  console.log(`السيرفر يعمل على: http://localhost:${PORT}`);
});
