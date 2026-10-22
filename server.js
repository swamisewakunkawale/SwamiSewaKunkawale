const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// Dynamic folder routing for Aadhaar uploads (YYYY-MM)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const monthFolder = new Date().toISOString().slice(0, 7); 
        const dir = `public/uploads/${monthFolder}`;
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const db = new sqlite3.Database('./swami_samarth.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, address TEXT, contact TEXT, email TEXT UNIQUE, aadhaar_path TEXT, role TEXT DEFAULT 'user', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`CREATE TABLE IF NOT EXISTS bookings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, booking_date DATE, status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id))`);
    db.run(`CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_booking_date ON bookings(booking_date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_booking_date_user ON bookings(booking_date, user_id)`);

    // Added color configuration defaults
    const defaults = [
        ['max_bookings_per_year', '1'],
        ['img_1', 'mandir.jpg'], ['img_2', 'garbhgruh.jpg'], ['img_3', 'swami.jpg'],
        ['song_1', 'karunapadi.mp3'], ['song_2', 'vida-seva.mp3'], ['song_3', 'aarti.mp3'],
        ['body_color', '#fff7ed'],     // orange-50
        ['header_color', '#ea580c'],   // orange-600
        ['footer_color', '#c2410c']    // orange-700
    ];
    let stmt = db.prepare(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`);
    defaults.forEach(d => stmt.run(d));
    stmt.finalize();

    const defaultUsers = [
        ['Test Sadhak', 'Malvan Ashram', '9876543210', 'test@swamisamarth.org', null, 'user'],
        ['Admin Manager', 'Kendra Admin Office', '9111111111', 'admin@swamisamarth.org', null, 'admin']
    ];
    let userStmt = db.prepare(`INSERT OR IGNORE INTO users (name, address, contact, email, aadhaar_path, role) VALUES (?, ?, ?, ?, ?, ?)`);
    defaultUsers.forEach(u => userStmt.run(u));
    userStmt.finalize();
});

const otpStore = {};

const transporter = nodemailer.createTransport({
    host: 'mail.smtp2go.com',
    port: 2525,
    secure: false,
    auth: {
        user: 'YOUR_SMTP2GO_USERNAME', 
        pass: 'YOUR_SMTP2GO_PASSWORD'  
    }
});

app.get('/sevaadmin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.get('/api/config', (req, res) => {
    db.all(`SELECT key, value FROM config`, [], (err, rows) => {
        let configObj = {};
        rows.forEach(r => configObj[r.key] = r.value);
        res.json(configObj);
    });
});

// Admin save config
app.post('/api/admin/config', (req, res) => {
    const updates = req.body;
    const stmt = db.prepare(`INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
    db.serialize(() => {
        for (const [key, value] of Object.entries(updates)) {
            stmt.run(key, value);
        }
        stmt.finalize(() => {
            res.json({ message: "Settings saved successfully!" });
        });
    });
});

app.post('/api/send-otp', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = otp;
    
    transporter.sendMail({
        from: '"Swami Samarth Kendra" <verified-email@yourdomain.com>', 
        to: email,
        subject: 'Your Login OTP',
        text: `Your OTP for Swami Samarth Kendra booking is: ${otp}`
    }, (err, info) => {
        if (err) {
            console.error('SMTP Error:', err);
            return res.status(500).json({ error: 'Failed to send OTP. Check SMTP settings.' });
        }
        res.json({ message: 'OTP sent successfully!' });
    });
});

app.post('/api/verify-otp', upload.single('aadhaar'), (req, res) => {
    const { name, email, contact, address, otp } = req.body;
    if (otpStore[email] !== otp) return res.status(400).json({ error: 'Invalid or expired OTP' });
    delete otpStore[email];
    
    const monthFolder = new Date().toISOString().slice(0, 7);
    const aadhaar_path = req.file ? `/uploads/${monthFolder}/${req.file.filename}` : null;
    
    db.get(`SELECT id FROM users WHERE email = ?`, [email], (err, row) => {
        if (row) {
            res.json({ message: 'Login successful', user_id: row.id });
        } else {
            db.run(`INSERT INTO users (name, email, contact, address, aadhaar_path) VALUES (?, ?, ?, ?, ?)`, 
            [name, email, contact, address, aadhaar_path], function(err) {
                if (err) return res.status(500).json({ error: 'Database error' });
                res.json({ message: 'Registration successful', user_id: this.lastID });
            });
        }
    });
});

app.get('/api/my-bookings/:user_id', (req, res) => {
    db.all(`SELECT id, booking_date, status, created_at FROM bookings WHERE user_id = ? ORDER BY booking_date DESC`, [req.params.user_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/book', (req, res) => {
    const { user_id, date } = req.body;
    db.get(`SELECT value FROM config WHERE key = 'max_bookings_per_year'`, (err, configRow) => {
        const maxBookings = parseInt(configRow.value);
        db.get(`SELECT COUNT(*) as count FROM bookings WHERE user_id = ? AND status = 'active' AND booking_date >= date('now', '-1 year')`, [user_id], (err, row) => {
            if (row.count >= maxBookings) return res.status(400).json({ error: `Limit reached: You can only book ${maxBookings} service(s) per year.` });
            db.run(`INSERT INTO bookings (user_id, booking_date) VALUES (?, ?)`, [user_id, date], (err) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                res.json({ message: 'Booking successful' });
            });
        });
    });
});

app.post('/api/cancel', (req, res) => {
    const { user_id, booking_ids } = req.body;
    if (!booking_ids || booking_ids.length === 0) return res.status(400).json({error: "No bookings selected"});
    
    const placeholders = booking_ids.map(() => '?').join(',');
    db.run(`UPDATE bookings SET status = 'cancelled' WHERE user_id = ? AND id IN (${placeholders})`, [user_id, ...booking_ids], function(err) {
        if (err) return res.status(500).json({error: "Database error"});
        res.json({message: "Selected bookings have been cancelled successfully."});
    });
});

app.post('/api/admin/query', (req, res) => {
    const { query } = req.body;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/admin/detailed-reports/:email', (req, res) => {
    const email = req.params.email;
    db.get(`SELECT id, name FROM users WHERE email = ?`, [email], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: "User not found" });
        
        db.all(`SELECT booking_date, status, created_at FROM bookings WHERE user_id = ? ORDER BY created_at DESC`, [user.id], (err, bookings) => {
            res.json({ user, bookings });
        });
    });
});

app.listen(3000, () => console.log('Server running on port 3000'));
