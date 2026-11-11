xxxxconst express = require('express');
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
    return data.record || { users: [], inspections: [], templates: null };
  } catch (err) {
    console.error("خطأ في قراءة قاعدة البيانات:", err);
    return { users: [], inspections: [], templates: null };
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
    console.error("خطأ في حفظ قاعدة البيانات:", err);
  }
}

// 1. تسجيل الدخول
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    return res.json({ success: true, role: 'admin', username: 'admin', full_name: 'مدير النظام', ministry: 'الهيئة اللبنانية لسلامة الغذاء' });
  }
  const db = await getCloudDB();
  const user = db.users && db.users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  res.json({ success: true, role: user.role || 'inspector', username: user.username, full_name: user.full_name || user.username, ministry: user.ministry || 'الهيئة اللبنانية لسلامة الغذاء' });
});

// 2. إدارة المراقبين
app.get('/api/users', async (req, res) => {
  const db = await getCloudDB();
  res.json(db.users || []);
});

app.post('/api/users', async (req, res) => {
  try {
    const { username, password, full_name, ministry } = req.body;
    if (!username || !password || !full_name) return res.status(400).json({ error: 'بيانات ناقصة' });
    const db = await getCloudDB();
    if (!db.users) db.users = [];
    if (db.users.find(u => u.username === username) || username === 'admin') return res.status(400).json({ error: 'اسم المستخدم موجود' });
    db.users.push({ username, password, full_name, ministry, role: 'inspector' });
    await saveCloudDB(db);
    res.json({ success: true, message: 'تمت الإضافة' });
  } catch (err) { res.status(500).json({ error: 'خطأ' }); }
});

app.delete('/api/users/:username', async (req, res) => {
  try {
    const db = await getCloudDB();
    if (db.users) db.users = db.users.filter(u => u.username !== req.params.username);
    await saveCloudDB(db);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'خطأ' }); }
});

// 3. إدارة القوالب (Checklists)
app.get('/api/templates', async (req, res) => {
  const db = await getCloudDB();
  res.json(db.templates || null); // سيعيد null إذا لم تكن هناك قوالب محفوظة، والواجهة ستستخدم الافتراضية
});

app.post('/api/templates', async (req, res) => {
  try {
    const db = await getCloudDB();
    db.templates = req.body;
    await saveCloudDB(db);
    res.json({ success: true, message: 'تم تحديث القوالب' });
  } catch (err) { res.status(500).json({ error: 'خطأ' }); }
});

// 4. الكشوفات
app.post('/api/inspections', async (req, res) => {
  try {
    const db = await getCloudDB();
    if (!db.inspections) db.inspections = [];
    const maxId = db.inspections.reduce((max, i) => Math.max(max, i.id || 0), 0);
    const nextId = maxId + 1;
    db.inspections.unshift({ ...req.body, id: nextId, created_at: new Date().toISOString() });
    await saveCloudDB(db);
    res.json({ success: true, id: nextId, message: `تم الحفظ برقم: REC-2026-${nextId}` });
  } catch (err) { res.status(500).json({ error: 'خطأ' }); }
});

app.get('/api/inspections', async (req, res) => {
  const db = await getCloudDB();
  res.json(db.inspections || []);
});

app.get('/api/inspections/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const db = await getCloudDB();
  const inspection = (db.inspections || []).find(i => i.id === id);
  if (!inspection) return res.status(404).json({ error: 'غير موجود' });
  res.json(inspection);
});

app.put('/api/inspections/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const db = await getCloudDB();
    if (!db.inspections) db.inspections = [];
    const index = db.inspections.findIndex(i => i.id === id);
    if (index === -1) return res.status(404).json({ success: false, error: 'غير موجود' });
    db.inspections[index] = { ...db.inspections[index], ...req.body, id: id, updated_at: new Date().toISOString() };
    await saveCloudDB(db);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: 'خطأ' }); }
});

app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
