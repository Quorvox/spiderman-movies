// в демо только офиц. трейлеры с каналов Sony / Marvel (yt = id ролика)
const movies = [
    { id: 'spider-man-2002', title: 'Человек-паук', year: 2002, actor: 'Тоби Магуайр', yt: 't06RUxPbp_c' },
    { id: 'spider-man-2-2004', title: 'Человек-паук 2', year: 2004, actor: 'Тоби Магуайр', yt: '7BK2Bg9liDk' },
    { id: 'spider-man-3-2007', title: 'Человек-паук 3: Враг в отражении', year: 2007, actor: 'Тоби Магуайр', yt: 'e5wUilOeOmg' },
    { id: 'amazing-spider-man-2012', title: 'Новый Человек-паук', year: 2012, actor: 'Эндрю Гарфилд', yt: '-tnxzJ0SSOw' },
    { id: 'amazing-spider-man-2-2014', title: 'Новый Человек-паук: Высокое напряжение', year: 2014, actor: 'Эндрю Гарфилд', yt: 'nbp3Ra3Yp74' },
    { id: 'civil-war-2016', title: 'Первый мститель: Противостояние', year: 2016, actor: 'Том Холланд', yt: '43NWzay3W4s' },
    { id: 'homecoming-2017', title: 'Человек-паук: Возвращение домой', year: 2017, actor: 'Том Холланд', yt: 'rk-dF1lIbIg' },
    { id: 'infinity-war-2018', title: 'Мстители: Война бесконечности', year: 2018, actor: 'Том Холланд', yt: '6ZfuNTqbHE8' },
    { id: 'far-from-home-2019', title: 'Человек-паук: Вдали от дома', year: 2019, actor: 'Том Холланд', yt: 'Nt9L1jCKGnE' },
    { id: 'no-way-home-2021', title: 'Человек-паук: Нет пути домой', year: 2021, actor: 'Том Холланд', yt: 'JfVOs4VSpmA' }
];

const thumb = m => 'https://i.ytimg.com/vi/' + m.yt + '/hqdefault.jpg';
// nocookie — ютуб не ставит куки, пока юзер не нажал play (GDPR)
const embed = m => 'https://www.youtube-nocookie.com/embed/' + m.yt + '?rel=0';

let authMode = 'login';

let currentUser = null;
let progressData = {};
let currentMovieId = null;

const authForm = document.getElementById('authForm');
const mainContent = document.getElementById('mainContent');
const loginForm = document.getElementById('loginForm');
const loginInput = document.getElementById('loginInput');
const passwordInput = document.getElementById('passwordInput');
const authError = document.getElementById('authError');
const userDisplay = document.getElementById('userDisplay');
const logoutBtn = document.getElementById('logoutBtn');
const moviesGrid = document.getElementById('moviesGrid');
const progressList = document.getElementById('progressList');
const playerModal = document.getElementById('playerModal');
const playerIframe = document.getElementById('playerIframe');
const playerTitle = document.getElementById('playerTitle');
const closePlayer = document.getElementById('closePlayer');
const timestampInput = document.getElementById('timestampInput');
const saveProgressBtn = document.getElementById('saveProgressBtn');
const playerStatus = document.getElementById('playerStatus');
const statusBtns = document.querySelectorAll('.status-btn');

function formatTime(seconds) {
    if (!seconds) return '—';
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(Math.floor(seconds % 60)).padStart(2, '0');
    return h + ':' + m + ':' + s;
}

function parseTime(str) {
    var parts = str.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 1) {
        return parts[0];
    }
    return null;
}

function getStatusText(status) {
    var map = {
        'not_started': 'Не начато',
        'in_progress': 'В процессе',
        'completed': 'Просмотрено'
    };
    return map[status] || status;
}

function getStatusIcon(status) {
    var map = {
        'not_started': 'hourglass_empty',
        'in_progress': 'play_circle',
        'completed': 'check_circle'
    };
    return map[status] || '';
}

function getStatusClass(status) {
    var map = {
        'not_started': 'status-not_started',
        'in_progress': 'status-in_progress',
        'completed': 'status-completed'
    };
    return map[status] || '';
}

async function loadProgress() {
    try {
        var res = await fetch('/progress');
        if (res.ok) progressData = await res.json();
    } catch (err) {
        console.error('Failed to load progress:', err);
    }
}

async function saveProgress(movieId, status, timestamp) {
    try {
        var res = await fetch('/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ movieId: movieId, status: status, timestamp: timestamp })
        });
        if (res.ok) {
            await loadProgress();
            renderMovies();
            renderProgress();
            updatePlayerStatus();
        }
    } catch (err) {
        console.error('Failed to save progress:', err);
    }
}

function renderMovies() {
    moviesGrid.innerHTML = '';
    movies.forEach(function(movie) {
        var progress = progressData[movie.id] || {};
        var status = progress.status || 'not_started';
        var timestamp = progress.timestamp;

        var card = document.createElement('div');
        card.className = 'movie-card';

        var statusText = getStatusText(status);
        var statusIcon = getStatusIcon(status);
        var timeText = timestamp ? formatTime(timestamp) : '';

        card.innerHTML = `
            <div class="movie-poster">
                <img src="${thumb(movie)}" alt="${movie.title}" loading="lazy">
                <span class="poster-play material-icons">play_circle</span>
                <span class="poster-year">${movie.year}</span>
            </div>
            <div class="movie-info">
                <div class="movie-title">${movie.title}</div>
                <div class="movie-year">${movie.actor}</div>
                <div class="movie-status-badge ${getStatusClass(status)}">
                    <span class="material-icons">${statusIcon}</span>
                    ${statusText} ${timeText ? '⏱ ' + timeText : ''}
                </div>
                <button class="movie-watch-btn" data-id="${movie.id}">
                    <span class="material-icons">play_arrow</span> Трейлер
                </button>
            </div>
        `;

        card.querySelector('.movie-watch-btn').addEventListener('click', function() { openPlayer(movie); });
        card.querySelector('.movie-poster').addEventListener('click', function() { openPlayer(movie); });

        moviesGrid.appendChild(card);
    });
}

function renderProgress() {
    progressList.innerHTML = '';
    var hasProgress = false;

    movies.forEach(function(movie) {
        var progress = progressData[movie.id] || {};
        var status = progress.status || 'not_started';
        var timestamp = progress.timestamp;

        if (status === 'in_progress' || status === 'completed') {
            hasProgress = true;
            var item = document.createElement('div');
            item.className = 'progress-item';
            var statusIcon = getStatusIcon(status);
            var timeStr = timestamp ? formatTime(timestamp) : '';
            item.innerHTML = `
                <span>${movie.title}</span>
                <span class="status-badge">
                    <span class="material-icons" style="font-size:14px;">${statusIcon}</span>
                    ${getStatusText(status)}
                </span>
                ${timeStr ? '<span class="time-badge"><span class="material-icons" style="font-size:16px;">access_time</span> ' + timeStr + '</span>' : ''}
            `;
            progressList.appendChild(item);
        }
    });

    if (!hasProgress) {
        progressList.innerHTML = `
            <div style="color:#666; font-size:14px; display:flex; align-items:center; gap:8px;">
                <span class="material-icons" style="font-size:20px;">info</span>
                Нет сохранённых просмотров
            </div>
        `;
    }
}

function openPlayer(movie) {
    currentMovieId = movie.id;
    playerTitle.textContent = movie.title;
    playerIframe.src = embed(movie);
    playerModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    var progress = progressData[movie.id] || {};
    timestampInput.value = progress.timestamp ? formatTime(progress.timestamp) : '';
    updatePlayerStatus();
}

function closePlayerModal() {
    playerModal.style.display = 'none';
    document.body.style.overflow = '';
    playerIframe.src = '';
    currentMovieId = null;
}

function updatePlayerStatus() {
    if (!currentMovieId) return;
    var progress = progressData[currentMovieId] || {};
    var status = progress.status || 'not_started';
    var timestamp = progress.timestamp;

    statusBtns.forEach(function(btn) {
        if (btn.dataset.status === status) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    var statusIcon = getStatusIcon(status);
    var statusText = getStatusText(status);
    var timeText = timestamp ? formatTime(timestamp) : '';
    playerStatus.innerHTML = `
        <span class="material-icons" style="font-size:18px;">${statusIcon}</span>
        Статус: ${statusText} ${timeText ? '⏱ ' + timeText : ''}
    `;
}

async function handleSaveProgress() {
    if (!currentMovieId) return;

    var timestampStr = timestampInput.value.trim();
    var timestamp = null;
    if (timestampStr) {
        timestamp = parseTime(timestampStr);
        if (timestamp === null) {
            alert('Введите время в формате чч:мм:сс (например, 01:23:00)');
            return;
        }
    }

    var status = 'not_started';
    if (timestamp !== null && timestamp > 0) {
        status = 'in_progress';
    }

    var activeStatusBtn = document.querySelector('.status-btn.active');
    if (activeStatusBtn) {
        status = activeStatusBtn.dataset.status;
    }

    await saveProgress(currentMovieId, status, timestamp);
}

function setAuthMode(mode) {
    authMode = mode;
    var reg = mode === 'register';
    document.querySelectorAll('.auth-tab').forEach(function(t) {
        t.classList.toggle('active', t.dataset.mode === mode);
    });
    document.getElementById('authTitle').textContent = reg ? 'Регистрация' : 'С возвращением';
    document.getElementById('authSubmitText').textContent = reg ? 'Создать аккаунт' : 'Войти';
    passwordInput.autocomplete = reg ? 'new-password' : 'current-password';
    authError.textContent = '';
}

async function login(e) {
    e.preventDefault();
    var login = loginInput.value.trim();
    var password = passwordInput.value;

    try {
        var res = await fetch(authMode === 'register' ? '/register' : '/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: login, password: password })
        });
        var data = await res.json();

        if (data.success) {
            currentUser = data.user;
            passwordInput.value = '';
            authForm.style.display = 'none';
            mainContent.style.display = 'block';
            userDisplay.textContent = currentUser;
            await loadProgress();
            renderMovies();
            renderProgress();
        } else {
            authError.textContent = data.message || 'Неверный логин или пароль';
        }
    } catch (err) {
        authError.textContent = 'Ошибка соединения с сервером';
    }
}

async function logout() {
    try {
        await fetch('/logout', { method: 'POST' });
    } catch (err) {}
    currentUser = null;
    progressData = {};
    authForm.style.display = 'flex';
    mainContent.style.display = 'none';
    document.body.style.overflow = '';
    playerModal.style.display = 'none';
}

async function checkSession() {
    try {
        var res = await fetch('/session');
        var data = await res.json();
        if (data.loggedIn) {
            currentUser = data.user;
            authForm.style.display = 'none';
            mainContent.style.display = 'block';
            userDisplay.textContent = currentUser;
            await loadProgress();
            renderMovies();
            renderProgress();
        }
    } catch (err) {
        console.error('Session check failed:', err);
    }
}

loginForm.addEventListener('submit', login);
document.querySelectorAll('.auth-tab').forEach(function(t) {
    t.addEventListener('click', function() { setAuthMode(t.dataset.mode); });
});
logoutBtn.addEventListener('click', logout);
closePlayer.addEventListener('click', closePlayerModal);
saveProgressBtn.addEventListener('click', handleSaveProgress);

statusBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
        statusBtns.forEach(function(b) {
            b.classList.remove('active');
        });
        this.classList.add('active');
        if (currentMovieId) {
            var status = this.dataset.status;
            var timestamp = null;
            if (status === 'in_progress') {
                var parsed = parseTime(timestampInput.value);
                if (parsed !== null && parsed > 0) timestamp = parsed;
            }
            saveProgress(currentMovieId, status, timestamp);
        }
    });
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closePlayerModal();
});

playerModal.addEventListener('click', function(e) {
    if (e.target === playerModal) closePlayerModal();
});

checkSession();