const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// إنشاء واتصال بقاعدة البيانات
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) console.error('خطأ في قاعدة البيانات:', err.message);
  else console.log('تم الاتصال بقاعدة البيانات بنجاح.');
});

// إعداد الجداول (المستخدمين والكشوفات)
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inspections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inspector TEXT,
    shop_name TEXT,
    inspect_date TEXT,
    count_m INTEGER,
    count_g INTEGER,
    result TEXT,
    risk TEXT,
    data_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // إضافة حسابات افتراضية للتجربة (يمكن تعديلها لاحقاً)
  db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('inspector1', '1234', 'inspector')`);
  db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin')`);
});

// تسجيل الدخول
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, password], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    res.json({ success: true, role: row.role, username: row.username });
  });
});

// حفظ كشف جديد
app.post('/api/inspections', (req, res) => {
  const { inspector, shop_name, inspect_date, count_m, count_g, result, risk, data_json } = req.body;
  
  if (!shop_name || !inspector) {
    return res.status(400).json({ error: 'اسم الملحمة والمراقب مطلوبة.' });
  }

  const sql = `INSERT INTO inspections (inspector, shop_name, inspect_date, count_m, count_g, result, risk, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [inspector, shop_name, inspect_date, count_m, count_g, result, risk, JSON.stringify(data_json)], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: this.lastID, message: 'تم حفظ الكشف بنجاح في السيرفر' });
  });
});

// جلب كافة الكشوفات للمدير (Admin)
app.get('/api/inspections', (req, res) => {
  db.all(`SELECT id, inspector, shop_name, inspect_date, count_m, count_g, result, risk, created_at FROM inspections ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`السيرفر يعمل الآن على: http://localhost:${PORT}`);
});