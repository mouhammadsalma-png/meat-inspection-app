const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = './database.json';

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    return { 
      users: [
        { id: 1, username: 'inspector1', password: '1234', role: 'inspector' },
        { id: 2, username: 'admin', password: 'admin123', role: 'admin' }
      ], 
      inspections: [] 
    };
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// تسجيل الدخول
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.username === username && u.password === password);
  
  if (!user) {
    return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }
  res.json({ success: true, role: user.role, username: user.username });
});

// حفظ كشف جديد
app.post('/api/inspections', (req, res) => {
  const { inspector, shop_name, inspect_date, count_m, count_g, result, risk, data_json } = req.body;
  
  if (!shop_name || !inspector) {
    return res.status(400).json({ error: 'اسم الملحمة والمراقب مطلوبة.' });
  }

  const db = readDB();
  const newInspection = {
    id: db.inspections.length + 1,
    inspector,
    shop_name,
    inspect_date,
    count_m: count_m || 0,
    count_g: count_g || 0,
    result: result || 'غير محدد',
    risk: risk || 'غير محدد',
    data_json,
    created_at: new Date().toISOString()
  };

  db.inspections.unshift(newInspection);
  writeDB(db);

  res.json({ success: true, id: newInspection.id, message: 'تم حفظ الكشف بنجاح في السيرفر' });
});

// جلب الكشوفات للمدير
app.get('/api/inspections', (req, res) => {
  const db = readDB();
  res.json(db.inspections);
});

app.listen(PORT, () => {
  console.log(`السيرفر يعمل الآن على: http://localhost:${PORT}`);
});
