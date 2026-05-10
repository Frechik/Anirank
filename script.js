// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function getImageUrl(anime) { return anime.imageUrl; }

function getAverageUserRating(animeId) {
    const animeReviews = reviews.filter(r => r.animeId === animeId);
    if (animeReviews.length === 0) return null;
    const avg = animeReviews.reduce((sum, r) => sum + r.rating, 0) / animeReviews.length;
    return avg.toFixed(1);
}

function getStarsDisplay(rating) {
    const fullStars = Math.floor(rating / 2);
    const halfStar = (rating % 2) >= 0.8;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    return '★'.repeat(fullStars) + (halfStar ? '½' : '') + '☆'.repeat(emptyStars);
}

function getRecommendations(currentAnime, count = 4) {
    const candidates = animeLibrary.filter(a => a.id !== currentAnime.id && a.genres.some(g => currentAnime.genres.includes(g)));
    const shuffled = [...candidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
}

function getVKEmbedUrl(url) {
    if (url.includes('vkvideo.ru/video-')) {
        const match = url.match(/video-(\d+)_(\d+)/);
        if (match) return `https://vkvideo.ru/video_ext.php?oid=-${match[1]}&id=${match[2]}&hash=8e9f3a2b1c4d5e6f`;
    } else if (url.includes('vk.com/video-')) {
        const match = url.match(/video-(\d+)_(\d+)/);
        if (match) return `https://vkvideo.ru/video_ext.php?oid=-${match[1]}&id=${match[2]}&hash=8e9f3a2b1c4d5e6f`;
    }
    return url;
}

function showTrailer(anime) {
    const container = document.getElementById('trailerContainer');
    if (anime.trailerUrl && anime.trailerUrl !== "") {
        const embedUrl = getVKEmbedUrl(anime.trailerUrl);
        container.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`;
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        container.innerHTML = `<div style="background: var(--tag-bg); padding: 1rem; border-radius: 1rem; text-align: center; color: var(--accent-gold);">🎬 Трейлер для "${anime.title}" временно недоступен</div>`;
        container.style.display = 'block';
    }
}

// ==================== ХРАНИЛИЩА ====================
let users = JSON.parse(localStorage.getItem('anirank_users')) || [];
let reviews = JSON.parse(localStorage.getItem('anirank_reviews')) || [];
let complaints = JSON.parse(localStorage.getItem('anirank_complaints')) || [];
let bannedUsers = JSON.parse(localStorage.getItem('anirank_banned')) || [];
let replies = JSON.parse(localStorage.getItem('anirank_replies')) || [];
let currentUser = localStorage.getItem('anirank_currentUser') || null;

function saveUsers() { localStorage.setItem('anirank_users', JSON.stringify(users)); }
function saveReviews() { localStorage.setItem('anirank_reviews', JSON.stringify(reviews)); }
function saveComplaints() { localStorage.setItem('anirank_complaints', JSON.stringify(complaints)); }
function saveBanned() { localStorage.setItem('anirank_banned', JSON.stringify(bannedUsers)); }
function saveReplies() { localStorage.setItem('anirank_replies', JSON.stringify(replies)); }

// ==================== АДМИНИСТРИРОВАНИЕ ====================
function initAdmin() {
    const adminExists = users.find(u => u.username === "Admin");
    if (!adminExists) users.push({ username: "Admin", password: "23578778877qwe", isAdmin: true });
    else { adminExists.password = "23578778877qwe"; adminExists.isAdmin = true; }
    saveUsers();
}

function isAdmin(user) { const u = users.find(u => u.username === user); return u && u.isAdmin === true; }
function isBanned(username) { return bannedUsers.includes(username); }
function isStrongPassword(pwd) { return pwd.length >= 8 && /[a-zA-Z]/.test(pwd) && /[0-9]/.test(pwd); }

function makeAdmin(username) {
    if (!isAdmin(currentUser)) return false;
    const user = users.find(u => u.username === username);
    if (user && username !== "Admin") { user.isAdmin = true; saveUsers(); return true; }
    return false;
}

function removeAdmin(username) {
    if (!isAdmin(currentUser) || username === "Admin") return false;
    const user = users.find(u => u.username === username);
    if (user && user.isAdmin === true) { user.isAdmin = false; saveUsers(); return true; }
    return false;
}

function registerUser(username, password) {
    if (!isStrongPassword(password)) return "Пароль ≥8 символов, буквы+цифры";
    if (users.find(u => u.username === username)) return "Пользователь существует";
    if (username === "Admin") return "Имя Admin зарезервировано";
    users.push({ username, password, isAdmin: false });
    saveUsers(); return null;
}

function loginUser(username, password) {
    if (isBanned(username)) return "Аккаунт забанен";
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return "Неверные данные";
    currentUser = username;
    localStorage.setItem('anirank_currentUser', currentUser);
    updateUI(); renderAnimeList(); return null;
}

function logout() { 
    currentUser = null; 
    localStorage.removeItem('anirank_currentUser'); 
    updateUI(); 
    renderAnimeList(); 
}

function deleteUserAccount(username) {
    if (!isAdmin(currentUser) || username === "Admin") return false;
    users = users.filter(u => u.username !== username);
    reviews = reviews.filter(r => r.username !== username);
    complaints = complaints.filter(c => c.targetUser !== username && c.fromUser !== username);
    bannedUsers = bannedUsers.filter(b => b !== username);
    replies = replies.filter(r => r.author !== username);
    saveUsers(); saveReviews(); saveComplaints(); saveBanned(); saveReplies();
    if (currentUser === username) logout();
    return true;
}

function banUser(username) { 
    if (!bannedUsers.includes(username) && username !== "Admin") { 
        bannedUsers.push(username); 
        saveBanned(); 
        if (currentUser === username) logout(); 
        updateUI(); 
        renderAnimeList(); 
    } 
}

function unbanUser(username) { 
    bannedUsers = bannedUsers.filter(u => u !== username); 
    saveBanned(); 
    updateUI(); 
    renderAnimeList(); 
}

// ==================== ОТЗЫВЫ И ЖАЛОБЫ ====================
function addReview(animeId, rating, comment) {
    if (!currentUser) return "Войдите";
    if (isBanned(currentUser)) return "Вы забанены";
    if (rating < 1 || rating > 10) return "Оценка 1-10";
    const existingIdx = reviews.findIndex(r => r.animeId === animeId && r.username === currentUser);
    const newReview = { id: Date.now(), animeId, username: currentUser, rating: parseFloat(rating), comment: comment.trim() || "Без комментария", date: new Date().toISOString() };
    if (existingIdx !== -1) reviews[existingIdx] = newReview;
    else reviews.push(newReview);
    saveReviews(); return null;
}

function deleteReview(reviewId, reviewUsername) {
    if (!currentUser) return false;
    if (isAdmin(currentUser) || currentUser === reviewUsername) {
        reviews = reviews.filter(r => r.id !== reviewId);
        replies = replies.filter(r => r.reviewId !== reviewId);
        saveReviews(); saveReplies();
        return true;
    }
    return false;
}

function addComplaint(targetUser, reason, animeId, reviewComment) {
    if (!currentUser || currentUser === targetUser || isAdmin(currentUser)) return "Ошибка";
    complaints.push({ id: Date.now(), fromUser: currentUser, targetUser, reason, animeId, reviewComment, date: new Date().toISOString() });
    saveComplaints(); return null;
}

// ==================== ОТВЕТЫ НА ОТЗЫВЫ ====================
function addReply(reviewId, animeId, text) {
    if (!currentUser || isBanned(currentUser) || !text.trim()) return false;
    replies.push({ id: Date.now(), reviewId, animeId, author: currentUser, text: text.trim(), date: new Date().toISOString() });
    saveReplies();
    return true;
}

function deleteReply(replyId, replyAuthor) {
    if (!currentUser) return false;
    if (isAdmin(currentUser) || currentUser === replyAuthor) {
        replies = replies.filter(r => r.id !== replyId);
        saveReplies();
        return true;
    }
    return false;
}

function getRepliesForReview(reviewId) {
    return replies.filter(r => r.reviewId === reviewId).sort((a,b) => new Date(a.date) - new Date(b.date));
}

// ==================== АНИМЕ ДНЯ ====================
function getAnimeOfDay() {
    const today = new Date().toDateString();
    const storedDate = localStorage.getItem('anirank_aod_date');
    const storedId = localStorage.getItem('anirank_aod_id');
    if (storedDate === today && storedId) {
        const anime = animeLibrary.find(a => a.id == storedId);
        if (anime) return anime;
    }
    const randomIndex = Math.floor(Math.random() * animeLibrary.length);
    const newAnime = animeLibrary[randomIndex];
    localStorage.setItem('anirank_aod_date', today);
    localStorage.setItem('anirank_aod_id', newAnime.id);
    return newAnime;
}

function renderAnimeOfDay() {
    const container = document.getElementById('animeOfDayContainer');
    if (!animeLibrary.length) return;
    const anime = getAnimeOfDay();
    container.innerHTML = `
        <img class="aod-image" src="${anime.imageUrl}" onerror="this.src='https://placehold.co/100x150/1e293b/00bfa6'">
        <div class="aod-info">
            <div class="aod-badge">🌟 Аниме дня</div>
            <div class="aod-title">${anime.title}</div>
            <div class="rating-badge" style="margin:0.3rem 0;">⭐ ${anime.rating.toFixed(1)}</div>
            <div class="genres">${anime.genres.map(g=>`<span class="genre-tag">${g}</span>`).join('')}</div>
            <div class="aod-desc">${anime.description.substring(0, 120)}${anime.description.length > 120 ? '...' : ''}</div>
        </div>
    `;
    container.onclick = () => openAnimeModal(anime);
}

// ==================== UI И РЕНДЕРИНГ ====================
function updateUI() {
    const greeting = document.getElementById('userGreeting'), authBtn = document.getElementById('authModalBtn'), logoutBtn = document.getElementById('logoutBtn'), adminBtn = document.getElementById('adminPanelBtn');
    if (currentUser) {
        greeting.innerText = `👤 ${currentUser} ${isBanned(currentUser) ? '⛔' : ''}`;
        authBtn.style.display = 'none'; logoutBtn.style.display = 'inline-block';
        adminBtn.style.display = isAdmin(currentUser) ? 'inline-block' : 'none';
    } else { 
        greeting.innerText = '👋 Гость'; 
        authBtn.style.display = 'inline-block'; 
        logoutBtn.style.display = 'none'; 
        adminBtn.style.display = 'none'; 
    }
}

let currentSearch = "", currentGenre = "all", currentAge = "all", currentSort = "rating";

function filterAndSort() {
    let res = [...animeLibrary];
    if (currentSearch.trim()) res = res.filter(a => a.title.toLowerCase().includes(currentSearch.toLowerCase()) || a.titleEn.toLowerCase().includes(currentSearch.toLowerCase()));
    if (currentGenre !== "all") res = res.filter(a => a.genres.includes(currentGenre));
    if (currentAge !== "all") res = res.filter(a => a.ageRating === currentAge);
    if (currentSort === "rating") res.sort((a,b)=>b.rating - a.rating);
    else if (currentSort === "title") res.sort((a,b)=>a.title.localeCompare(b.title));
    else if (currentSort === "year") res.sort((a,b)=>b.year - a.year);
    return res;
}

function getAgeClass(age) {
    if (age === "G") return "age-G";
    if (age === "PG") return "age-PG";
    return "age-R";
}

function getAgeText(age) {
    if (age === "G") return "0+";
    if (age === "PG") return "12+";
    return "17+";
}

function renderAnimeList() {
    const filtered = filterAndSort();
    const grid = document.getElementById('animeGridContainer');
    if (!filtered.length) { 
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center;">Нет аниме</div>'; 
        document.getElementById('resultCount').innerHTML = 'Найдено: 0'; 
        return; 
    }
    grid.innerHTML = filtered.map(anime => {
        const avgUser = getAverageUserRating(anime.id);
        return `<div class="anime-card" data-id="${anime.id}"><img class="card-img" src="${getImageUrl(anime)}" loading="lazy" onerror="this.src='https://placehold.co/300x450/1e293b/00bfa6?text=${encodeURIComponent(anime.title)}'"><div class="card-info"><div class="card-title">${anime.title}</div><div class="rating-badge"><span>⭐ ${anime.rating.toFixed(1)}</span><span class="stars-display">${getStarsDisplay(anime.rating)}</span><span class="age-rating ${getAgeClass(anime.ageRating)}">${getAgeText(anime.ageRating)}</span></div>${avgUser ? `<div class="user-rating-small">👥 Средняя оценка пользователей: ${avgUser} ${getStarsDisplay(parseFloat(avgUser))}</div>` : '<div class="user-rating-small">👥 Пока нет оценок пользователей</div>'}<div class="genres">${anime.genres.map(g=>`<span class="genre-tag">${g}</span>`).join('')}</div><div class="year">📅 ${anime.year}</div></div></div>`;
    }).join('');
    document.querySelectorAll('.anime-card').forEach(card => card.addEventListener('click',()=>openAnimeModal(animeLibrary.find(a=>a.id==parseInt(card.dataset.id)))));
    document.getElementById('resultCount').innerHTML = `🎌 Найдено: ${filtered.length}`;
    const filtersActive = (currentSearch !== "" || currentGenre !== "all" || currentAge !== "all");
    document.getElementById('activeFiltersHint').innerHTML = filtersActive ? "🔍 Фильтры активны" : "🌟 Все аниме";
}

// ==================== ПЛАВНОЕ ОТКРЫТИЕ/ЗАКРЫТИЕ МОДАЛЬНЫХ ОКОН ====================
function showModal(modal) {
    modal.style.display = 'flex';
    // Небольшая задержка для активации анимации
    setTimeout(() => { modal.classList.add('active'); }, 10);
}

function hideModal(modal) {
    modal.classList.remove('active');
    setTimeout(() => { modal.style.display = 'none'; }, 200);
}

// ==================== ОТКРЫТИЕ МОДАЛЬНОГО ОКНА С АНИМЕ ====================
function openAnimeModal(anime) {
    const modal = document.getElementById('animeModal');
    const detailDiv = document.getElementById('animeDetailInner'), trailerDiv = document.getElementById('trailerContainer'), reviewSec = document.getElementById('reviewSection'), recommendSec = document.getElementById('recommendSection'), addBlock = document.getElementById('addReviewBlock');
    const animeReviews = reviews.filter(r => r.animeId === anime.id);
    const avgUser = getAverageUserRating(anime.id);
    trailerDiv.style.display = 'none'; trailerDiv.innerHTML = '';
    
    detailDiv.innerHTML = `<div style="display:flex; gap:1.8rem; flex-wrap:wrap; align-items:flex-start;"><img class="anime-cover-large" src="${getImageUrl(anime)}" onerror="this.src='https://placehold.co/150x225/1e293b/00bfa6?text=${encodeURIComponent(anime.title)}'"><div class="modal-info-column"><h2>${anime.title}</h2><p style="color:var(--text-secondary); margin-bottom:0.5rem;">${anime.titleEn}</p><div class="rating-badge" style="margin:0.5rem 0;"><span>⭐ Официальный: ${anime.rating}</span><span class="stars-display">${getStarsDisplay(anime.rating)}</span><span class="age-rating ${getAgeClass(anime.ageRating)}">${getAgeText(anime.ageRating)}</span></div>${avgUser ? `<div class="user-rating-small" style="margin-bottom:0.8rem;">👥 Средняя оценка пользователей: ${avgUser} ${getStarsDisplay(parseFloat(avgUser))}</div>` : '<div class="user-rating-small" style="margin-bottom:0.8rem;">👥 Пока нет оценок пользователей</div>'}<p><strong>Жанры:</strong> ${anime.genres.join(', ')}</p><p><strong>Год:</strong> ${anime.year} | <strong>Эпизоды:</strong> ${anime.episodes} | <strong>Студия:</strong> ${anime.studio}</p><p style="margin-top:0.8rem;"><strong>📖 Описание:</strong><br>${anime.description}</p><button id="watchTrailerBtn" class="btn-primary btn-trailer">▶ Смотреть трейлер</button></div></div>`;
    
    reviewSec.innerHTML = `<h4 style="margin-top:1.5rem;">📝 Отзывы (${animeReviews.length})</h4><div>${animeReviews.length===0?'<p>Нет отзывов</p>':animeReviews.map(r => {
        const reviewReplies = getRepliesForReview(r.id);
        return `<div class="review-item">
            <div class="review-user">${r.username}</div>
            <div class="review-rating">⭐ ${r.rating}/10 ${getStarsDisplay(r.rating)}</div>
            <div class="review-text">${r.comment}</div>
            <div class="review-actions">
                ${!isAdmin(currentUser) && currentUser && currentUser!==r.username && !isBanned(currentUser) ? `<button class="complaint-btn" data-target="${r.username}" data-anime="${anime.id}" data-comment="${r.comment.replace(/"/g,'&quot;')}">⚠️ Жалоба</button>` : ''}
                ${(isAdmin(currentUser)||currentUser===r.username) ? `<button class="delete-review-btn" data-review-id="${r.id}">🗑 Удалить</button>` : ''}
                ${currentUser && !isBanned(currentUser) ? `<button class="reply-btn" data-review-id="${r.id}">💬 Ответить</button>` : ''}
            </div>
            ${reviewReplies.length ? `<div class="replies">${reviewReplies.map(rep => `
                <div class="reply-item">
                    <span class="reply-author">${rep.author}</span>: ${rep.text}
                    ${(isAdmin(currentUser)||currentUser===rep.author) ? `<button class="reply-delete-btn" data-reply-id="${rep.id}">✕</button>` : ''}
                    <div style="font-size:0.6rem; color:var(--text-secondary);">${new Date(rep.date).toLocaleString()}</div>
                </div>
            `).join('')}</div>` : ''}
        </div>`;
    }).join('')}</div>`;
    
    const recommendations = getRecommendations(anime, 4);
    if (recommendations.length > 0) {
        recommendSec.innerHTML = `<h4>🎯 Вам может понравиться</h4><div class="rec-grid">${recommendations.map(rec => `
            <div class="rec-card" data-id="${rec.id}">
                <img class="rec-img" src="${getImageUrl(rec)}" onerror="this.src='https://placehold.co/140x210/1e293b/00bfa6?text=${encodeURIComponent(rec.title)}'">
                <div class="rec-info">
                    <div class="rec-title">${rec.title}</div>
                    <div class="rec-rating">⭐ ${rec.rating.toFixed(1)}</div>
                </div>
            </div>
        `).join('')}</div>`;
        document.querySelectorAll('.rec-card').forEach(card => {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                const recId = parseInt(card.dataset.id);
                const recAnime = animeLibrary.find(a => a.id === recId);
                if (recAnime) openAnimeModal(recAnime);
            });
        });
    } else { recommendSec.innerHTML = ''; }
    
    if (currentUser && !isBanned(currentUser)) {
        const existing = reviews.find(r=>r.animeId===anime.id && r.username===currentUser);
        const currentRating = existing ? existing.rating : 0;
        const starValue = Math.round(currentRating / 2);
        let starsHtml = '<div class="rating-stars">';
        for (let i = 5; i >= 1; i--) {
            starsHtml += `<input type="radio" id="star${i}" name="rating" value="${i}" ${starValue === i ? 'checked' : ''}><label for="star${i}" title="${i} звезд"></label>`;
        }
        starsHtml += '</div><input type="hidden" id="reviewRatingValue" value="' + currentRating + '"><div id="ratingPreview" class="rating-value-display">Оценка: ' + (currentRating > 0 ? currentRating.toFixed(1) + '/10' : 'не выбрана') + '</div>';
        addBlock.innerHTML = `<h4>${existing?'✏️ Изменить':'➕ Добавить'} оценку</h4>${starsHtml}<div class="form-group"><textarea id="reviewComment" placeholder="Ваш отзыв">${existing?existing.comment:''}</textarea></div><button id="submitReviewBtn" class="btn-primary">${existing?'Обновить':'Отправить'}</button><div id="reviewError"></div>`;
        setTimeout(() => {
            const starsRadios = document.querySelectorAll('.rating-stars input');
            const ratingPreview = document.getElementById('ratingPreview');
            const ratingHidden = document.getElementById('reviewRatingValue');
            starsRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    const val = parseInt(e.target.value);
                    const displayVal = val * 2;
                    ratingHidden.value = displayVal;
                    ratingPreview.innerText = `Оценка: ${displayVal}.0/10`;
                });
            });
        }, 10);
        document.getElementById('submitReviewBtn').onclick = () => {
            const rating = parseFloat(document.getElementById('reviewRatingValue').value);
            const comment = document.getElementById('reviewComment').value;
            const err = addReview(anime.id, rating, comment);
            if(err) document.getElementById('reviewError').innerText = err;
            else { openAnimeModal(anime); renderAnimeList(); }
        };
    } else if(!currentUser) addBlock.innerHTML = `<p style="text-align:center; margin-top:1rem;">🔐 <span class="login-link" id="loginLinkFromReview">Войдите в аккаунт</span>, чтобы оценить</p>`;
    else addBlock.innerHTML = `<p style="color:red; text-align:center;">Вы забанены</p>`;
    
    // Обработчики кнопок
    document.querySelectorAll('.delete-review-btn').forEach(btn=>btn.addEventListener('click',(e)=>{ e.stopPropagation(); const reviewId = parseInt(btn.dataset.reviewId); const review = reviews.find(r => r.id === reviewId); if(review && deleteReview(reviewId, review.username)){ openAnimeModal(anime); renderAnimeList(); } }));
    document.querySelectorAll('.complaint-btn').forEach(btn=>btn.addEventListener('click',(e)=>{ e.stopPropagation(); const reason=prompt(`Причина жалобы на ${btn.dataset.target}:`); if(reason) addComplaint(btn.dataset.target, reason, parseInt(btn.dataset.anime), btn.dataset.comment); alert("Жалоба отправлена"); }));
    document.querySelectorAll('.reply-btn').forEach(btn=>btn.addEventListener('click',(e)=>{ e.stopPropagation(); const reviewId = parseInt(btn.dataset.reviewId); const replyText = prompt("Ваш ответ:"); if(replyText && replyText.trim()){ addReply(reviewId, anime.id, replyText); openAnimeModal(anime); } }));
    document.querySelectorAll('.reply-delete-btn').forEach(btn=>btn.addEventListener('click',(e)=>{ e.stopPropagation(); const replyId = parseInt(btn.dataset.replyId); const reply = replies.find(r => r.id === replyId); if(reply && deleteReply(replyId, reply.author)){ openAnimeModal(anime); } }));
    
    setTimeout(() => {
        const trailerBtn = document.getElementById('watchTrailerBtn');
        if (trailerBtn) trailerBtn.onclick = () => showTrailer(anime);
    }, 50);
    
    const loginLink = document.getElementById('loginLinkFromReview'); if(loginLink) loginLink.onclick = () => { hideModal(modal); openAuthModal(); };
    
    // Плавное открытие
    showModal(modal);
    
    // Прокрутка содержимого вверх
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.scrollTop = 0;
    }
}

// ==================== АДМИН-ПАНЕЛЬ ====================
function openAdminPanel() {
    if(!isAdmin(currentUser)) return;
    const modal = document.getElementById('adminModal');
    const usersDiv = document.getElementById('adminUsersList');
    const complaintsDiv = document.getElementById('adminComplaintsList');
    let searchTerm = "";
    
    function renderUsers() {
        const filtered = users.filter(u => u.username !== "Admin" && u.username.toLowerCase().includes(searchTerm.toLowerCase()));
        usersDiv.innerHTML = `<div class="search-box"><input type="text" id="userSearchInput" placeholder="🔍 Поиск..." style="width:100%;"></div><h3>👥 Пользователи (${filtered.length})</h3>` + filtered.map(u => `<div class="user-list-item"><span><strong>${u.username}</strong> ${bannedUsers.includes(u.username) ? '⛔ ЗАБАНЕН' : '✅ активен'} ${u.isAdmin ? '👑 АДМИН' : ''}<br><small>Отзывов: ${reviews.filter(r => r.username === u.username).length}</small></span><div><button class="ban-btn ${bannedUsers.includes(u.username) ? 'unban-btn' : ''}" data-user="${u.username}">${bannedUsers.includes(u.username) ? 'Разбанить' : 'Забанить'}</button>${!u.isAdmin ? `<button class="make-admin-btn" data-make-admin="${u.username}">👑 Дать админа</button>` : `<button class="remove-admin-btn" data-remove-admin="${u.username}">🔻 Забрать админку</button>`}<button class="delete-account-btn" data-delete="${u.username}">🗑 Удалить</button></div></div>`).join('');
        
        document.querySelectorAll('[data-user]').forEach(btn => btn.addEventListener('click', () => { bannedUsers.includes(btn.dataset.user) ? unbanUser(btn.dataset.user) : banUser(btn.dataset.user); renderUsers(); renderAnimeList(); updateUI(); }));
        document.querySelectorAll('[data-make-admin]').forEach(btn => btn.addEventListener('click', () => { makeAdmin(btn.dataset.makeAdmin); renderUsers(); }));
        document.querySelectorAll('[data-remove-admin]').forEach(btn => btn.addEventListener('click', () => { removeAdmin(btn.dataset.removeAdmin); renderUsers(); }));
        document.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => { if (confirm(`Удалить ${btn.dataset.delete}?`)) deleteUserAccount(btn.dataset.delete); renderUsers(); renderAnimeList(); updateUI(); }));
        
        const inp = document.getElementById('userSearchInput');
        if (inp) inp.addEventListener('input', (e) => { searchTerm = e.target.value; renderUsers(); });
    }
    
    function renderComplaints() {
        complaintsDiv.innerHTML = `<h3>⚠️ Жалобы (${complaints.length})</h3>` + complaints.map(c => `<div class="complaint-item"><div><strong>От:</strong> ${c.fromUser}<br><strong>На:</strong> ${c.targetUser}<br><strong>Причина:</strong> ${c.reason}<br><strong>Аниме:</strong> ${animeLibrary.find(a => a.id === c.animeId)?.title || c.animeId}<br><small>${new Date(c.date).toLocaleString()}</small></div><div><button class="ban-btn" data-complaint-user="${c.targetUser}">🚫 Забанить</button> <button class="delete-review-btn" data-complaint-id="${c.id}">🗑 Удалить жалобу</button></div></div>`).join('');
        
        document.querySelectorAll('[data-complaint-user]').forEach(btn => btn.addEventListener('click', () => { banUser(btn.dataset.complaintUser); renderComplaints(); renderUsers(); updateUI(); }));
        document.querySelectorAll('[data-complaint-id]').forEach(btn => btn.addEventListener('click', () => { complaints = complaints.filter(c => c.id !== parseInt(btn.dataset.complaintId)); saveComplaints(); renderComplaints(); }));
    }
    
    renderUsers();
    renderComplaints();
    usersDiv.style.display = 'block';
    complaintsDiv.style.display = 'none';
    
    document.getElementById('showUsersTab').onclick = () => { usersDiv.style.display = 'block'; complaintsDiv.style.display = 'none'; renderUsers(); };
    document.getElementById('showComplaintsTab').onclick = () => { usersDiv.style.display = 'none'; complaintsDiv.style.display = 'block'; renderComplaints(); };
    
    showModal(modal);
}

// ==================== МОДАЛКИ АВТОРИЗАЦИИ ====================
const authModal = document.getElementById('authModal');

function openAuthModal() { 
    showModal(authModal);
    showLogin(); 
    const modalContent = authModal.querySelector('.modal-content');
    if (modalContent) modalContent.scrollTop = 0;
}

function closeAuthModal() { 
    hideModal(authModal);
}

function showLogin() { 
    document.getElementById('authFormContainer').style.display = 'block'; 
    document.getElementById('regFormContainer').style.display = 'none'; 
    document.getElementById('authTitle').innerText = 'Вход'; 
}

function showReg() { 
    document.getElementById('authFormContainer').style.display = 'none'; 
    document.getElementById('regFormContainer').style.display = 'block'; 
    document.getElementById('authTitle').innerText = 'Регистрация'; 
}

document.getElementById('doLoginBtn').onclick = () => { const err = loginUser(document.getElementById('loginUsername').value, document.getElementById('loginPassword').value); if (err) document.getElementById('authError').innerText = err; else closeAuthModal(); };
document.getElementById('doRegisterBtn').onclick = () => { const err = registerUser(document.getElementById('regUsername').value, document.getElementById('regPassword').value); if (err) document.getElementById('regError').innerText = err; else { loginUser(document.getElementById('regUsername').value, document.getElementById('regPassword').value); closeAuthModal(); } };
document.getElementById('switchToRegister').onclick = showReg;
document.getElementById('switchToLogin').onclick = showLogin;
document.getElementById('authModalBtn').onclick = openAuthModal;
document.getElementById('logoutBtn').onclick = logout;
document.getElementById('closeAuthModal').onclick = closeAuthModal;
document.getElementById('closeAnimeModal').onclick = () => hideModal(document.getElementById('animeModal'));
document.getElementById('adminPanelBtn').onclick = openAdminPanel;
document.getElementById('closeAdminModal').onclick = () => hideModal(document.getElementById('adminModal'));

window.onclick = (e) => { 
    if (e.target === authModal) closeAuthModal();
    if (e.target === document.getElementById('animeModal')) hideModal(document.getElementById('animeModal'));
    if (e.target === document.getElementById('adminModal')) hideModal(document.getElementById('adminModal'));
};

// ==================== ИНИЦИАЛИЗАЦИЯ ЖАНРОВ И СОБЫТИЙ ====================
const allGenres = [...new Set(animeLibrary.flatMap(a => a.genres))].sort();
const genreSel = document.getElementById('genreFilter');
allGenres.forEach(g => { let opt = document.createElement('option'); opt.value = g; opt.textContent = g; genreSel.appendChild(opt); });

document.getElementById('searchInput').addEventListener('input', e => { currentSearch = e.target.value; renderAnimeList(); });
genreSel.addEventListener('change', e => { currentGenre = e.target.value; renderAnimeList(); });
document.getElementById('ageFilter').addEventListener('change', e => { currentAge = e.target.value; renderAnimeList(); });
document.getElementById('sortSelect').addEventListener('change', e => { currentSort = e.target.value; renderAnimeList(); });
document.getElementById('resetFilters').onclick = () => { currentSearch = ""; currentGenre = "all"; currentAge = "all"; currentSort = "rating"; document.getElementById('searchInput').value = ""; genreSel.value = "all"; document.getElementById('ageFilter').value = "all"; document.getElementById('sortSelect').value = "rating"; renderAnimeList(); };

// ==================== ТЕМЫ ====================
const setTheme = (theme) => { 
    document.body.classList.remove('theme-light', 'theme-pink', 'theme-dark'); 
    document.body.classList.add(theme === 'light' ? 'theme-light' : theme === 'pink' ? 'theme-pink' : 'theme-dark'); 
    localStorage.setItem('anirank_theme', theme); 
    document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active')); 
    document.querySelector(`.theme-btn[data-theme="${theme}"]`).classList.add('active'); 
    const logoDark = document.querySelector('.logo-dark'), logoLight = document.querySelector('.logo-light'), logoPink = document.querySelector('.logo-pink');
    if (theme === 'dark') { logoDark.style.display = 'block'; logoLight.style.display = 'none'; logoPink.style.display = 'none'; }
    else if (theme === 'light') { logoDark.style.display = 'none'; logoLight.style.display = 'block'; logoPink.style.display = 'none'; }
    else if (theme === 'pink') { logoDark.style.display = 'none'; logoLight.style.display = 'none'; logoPink.style.display = 'block'; }
    
    // Если модальное окно аниме открыто — прокручиваем его вверх
    const animeModal = document.getElementById('animeModal');
    if (animeModal && animeModal.style.display === 'flex') {
        const modalContent = animeModal.querySelector('.modal-content');
        if (modalContent) modalContent.scrollTop = 0;
    }
    // Если модальное окно авторизации открыто — прокручиваем его вверх
    if (authModal && authModal.style.display === 'flex') {
        const modalContent = authModal.querySelector('.modal-content');
        if (modalContent) modalContent.scrollTop = 0;
    }
};

document.querySelectorAll('.theme-btn').forEach(btn => btn.addEventListener('click', () => setTheme(btn.dataset.theme)));
setTheme(localStorage.getItem('anirank_theme') || 'dark');

// ==================== ЗАПУСК ====================
initAdmin(); 
updateUI(); 
renderAnimeList(); 
renderAnimeOfDay();