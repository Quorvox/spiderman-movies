const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, 'data');
const USERS_FILE = path.join(dataDir, 'users.json');
const PROGRESS_FILE = path.join(dataDir, 'progress.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
for (const f of [USERS_FILE, PROGRESS_FILE]) {
    if (!fs.existsSync(f)) fs.writeFileSync(f, '{}');
}

function readJson(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8') || '{}'); }
    catch { return {}; }
}
function writeJson(file, obj) {
    fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

// пароль храним только как scrypt-хеш с солью
function hashPassword(pass, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.scryptSync(pass, salt, 64).toString('hex');
    return { salt, hash };
}
function checkPassword(pass, user) {
    const { hash } = hashPassword(pass, user.salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
}

// без SESSION_SECRET — рандомный ключ, сессии слетят после рестарта (для демо ок)
const secret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) console.warn('SESSION_SECRET не задан, взял временный');

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24, httpOnly: true, sameSite: 'lax' }
}));

// простой антибрут: 10 попыток в минуту с одного ip
const tries = new Map();
function tooMany(ip) {
    const now = Date.now();
    const t = (tries.get(ip) || []).filter(x => now - x < 60_000);
    t.push(now);
    tries.set(ip, t);
    return t.length > 10;
}

function requireAuth(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    next();
}

const LOGIN_RE = /^[a-zA-Z0-9_]{3,20}$/;

app.post('/register', (req, res) => {
    if (tooMany(req.ip)) return res.status(429).json({ success: false, message: 'Слишком много попыток, подожди минуту' });
    const login = String(req.body.login || '').trim();
    const password = String(req.body.password || '');
    if (!LOGIN_RE.test(login)) return res.status(400).json({ success: false, message: 'Логин: 3–20 символов, латиница, цифры, _' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Пароль минимум 6 символов' });

    const users = readJson(USERS_FILE);
    if (users[login.toLowerCase()]) return res.status(409).json({ success: false, message: 'Такой логин уже занят' });

    users[login.toLowerCase()] = { login, ...hashPassword(password), createdAt: new Date().toISOString() };
    writeJson(USERS_FILE, users);
    req.session.user = login;
    res.json({ success: true, user: login });
});

app.post('/login', (req, res) => {
    if (tooMany(req.ip)) return res.status(429).json({ success: false, message: 'Слишком много попыток, подожди минуту' });
    const login = String(req.body.login || '').trim();
    const password = String(req.body.password || '');
    const user = readJson(USERS_FILE)[login.toLowerCase()];
    if (!user || !checkPassword(password, user)) {
        return res.status(401).json({ success: false, message: 'Неверный логин или пароль' });
    }
    req.session.regenerate(() => {
        req.session.user = user.login;
        res.json({ success: true, user: user.login });
    });
});

app.get('/session', (req, res) => {
    res.json(req.session.user ? { loggedIn: true, user: req.session.user } : { loggedIn: false });
});

app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error('logout:', err);
        res.json({ success: true });
    });
});

// отдаём только свой прогресс, чужой не светим
app.get('/progress', requireAuth, (req, res) => {
    res.json(readJson(PROGRESS_FILE)[req.session.user] || {});
});

const STATUSES = ['not_started', 'in_progress', 'completed'];

app.post('/progress', requireAuth, (req, res) => {
    const { movieId, status, timestamp } = req.body;
    if (!movieId || typeof movieId !== 'string' || movieId.length > 60) {
        return res.status(400).json({ error: 'movieId required' });
    }
    if (status && !STATUSES.includes(status)) return res.status(400).json({ error: 'bad status' });

    try {
        const progress = readJson(PROGRESS_FILE);
        const mine = progress[req.session.user] || (progress[req.session.user] = {});
        mine[movieId] = {
            status: status || 'in_progress',
            timestamp: Number.isFinite(timestamp) ? timestamp : null,
            updatedAt: new Date().toISOString()
        };
        writeJson(PROGRESS_FILE, progress);
        res.json({ success: true });
    } catch (err) {
        console.error('save progress:', err);
        res.status(500).json({ error: 'Failed to save progress' });
    }
});

app.listen(PORT, () => {
    console.log(`Spider-Man кинотека: http://localhost:${PORT}`);
});
