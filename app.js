/**
 * RACE4LIFE — Client Application Logic (Editorial Magazine Edition)
 * Полная клиентская логика, реактивное управление состоянием, фильтрация,
 * человечный календарь-архив и полный CRUD постов в localStorage.
 */

(function () {
  'use strict';

  // ========================================================
  // 1. СОСТОЯНИЕ ПРИЛОЖЕНИЯ (APP STATE)
  // ========================================================
  const state = {
    posts: [],
    filteredPosts: [],
    displayedCount: 15, // Показ порциями по 15 постов
    authorMode: true,   // true = режим редактора (CRUD кнопки), false = режим чтения (чистый журнальный вид)
    authorName: 'Автор блога',
    selectedCategory: 'all',
    selectedDate: null, // 'YYYY-MM-DD' или null
    searchQuery: '',
    sortOrder: 'newest', // 'newest' | 'oldest' | 'popular' | 'likes'
    activeCalendarTab: 'sep', // 'sep' (16-30 сен) | 'oct' (01-16 окт)
    editingPostId: null,
    deletingPostId: null,
    readingPostId: null,
    selectedImageMode: 'url',
    currentCoverData: ''
  };

  // Мягкая SVG-заглушка на случай проблем со связью
  const FALLBACK_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 450' width='800' height='450'%3E%3Crect width='800' height='450' fill='%2317181C'/%3E%3Ctext x='400' y='225' fill='%23666' font-family='sans-serif' font-size='18' text-anchor='middle'%3ERACE4LIFE &bull; Motorsport Media%3C/text%3E%3C/svg%3E";

  const MONTH_NAMES_GEN = {
    '09': 'сентября',
    '10': 'октября'
  };

  const MONTH_NAMES_SHORT = {
    '09': 'сен',
    '10': 'окт'
  };

  const WEEK_DAYS_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  // ========================================================
  // 2. ИНИЦИАЛИЗАЦИЯ И ХРАНИЛИЩЕ
  // ========================================================
  function initApp() {
    console.log('RACE4LIFE: Инициализация журнального приложения...');

    // Загрузка или генерация 465 постов
    if (window.DataGenerator && typeof window.DataGenerator.seedDatabase === 'function') {
      state.posts = window.DataGenerator.seedDatabase(false);
    } else {
      console.error('RACE4LIFE: DataGenerator не найден!');
      state.posts = [];
    }

    // Загрузка настроек автора
    try {
      const savedMode = localStorage.getItem('race4life_author_mode');
      if (savedMode !== null) {
        state.authorMode = savedMode === 'true';
      }
      const savedName = localStorage.getItem('race4life_author_name');
      if (savedName) {
        state.authorName = savedName;
      }
    } catch (e) {
      console.warn('RACE4LIFE: Ошибка чтения настроек:', e);
    }

    updateAuthorNameUI();
    updateModeSwitchUI();
    setupEventListeners();

    applyFiltersAndSort();
    renderCalendar();
    renderTelemetryAnalytics();
    refreshIcons();

    console.log(`RACE4LIFE: Загружено ${state.posts.length} публикаций.`);
  }

  function savePostsToStorage() {
    try {
      const storageKey = (window.DataGenerator && window.DataGenerator.STORAGE_KEY) || 'race4life_posts_v8';
      localStorage.setItem(storageKey, JSON.stringify(state.posts));
    } catch (err) {
      console.error('RACE4LIFE: Ошибка записи в localStorage:', err);
      showToast('Ошибка сохранения данных в браузере', 'error');
    }
  }

  // ========================================================
  // 3. ФИЛЬТРАЦИЯ, ПОИСК И СОРТИРОВКА
  // ========================================================
  function applyFiltersAndSort() {
    let result = [...state.posts];

    // 1. Рубрика
    if (state.selectedCategory && state.selectedCategory !== 'all') {
      result = result.filter(post => post.category === state.selectedCategory);
    }

    // 2. Дата
    if (state.selectedDate) {
      result = result.filter(post => post.date === state.selectedDate);
    }

    // 3. Поиск
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase().trim();
      result = result.filter(post => 
        (post.title && post.title.toLowerCase().includes(q)) ||
        (post.excerpt && post.excerpt.toLowerCase().includes(q)) ||
        (post.content && post.content.toLowerCase().includes(q))
      );
    }

    // 4. Сортировка
    result.sort((a, b) => {
      if (state.sortOrder === 'newest') {
        return new Date(b.timestamp) - new Date(a.timestamp);
      } else if (state.sortOrder === 'oldest') {
        return new Date(a.timestamp) - new Date(b.timestamp);
      } else if (state.sortOrder === 'popular') {
        return b.views - a.views;
      } else if (state.sortOrder === 'likes') {
        return b.likes - a.likes;
      }
      return 0;
    });

    state.filteredPosts = result;

    updateNavigationCounts();
    updateFilterBannersUI();
    renderFeed();
  }

  function updateNavigationCounts() {
    const totalCount = state.posts.length;
    const f1Count = state.posts.filter(p => p.category === 'f1-news').length;
    const scienceCount = state.posts.filter(p => p.category === 'car-science').length;
    const trackCount = state.posts.filter(p => p.category === 'track-history').length;
    const simCount = state.posts.filter(p => p.category === 'simracing').length;

    const elTotal = document.getElementById('badge-total-posts-nav');
    const elAll = document.getElementById('nav-count-all');
    const elF1 = document.getElementById('nav-count-f1-news');
    const elScience = document.getElementById('nav-count-car-science');
    const elTrack = document.getElementById('nav-count-track-history');
    const elSim = document.getElementById('nav-count-simracing');

    if (elTotal) elTotal.textContent = totalCount;
    if (elAll) elAll.textContent = totalCount;
    if (elF1) elF1.textContent = f1Count;
    if (elScience) elScience.textContent = scienceCount;
    if (elTrack) elTrack.textContent = trackCount;
    if (elSim) elSim.textContent = simCount;

    document.querySelectorAll('.category-nav-btn').forEach(btn => {
      const cat = btn.getAttribute('data-category');
      if (cat === state.selectedCategory) {
        btn.classList.add('bg-surface-800', 'text-white');
        btn.classList.remove('text-zinc-400');
      } else {
        btn.classList.remove('bg-surface-800', 'text-white');
        btn.classList.add('text-zinc-400');
      }
    });
  }

  function updateFilterBannersUI() {
    const activeDayBanner = document.getElementById('active-day-banner');
    const activeDayTitle = document.getElementById('active-day-banner-title');
    const activeDayCount = document.getElementById('active-day-banner-count');

    if (state.selectedDate) {
      const [year, month, day] = state.selectedDate.split('-');
      const monthRu = MONTH_NAMES_GEN[month] || month;
      const countForDay = state.posts.filter(p => p.date === state.selectedDate).length;

      if (activeDayBanner) activeDayBanner.classList.remove('hidden');
      if (activeDayTitle) activeDayTitle.textContent = `${Number(day)} ${monthRu} ${year}`;
      if (activeDayCount) activeDayCount.textContent = `Опубликовано ${countForDay} материалов`;
    } else {
      if (activeDayBanner) activeDayBanner.classList.add('hidden');
    }

    const searchFilterBanner = document.getElementById('search-filter-banner');
    const searchFilterText = document.getElementById('search-filter-text');

    if (state.searchQuery.trim() || (state.selectedCategory !== 'all')) {
      if (searchFilterBanner) searchFilterBanner.classList.remove('hidden');
      const parts = [];
      if (state.selectedCategory !== 'all') {
        const catMeta = window.DataGenerator.CATEGORIES[state.selectedCategory];
        parts.push(`Рубрика: ${catMeta ? catMeta.name : state.selectedCategory}`);
      }
      if (state.searchQuery.trim()) {
        parts.push(`Поиск: "${state.searchQuery.trim()}"`);
      }
      if (searchFilterText) searchFilterText.textContent = parts.join(' &middot; ');
    } else {
      if (searchFilterBanner) searchFilterBanner.classList.add('hidden');
    }

    const resultsCountEl = document.getElementById('feed-results-count');
    if (resultsCountEl) resultsCountEl.textContent = state.filteredPosts.length;
  }

  // ========================================================
  // 4. РЕНДЕРИНГ ЛЕНТЫ (ЖУРНАЛЬНЫЙ СТИЛЬ)
  // ========================================================
  function renderFeed() {
    const container = document.getElementById('posts-container');
    if (!container) return;

    if (state.filteredPosts.length === 0) {
      container.innerHTML = `
        <div class="bg-surface-900 border border-surface-800 rounded-xl p-10 text-center space-y-3">
          <p class="text-sm text-zinc-300">По вашему запросу ничего не найдено</p>
          <button id="btn-empty-reset" class="text-xs text-racing-carmine hover:underline font-medium">
            Сбросить фильтры
          </button>
        </div>
      `;
      const btnReset = document.getElementById('btn-empty-reset');
      if (btnReset) {
        btnReset.addEventListener('click', resetAllFilters);
      }
      updateLoadMoreUI();
      return;
    }

    const postsToRender = state.filteredPosts.slice(0, state.displayedCount);
    container.innerHTML = postsToRender.map(post => createPostCardHTML(post)).join('');

    attachCardEventListeners(container);
    updateLoadMoreUI();
    refreshIcons();
  }

  // Генерация карточки поста в спокойном журнальном стиле (Substack/Speedhunters)
  function createPostCardHTML(post) {
    const catMeta = window.DataGenerator.CATEGORIES[post.category] || {
      name: post.category
    };

    const [year, month, day] = post.date.split('-');
    const monthGen = MONTH_NAMES_GEN[month] || month;
    const formattedDate = `${Number(day)} ${monthGen} ${year}, ${post.time}`;

    const excerpt = post.excerpt || (post.content ? post.content.slice(0, 150) + '...' : '');

    const likedClass = post.liked ? 'text-racing-carmine' : 'text-zinc-400 hover:text-racing-carmine';
    const heartSvgFill = post.liked ? 'currentColor' : 'none';

    // Кнопки управления (видны только в режиме редактора, аккуратные и неброские)
    const authorControlsHTML = state.authorMode ? `
      <div class="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity ml-auto">
        <button 
          data-action="edit" 
          data-id="${post.id}" 
          class="p-1.5 rounded text-zinc-400 hover:text-white transition-colors"
          title="Редактировать статью"
        >
          <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
        </button>
        <button 
          data-action="delete" 
          data-id="${post.id}" 
          class="p-1.5 rounded text-zinc-400 hover:text-red-400 transition-colors"
          title="Удалить статью"
        >
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    ` : '';

    return `
      <article data-post-id="${post.id}" class="group">
        <div class="post-card">
          <div class="post-cover relative overflow-hidden bg-surface-900 cursor-pointer" data-action="read" data-id="${post.id}">
            <img
              src="${post.image}"
              alt="${escapeHtml(post.title)}"
              loading="lazy"
              class="w-full h-full object-cover"
              onerror="this.onerror=null;this.src='${FALLBACK_SVG}'"
            >
          </div>

          <div class="flex-1 min-w-0 space-y-3">
            <div class="post-kicker">
              <b data-action="filter-cat" data-category="${post.category}">${catMeta.name}</b>
              <span>${formattedDate}</span>
            </div>

            <h3 class="post-title" data-action="read" data-id="${post.id}">${escapeHtml(post.title)}</h3>

            <p class="post-lead">${escapeHtml(excerpt)}</p>

            <div class="hidden pt-4 mt-2 border-t border-surface-800 post-full-content space-y-3" id="full-content-${post.id}">
              ${formatArticleText(post.content)}
            </div>

            <div class="post-meta flex items-center gap-5 pt-1">
              <button data-action="toggle-expand" data-id="${post.id}" class="uppercase tracking-wider text-zinc-300 hover:text-racing-carmine transition-colors">
                <span class="expand-btn-text">Читать далее &rarr;</span>
              </button>

              <button data-action="like" data-id="${post.id}" class="flex items-center gap-1.5 transition-colors cursor-pointer ${likedClass}" title="Оценить публикацию">
                <i data-lucide="heart" class="w-3.5 h-3.5" fill="${heartSvgFill}"></i>
                <span class="like-counter">${formatNumber(post.likes)}</span>
              </button>

              <span class="flex items-center gap-1.5"><i data-lucide="eye" class="w-3.5 h-3.5"></i>${formatNumber(post.views)}</span>

              <button data-action="share" data-id="${post.id}" class="hover:text-white transition-colors cursor-pointer" title="Скопировать ссылку">
                <i data-lucide="share" class="w-3.5 h-3.5"></i>
              </button>

              ${authorControlsHTML}
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function attachCardEventListeners(container) {
    container.querySelectorAll('[data-action="read"]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        openReaderModal(id);
      });
    });

    container.querySelectorAll('[data-action="filter-cat"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const cat = el.getAttribute('data-category');
        state.selectedCategory = cat;
        state.displayedCount = 15;
        applyFiltersAndSort();
      });
    });

    container.querySelectorAll('[data-action="toggle-expand"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        toggleExpandPost(id, btn);
      });
    });

    container.querySelectorAll('[data-action="like"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        toggleLike(id, btn);
      });
    });

    container.querySelectorAll('[data-action="share"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        sharePost(id);
      });
    });

    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        openEditPostModal(id);
      });
    });

    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        openDeleteModal(id);
      });
    });
  }

  function toggleExpandPost(id, btn) {
    const fullContent = document.getElementById(`full-content-${id}`);
    const textSpan = btn.querySelector('.expand-btn-text');

    if (!fullContent) return;

    if (fullContent.classList.contains('hidden')) {
      fullContent.classList.remove('hidden');
      if (textSpan) textSpan.innerHTML = '&larr; Свернуть';
      incrementViews(id);
    } else {
      fullContent.classList.add('hidden');
      if (textSpan) textSpan.innerHTML = 'Читать далее &rarr;';
    }
  }

  function updateLoadMoreUI() {
    const container = document.getElementById('load-more-container');
    const textSpan = document.getElementById('load-more-text');
    const progressSpan = document.getElementById('load-more-progress');
    const btn = document.getElementById('btn-load-more');

    if (!container || !btn) return;

    const total = state.filteredPosts.length;
    const current = Math.min(state.displayedCount, total);

    if (current >= total || total === 0) {
      container.classList.add('hidden');
    } else {
      container.classList.remove('hidden');
      if (textSpan) textSpan.textContent = `Показать еще публикации`;
      if (progressSpan) progressSpan.textContent = `(${current} из ${total})`;
    }
  }

  // ========================================================
  // 5. ЧЕЛОВЕЧНЫЙ КАЛЕНДАРЬ-АРХИВ ПО ДНЯМ
  // ========================================================
  function renderCalendar() {
    const container = document.getElementById('calendar-grid-container');
    if (!container) return;

    const daysList = [];
    if (state.activeCalendarTab === 'sep') {
      for (let d = 16; d <= 30; d++) {
        daysList.push(`2026-09-${String(d).padStart(2, '0')}`);
      }
    } else {
      for (let d = 1; d <= 16; d++) {
        daysList.push(`2026-10-${String(d).padStart(2, '0')}`);
      }
    }

    const postsByDate = {};
    state.posts.forEach(p => {
      postsByDate[p.date] = (postsByDate[p.date] || 0) + 1;
    });

    const calendarHtml = daysList.map(dateStr => {
      const count = postsByDate[dateStr] || 0;
      const [year, month, day] = dateStr.split('-');
      const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
      const weekDay = WEEK_DAYS_RU[dateObj.getDay()];
      const isSelected = state.selectedDate === dateStr;

      const activeClass = isSelected 
        ? 'calendar-day-active' 
        : 'bg-surface-950 hover:bg-surface-800 border-surface-800 text-zinc-300';

      return `
        <button 
          data-date="${dateStr}"
          class="calendar-day-btn p-1.5 rounded-lg border text-center transition-colors flex flex-col items-center justify-center h-12 ${activeClass}"
          title="${Number(day)} ${MONTH_NAMES_SHORT[month]}: ${count} постов"
        >
          <span class="text-xs font-semibold">${Number(day)}</span>
          <span class="text-[9px] text-zinc-500 day-week">${weekDay}</span>
          <span class="w-1 h-1 rounded-full ${count > 0 ? 'bg-zinc-500' : 'bg-transparent'} day-dot mt-0.5"></span>
        </button>
      `;
    }).join('');

    container.innerHTML = calendarHtml;

    container.querySelectorAll('.calendar-day-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const dateStr = btn.getAttribute('data-date');
        if (state.selectedDate === dateStr) {
          state.selectedDate = null;
        } else {
          state.selectedDate = dateStr;
        }
        state.displayedCount = 15;
        applyFiltersAndSort();
        renderCalendar();
      });
    });

    // Сводка закрытых дней
    let closedDays = 0;
    const all31Days = [];
    for (let d = 16; d <= 30; d++) all31Days.push(`2026-09-${String(d).padStart(2, '0')}`);
    for (let d = 1; d <= 16; d++) all31Days.push(`2026-10-${String(d).padStart(2, '0')}`);
    all31Days.forEach(d => {
      if ((postsByDate[d] || 0) >= 15) closedDays++;
    });

    const completionBadge = document.getElementById('calendar-completion-badge');
    if (completionBadge) {
      completionBadge.textContent = `${closedDays} из 31 дня`;
    }
  }

  // ========================================================
  // 6. СТАТИСТИКА БЛОГА
  // ========================================================
  function renderTelemetryAnalytics() {
    const totalPosts = state.posts.length;

    let totalViews = 0;
    let totalLikes = 0;
    const catCounts = {
      'f1-news': 0,
      'car-science': 0,
      'track-history': 0,
      'simracing': 0
    };

    state.posts.forEach(p => {
      totalViews += Number(p.views) || 0;
      totalLikes += Number(p.likes) || 0;
      if (catCounts[p.category] !== undefined) {
        catCounts[p.category]++;
      }
    });

    const kpiTotalPosts = document.getElementById('kpi-total-posts');
    const kpiTotalViews = document.getElementById('kpi-total-views');
    const kpiTotalLikes = document.getElementById('kpi-total-likes');

    if (kpiTotalPosts) kpiTotalPosts.textContent = totalPosts;
    if (kpiTotalViews) kpiTotalViews.textContent = formatNumber(totalViews);
    if (kpiTotalLikes) kpiTotalLikes.textContent = formatNumber(totalLikes);

    const pctF1 = totalPosts > 0 ? Math.round((catCounts['f1-news'] / totalPosts) * 100) : 0;
    const pctSci = totalPosts > 0 ? Math.round((catCounts['car-science'] / totalPosts) * 100) : 0;
    const pctHist = totalPosts > 0 ? Math.round((catCounts['track-history'] / totalPosts) * 100) : 0;
    const pctSim = totalPosts > 0 ? Math.round((catCounts['simracing'] / totalPosts) * 100) : 0;

    const elPctF1 = document.getElementById('pct-f1');
    const elPctSci = document.getElementById('pct-science');
    const elPctHist = document.getElementById('pct-history');
    const elPctSim = document.getElementById('pct-sim');

    if (elPctF1) elPctF1.textContent = `${pctF1}% (${catCounts['f1-news']})`;
    if (elPctSci) elPctSci.textContent = `${pctSci}% (${catCounts['car-science']})`;
    if (elPctHist) elPctHist.textContent = `${pctHist}% (${catCounts['track-history']})`;
    if (elPctSim) elPctSim.textContent = `${pctSim}% (${catCounts['simracing']})`;
  }

  // ========================================================
  // 7. ПОЛНЫЙ CRUD
  // ========================================================
  function createPost(postData) {
    const newId = `post-${postData.date}-${Date.now().toString().slice(-4)}`;
    const newPost = {
      id: newId,
      title: postData.title.trim(),
      category: postData.category,
      date: postData.date,
      time: postData.time,
      timestamp: `${postData.date}T${postData.time}:00.000Z`,
      image: postData.image || ((window.DataGenerator && typeof window.DataGenerator.getRelevantImage === 'function')
        ? window.DataGenerator.getRelevantImage(postData.title, postData.content, postData.category)
        : (window.DataGenerator && window.DataGenerator.getRandomImage ? window.DataGenerator.getRandomImage(postData.category) : '')),
      excerpt: postData.excerpt.trim() || generateExcerptFromContent(postData.content),
      content: postData.content.trim(),
      views: Math.floor(8 + Math.random() * 20),
      likes: Math.floor(Math.random() * 4),
      liked: false
    };

    state.posts.unshift(newPost);
    savePostsToStorage();

    applyFiltersAndSort();
    renderCalendar();
    renderTelemetryAnalytics();

    showToast('Материал успешно опубликован', 'success');
  }

  function updatePost(id, updatedData) {
    const postIndex = state.posts.findIndex(p => p.id === id);
    if (postIndex === -1) {
      showToast('Ошибка: публикация не найдена', 'error');
      return;
    }

    const post = state.posts[postIndex];
    post.title = updatedData.title.trim();
    post.category = updatedData.category;
    post.date = updatedData.date;
    post.time = updatedData.time;
    post.timestamp = `${updatedData.date}T${updatedData.time}:00.000Z`;
    if (updatedData.image) post.image = updatedData.image;
    post.excerpt = updatedData.excerpt.trim() || generateExcerptFromContent(updatedData.content);
    post.content = updatedData.content.trim();

    savePostsToStorage();

    applyFiltersAndSort();
    renderCalendar();
    renderTelemetryAnalytics();

    showToast('Изменения сохранены', 'success');
  }

  function deletePost(id) {
    const index = state.posts.findIndex(p => p.id === id);
    if (index === -1) return;

    state.posts.splice(index, 1);
    savePostsToStorage();

    applyFiltersAndSort();
    renderCalendar();
    renderTelemetryAnalytics();

    showToast('Публикация удалена', 'info');
  }

  function toggleLike(id, btn) {
    const post = state.posts.find(p => p.id === id);
    if (!post) return;

    post.liked = !post.liked;
    if (post.liked) {
      post.likes += 1;
    } else {
      post.likes = Math.max(0, post.likes - 1);
    }

    savePostsToStorage();

    if (btn) {
      const counter = btn.querySelector('.like-counter');
      const icon = btn.querySelector('svg');
      if (counter) counter.textContent = formatNumber(post.likes);

      if (post.liked) {
        btn.classList.add('text-racing-carmine');
        btn.classList.remove('text-zinc-400');
        if (icon) icon.setAttribute('fill', 'currentColor');
      } else {
        btn.classList.remove('text-racing-carmine');
        btn.classList.add('text-zinc-400');
        if (icon) icon.setAttribute('fill', 'none');
      }
    }

    renderTelemetryAnalytics();
  }

  function incrementViews(id) {
    const post = state.posts.find(p => p.id === id);
    if (!post) return;

    post.views += 1;
    savePostsToStorage();

    if (state.readingPostId === id) {
      const el = document.getElementById('reader-views');
      if (el) el.textContent = formatNumber(post.views);
    }
  }

  function sharePost(id) {
    const post = state.posts.find(p => p.id === id);
    if (!post) return;

    const dummyUrl = `${window.location.origin}${window.location.pathname}#${post.id}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(dummyUrl).then(() => {
        showToast('Ссылка скопирована в буфер', 'success');
      }).catch(() => {
        showToast(`Статья: "${post.title.slice(0, 35)}..."`, 'info');
      });
    } else {
      showToast(`Статья: "${post.title.slice(0, 35)}..."`, 'info');
    }
  }

  // ========================================================
  // 8. СЖАТИЕ КАРТИНОК ДЛЯ LOCALSTORAGE (CANVAS 1000PX)
  // ========================================================
  function compressImageFile(file, callback) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        const maxWidth = 1000;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        callback(compressedBase64);
      };
      img.onerror = function () {
        showToast('Не удалось загрузить изображение', 'error');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ========================================================
  // 9. МОДАЛЬНЫЕ ОКНА
  // ========================================================
  function openCreatePostModal() {
    state.editingPostId = null;

    const modal = document.getElementById('post-modal');
    const titleEl = document.getElementById('modal-title');
    const submitText = document.getElementById('modal-submit-text');
    const form = document.getElementById('post-form');

    if (!modal || !form) return;

    titleEl.textContent = 'Новая публикация';
    submitText.textContent = 'Опубликовать';

    form.reset();

    document.getElementById('form-date').value = state.selectedDate || '2026-10-16';
    document.getElementById('form-time').value = getRandomTimeStr();
    const defaultCat = (state.selectedCategory !== 'all') ? state.selectedCategory : 'f1-news';
    document.getElementById('form-category').value = defaultCat;

    const initialImg = (window.DataGenerator && typeof window.DataGenerator.getRelevantImage === 'function')
      ? window.DataGenerator.getRelevantImage('', '', defaultCat)
      : (window.DataGenerator && window.DataGenerator.getRandomImage ? window.DataGenerator.getRandomImage(defaultCat) : '');
    document.getElementById('form-image-url').value = initialImg;
    updateCoverPreview(initialImg);

    switchCoverMode('url');
    modal.classList.remove('hidden');
    document.getElementById('form-title').focus();
  }

  function openEditPostModal(id) {
    const post = state.posts.find(p => p.id === id);
    if (!post) return;

    state.editingPostId = id;

    const modal = document.getElementById('post-modal');
    const titleEl = document.getElementById('modal-title');
    const submitText = document.getElementById('modal-submit-text');

    if (!modal) return;

    titleEl.textContent = 'Редактирование статьи';
    submitText.textContent = 'Сохранить изменения';

    document.getElementById('form-title').value = post.title;
    document.getElementById('form-category').value = post.category;
    document.getElementById('form-date').value = post.date;
    document.getElementById('form-time').value = post.time;
    document.getElementById('form-excerpt').value = post.excerpt;
    document.getElementById('form-content').value = post.content;

    if (post.image && post.image.startsWith('data:image')) {
      switchCoverMode('upload');
      updateCoverPreview(post.image);
    } else {
      switchCoverMode('url');
      document.getElementById('form-image-url').value = post.image;
      updateCoverPreview(post.image);
    }

    modal.classList.remove('hidden');
  }

  function closePostModal() {
    const modal = document.getElementById('post-modal');
    if (modal) modal.classList.add('hidden');
    state.editingPostId = null;
  }

  function switchCoverMode(mode) {
    state.selectedImageMode = mode;
    const tabUrl = document.getElementById('tab-cover-url');
    const tabUpload = document.getElementById('tab-cover-upload');
    const secUrl = document.getElementById('cover-url-section');
    const secUpload = document.getElementById('cover-upload-section');

    if (mode === 'url') {
      if (tabUrl) {
        tabUrl.classList.add('bg-surface-800', 'text-white', 'border-surface-700');
        tabUrl.classList.remove('bg-surface-950', 'text-zinc-400', 'border-surface-800');
      }
      if (tabUpload) {
        tabUpload.classList.remove('bg-surface-800', 'text-white', 'border-surface-700');
        tabUpload.classList.add('bg-surface-950', 'text-zinc-400', 'border-surface-800');
      }
      if (secUrl) secUrl.classList.remove('hidden');
      if (secUpload) secUpload.classList.add('hidden');
    } else {
      if (tabUpload) {
        tabUpload.classList.add('bg-surface-800', 'text-white', 'border-surface-700');
        tabUpload.classList.remove('bg-surface-950', 'text-zinc-400', 'border-surface-800');
      }
      if (tabUrl) {
        tabUrl.classList.remove('bg-surface-800', 'text-white', 'border-surface-700');
        tabUrl.classList.add('bg-surface-950', 'text-zinc-400', 'border-surface-800');
      }
      if (secUpload) secUpload.classList.remove('hidden');
      if (secUrl) secUrl.classList.add('hidden');
    }
  }

  function updateCoverPreview(src) {
    const preview = document.getElementById('form-cover-preview');
    if (preview && src) {
      preview.src = src;
      state.currentCoverData = src;
    }
  }

  // Модальное окно чтения статьи
  function openReaderModal(id) {
    const post = state.posts.find(p => p.id === id);
    if (!post) return;

    state.readingPostId = id;
    incrementViews(id);

    const catMeta = window.DataGenerator.CATEGORIES[post.category] || {
      name: post.category
    };

    const modal = document.getElementById('reader-modal');
    const categoryBadge = document.getElementById('reader-category-badge');
    const timestamp = document.getElementById('reader-timestamp');
    const image = document.getElementById('reader-image');
    const title = document.getElementById('reader-title');
    const views = document.getElementById('reader-views');
    const likes = document.getElementById('reader-likes');
    const content = document.getElementById('reader-content');
    const likeBtn = document.getElementById('reader-like-btn');

    if (categoryBadge) categoryBadge.textContent = `#${catMeta.name}`;

    const [year, month, day] = post.date.split('-');
    const monthGen = MONTH_NAMES_GEN[month] || month;
    if (timestamp) timestamp.textContent = `${Number(day)} ${monthGen} ${year}, ${post.time}`;

    if (image) image.src = post.image;
    if (title) title.textContent = post.title;
    if (views) views.textContent = formatNumber(post.views);
    if (likes) likes.textContent = formatNumber(post.likes);
    if (content) content.innerHTML = formatArticleText(post.content);

    if (likeBtn) {
      if (post.liked) {
        likeBtn.classList.add('text-racing-carmine');
      } else {
        likeBtn.classList.remove('text-racing-carmine');
      }
    }

    if (modal) modal.classList.remove('hidden');
    refreshIcons();
  }

  function closeReaderModal() {
    const modal = document.getElementById('reader-modal');
    if (modal) modal.classList.add('hidden');
    state.readingPostId = null;
  }

  function openDeleteModal(id) {
    const post = state.posts.find(p => p.id === id);
    if (!post) return;

    state.deletingPostId = id;
    const modal = document.getElementById('delete-modal');
    const titleEl = document.getElementById('delete-modal-post-title');

    if (titleEl) {
      titleEl.innerHTML = `Удалить статью <br><strong class="text-white">«${escapeHtml(post.title)}»</strong>?`;
    }
    if (modal) modal.classList.remove('hidden');
  }

  function closeDeleteModal() {
    const modal = document.getElementById('delete-modal');
    if (modal) modal.classList.add('hidden');
    state.deletingPostId = null;
  }

  function openResetModal() {
    const modal = document.getElementById('reset-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function closeResetModal() {
    const modal = document.getElementById('reset-modal');
    if (modal) modal.classList.add('hidden');
  }

  // ========================================================
  // 10. РЕЖИМ ЧТЕНИЯ / РЕДАКТОРА
  // ========================================================
  function setAuthorMode(isAuthor) {
    state.authorMode = isAuthor;
    try {
      localStorage.setItem('race4life_author_mode', isAuthor ? 'true' : 'false');
    } catch (e) {}

    updateModeSwitchUI();
    renderFeed();

    if (isAuthor) {
      showToast('Режим редактора включен', 'success');
    } else {
      showToast('Режим чтения включен', 'info');
    }
  }

  function updateModeSwitchUI() {
    const authorBtn = document.getElementById('mode-author-btn');
    const readerBtn = document.getElementById('mode-reader-btn');

    if (state.authorMode) {
      if (authorBtn) {
        authorBtn.classList.add('bg-surface-800', 'text-white', 'shadow-sm');
        authorBtn.classList.remove('text-zinc-400');
      }
      if (readerBtn) {
        readerBtn.classList.remove('bg-surface-800', 'text-white', 'shadow-sm');
        readerBtn.classList.add('text-zinc-400');
      }
    } else {
      if (readerBtn) {
        readerBtn.classList.add('bg-surface-800', 'text-white', 'shadow-sm');
        readerBtn.classList.remove('text-zinc-400');
      }
      if (authorBtn) {
        authorBtn.classList.remove('bg-surface-800', 'text-white', 'shadow-sm');
        authorBtn.classList.add('text-zinc-400');
      }
    }
  }

  function promptEditAuthorName() {
    const newName = prompt('Имя автора блога:', state.authorName);
    if (newName && newName.trim()) {
      state.authorName = newName.trim();
      try {
        localStorage.setItem('race4life_author_name', state.authorName);
      } catch (e) {}
      updateAuthorNameUI();
      showToast(`Имя автора обновлено: ${state.authorName}`, 'success');
    }
  }

  function updateAuthorNameUI() {
    const el = document.getElementById('author-name-display');
    if (el) el.textContent = state.authorName;
    const mark = document.getElementById('author-mark');
    if (mark) mark.textContent = (state.authorName || 'А').trim().charAt(0).toUpperCase();
  }

  // ========================================================
  // 11. ЭКСПОРТ И СБРОС БАЗЫ
  // ========================================================
  function exportDatabaseToJSON() {
    try {
      const dataStr = JSON.stringify(state.posts, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `race4life_posts_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`Экспортировано ${state.posts.length} статей в JSON`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Ошибка при экспорте файла', 'error');
    }
  }

  function resetDatabaseToDefault() {
    state.posts = window.DataGenerator.seedDatabase(true);
    state.selectedDate = null;
    state.selectedCategory = 'all';
    state.searchQuery = '';
    state.displayedCount = 15;

    closeResetModal();

    applyFiltersAndSort();
    renderCalendar();
    renderTelemetryAnalytics();

    showToast('База восстановлена (465 публикаций)', 'success');
  }

  // ========================================================
  // 12. СЛУШАТЕЛИ СОБЫТИЙ
  // ========================================================
  function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    const searchInputMobile = document.getElementById('search-input-mobile');
    const searchClearBtn = document.getElementById('search-clear-btn');

    function handleSearch(val) {
      state.searchQuery = val;
      state.displayedCount = 15;
      if (searchClearBtn) {
        if (val) searchClearBtn.classList.remove('hidden');
        else searchClearBtn.classList.add('hidden');
      }
      applyFiltersAndSort();
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        handleSearch(e.target.value);
        if (searchInputMobile) searchInputMobile.value = e.target.value;
      });
    }
    if (searchInputMobile) {
      searchInputMobile.addEventListener('input', (e) => {
        handleSearch(e.target.value);
        if (searchInput) searchInput.value = e.target.value;
      });
    }
    if (searchClearBtn) {
      searchClearBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (searchInputMobile) searchInputMobile.value = '';
        handleSearch('');
      });
    }

    const sortSelect = document.getElementById('feed-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        state.sortOrder = e.target.value;
        applyFiltersAndSort();
      });
    }

    const loadMoreBtn = document.getElementById('btn-load-more');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        state.displayedCount += 15;
        renderFeed();
      });
    }

    document.querySelectorAll('.category-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-category');
        state.selectedCategory = cat;
        state.displayedCount = 15;
        applyFiltersAndSort();
      });
    });

    const tabSep = document.getElementById('cal-tab-sep');
    const tabOct = document.getElementById('cal-tab-oct');

    if (tabSep && tabOct) {
      tabSep.addEventListener('click', () => {
        state.activeCalendarTab = 'sep';
        tabSep.classList.add('bg-surface-800', 'text-white');
        tabSep.classList.remove('text-zinc-400');
        tabOct.classList.remove('bg-surface-800', 'text-white');
        tabOct.classList.add('text-zinc-400');
        renderCalendar();
      });

      tabOct.addEventListener('click', () => {
        state.activeCalendarTab = 'oct';
        tabOct.classList.add('bg-surface-800', 'text-white');
        tabOct.classList.remove('text-zinc-400');
        tabSep.classList.remove('bg-surface-800', 'text-white');
        tabSep.classList.add('text-zinc-400');
        renderCalendar();
      });
    }

    const btnAllDays = document.getElementById('btn-calendar-all-days');
    if (btnAllDays) {
      btnAllDays.addEventListener('click', () => {
        state.selectedDate = null;
        state.displayedCount = 15;
        applyFiltersAndSort();
        renderCalendar();
      });
    }

    const btnResetDay = document.getElementById('btn-reset-day-filter');
    if (btnResetDay) {
      btnResetDay.addEventListener('click', () => {
        state.selectedDate = null;
        state.displayedCount = 15;
        applyFiltersAndSort();
        renderCalendar();
      });
    }

    const btnResetSearch = document.getElementById('btn-reset-search-filter');
    if (btnResetSearch) {
      btnResetSearch.addEventListener('click', resetAllFilters);
    }

    const brandHome = document.getElementById('btn-brand-home');
    if (brandHome) {
      brandHome.addEventListener('click', resetAllFilters);
    }

    const authorModeBtn = document.getElementById('mode-author-btn');
    const readerModeBtn = document.getElementById('mode-reader-btn');

    if (authorModeBtn) authorModeBtn.addEventListener('click', () => setAuthorMode(true));
    if (readerModeBtn) readerModeBtn.addEventListener('click', () => setAuthorMode(false));

    const openCreateBtn = document.getElementById('btn-open-create-modal');
    if (openCreateBtn) openCreateBtn.addEventListener('click', openCreatePostModal);

    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closePostModal);
    if (modalCancelBtn) modalCancelBtn.addEventListener('click', closePostModal);

    const postModal = document.getElementById('post-modal');
    if (postModal) {
      postModal.addEventListener('click', (e) => {
        if (e.target === postModal) closePostModal();
      });
    }

    const tabCoverUrl = document.getElementById('tab-cover-url');
    const tabCoverUpload = document.getElementById('tab-cover-upload');
    const btnRandomCover = document.getElementById('btn-random-cover');
    const formImgUrl = document.getElementById('form-image-url');
    const formFileInput = document.getElementById('form-file-input');

    if (tabCoverUrl) tabCoverUrl.addEventListener('click', () => switchCoverMode('url'));
    if (tabCoverUpload) tabCoverUpload.addEventListener('click', () => switchCoverMode('upload'));

    if (btnRandomCover) {
      btnRandomCover.addEventListener('click', () => {
        const titleVal = document.getElementById('form-title') ? document.getElementById('form-title').value : '';
        const contentVal = document.getElementById('form-content') ? document.getElementById('form-content').value : '';
        const catVal = document.getElementById('form-category') ? document.getElementById('form-category').value : 'f1-news';

        let matchingImg = '';
        if (window.DataGenerator && typeof window.DataGenerator.getRelevantImage === 'function') {
          matchingImg = window.DataGenerator.getRelevantImage(titleVal, contentVal, catVal);
        } else if (window.DataGenerator && typeof window.DataGenerator.getRandomImage === 'function') {
          matchingImg = window.DataGenerator.getRandomImage(catVal);
        }

        switchCoverMode('url');
        if (formImgUrl) formImgUrl.value = matchingImg;
        updateCoverPreview(matchingImg);
        showToast('Подобрана подходящая фотография по смыслу статьи!', 'info');
      });
    }

    if (formImgUrl) {
      formImgUrl.addEventListener('input', (e) => {
        updateCoverPreview(e.target.value);
      });
    }

    if (formFileInput) {
      formFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          compressImageFile(file, (compressedBase64) => {
            updateCoverPreview(compressedBase64);
            showToast('Фото загружено', 'success');
          });
        }
      });
    }

    const btnAutoExcerpt = document.getElementById('btn-auto-excerpt');
    if (btnAutoExcerpt) {
      btnAutoExcerpt.addEventListener('click', () => {
        const contentVal = document.getElementById('form-content').value;
        if (!contentVal.trim()) {
          showToast('Сначала напишите текст статьи', 'warning');
          return;
        }
        document.getElementById('form-excerpt').value = generateExcerptFromContent(contentVal);
        showToast('Лид сформирован из первых предложений', 'info');
      });
    }

    document.querySelectorAll('.btn-insert-tag').forEach(btn => {
      btn.addEventListener('click', () => {
        const insertText = btn.getAttribute('data-insert');
        const textarea = document.getElementById('form-content');
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;

        textarea.value = text.substring(0, start) + insertText + text.substring(end);
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
      });
    });

    const modalSubmitBtn = document.getElementById('modal-submit-btn');
    if (modalSubmitBtn) modalSubmitBtn.addEventListener('click', submitPostForm);

    const readerCloseBtn = document.getElementById('reader-close-btn');
    if (readerCloseBtn) readerCloseBtn.addEventListener('click', closeReaderModal);

    const readerModal = document.getElementById('reader-modal');
    if (readerModal) {
      readerModal.addEventListener('click', (e) => {
        if (e.target === readerModal) closeReaderModal();
      });
    }

    const readerLikeBtn = document.getElementById('reader-like-btn');
    if (readerLikeBtn) {
      readerLikeBtn.addEventListener('click', () => {
        if (state.readingPostId) {
          toggleLike(state.readingPostId);
          const post = state.posts.find(p => p.id === state.readingPostId);
          if (post) {
            const likesEl = document.getElementById('reader-likes');
            if (likesEl) likesEl.textContent = formatNumber(post.likes);
            if (post.liked) {
              readerLikeBtn.classList.add('text-racing-carmine');
            } else {
              readerLikeBtn.classList.remove('text-racing-carmine');
            }
          }
        }
      });
    }

    const readerShareBtn = document.getElementById('reader-share-btn');
    if (readerShareBtn) {
      readerShareBtn.addEventListener('click', () => {
        if (state.readingPostId) sharePost(state.readingPostId);
      });
    }

    const delCancelBtn = document.getElementById('delete-modal-cancel-btn');
    const delConfirmBtn = document.getElementById('delete-modal-confirm-btn');
    if (delCancelBtn) delCancelBtn.addEventListener('click', closeDeleteModal);
    if (delConfirmBtn) {
      delConfirmBtn.addEventListener('click', () => {
        if (state.deletingPostId) {
          deletePost(state.deletingPostId);
          closeDeleteModal();
        }
      });
    }

    const exportBtn = document.getElementById('btn-export-json');
    if (exportBtn) exportBtn.addEventListener('click', exportDatabaseToJSON);

    const resetTriggerBtn = document.getElementById('btn-reset-database-trigger');
    const resetCancelBtn = document.getElementById('reset-modal-cancel-btn');
    const resetConfirmBtn = document.getElementById('reset-modal-confirm-btn');

    if (resetTriggerBtn) resetTriggerBtn.addEventListener('click', openResetModal);
    if (resetCancelBtn) resetCancelBtn.addEventListener('click', closeResetModal);
    if (resetConfirmBtn) resetConfirmBtn.addEventListener('click', resetDatabaseToDefault);

    const editAuthorBtn = document.getElementById('btn-edit-author-name');
    const authorNameDisplay = document.getElementById('author-name-display');
    if (editAuthorBtn) editAuthorBtn.addEventListener('click', promptEditAuthorName);
    if (authorNameDisplay) authorNameDisplay.addEventListener('click', promptEditAuthorName);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closePostModal();
        closeReaderModal();
        closeDeleteModal();
        closeResetModal();
      }
    });
  }

  function submitPostForm() {
    const title = document.getElementById('form-title').value;
    const category = document.getElementById('form-category').value;
    const date = document.getElementById('form-date').value;
    const time = document.getElementById('form-time').value;
    const excerpt = document.getElementById('form-excerpt').value;
    const content = document.getElementById('form-content').value;

    if (!title.trim()) {
      showToast('Укажите заголовок статьи', 'warning');
      document.getElementById('form-title').focus();
      return;
    }

    if (!content.trim()) {
      showToast('Напишите текст публикации', 'warning');
      document.getElementById('form-content').focus();
      return;
    }

    let image = state.currentCoverData;
    if (state.selectedImageMode === 'url') {
      const urlVal = document.getElementById('form-image-url').value;
      if (urlVal.trim()) image = urlVal.trim();
    }
    if (!image) {
      image = (window.DataGenerator && typeof window.DataGenerator.getRelevantImage === 'function')
        ? window.DataGenerator.getRelevantImage(title, content, category)
        : (window.DataGenerator && window.DataGenerator.getRandomImage ? window.DataGenerator.getRandomImage(category) : '');
    }

    const postData = {
      title,
      category,
      date,
      time,
      image,
      excerpt,
      content
    };

    if (state.editingPostId) {
      updatePost(state.editingPostId, postData);
    } else {
      createPost(postData);
    }

    closePostModal();
  }

  function resetAllFilters() {
    state.selectedCategory = 'all';
    state.selectedDate = null;
    state.searchQuery = '';
    state.displayedCount = 15;

    const s1 = document.getElementById('search-input');
    const s2 = document.getElementById('search-input-mobile');
    const sc = document.getElementById('search-clear-btn');
    if (s1) s1.value = '';
    if (s2) s2.value = '';
    if (sc) sc.classList.add('hidden');

    applyFiltersAndSort();
    renderCalendar();
  }

  // ========================================================
  // 13. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ========================================================
  function generateExcerptFromContent(text) {
    if (!text) return '';
    const clean = text.replace(/###|\>|\*/g, '').trim();
    const sentences = clean.split(/(?<=[.?!])\s+/);
    if (sentences.length >= 2) {
      return sentences.slice(0, 2).join(' ');
    }
    return clean.slice(0, 150) + '...';
  }

  function formatArticleText(rawText) {
    if (!rawText) return '';
    const paragraphs = rawText.split('\n\n');
    // экранируем HTML, затем разворачиваем **жирный**
    const inline = (s) => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong class="text-zinc-100 font-semibold">$1</strong>');

    return paragraphs.map(p => {
      const trimmed = p.trim();
      if (trimmed.startsWith('###')) {
        return `<h4 class="font-sans font-bold text-base text-zinc-100 mt-4 mb-2">${inline(trimmed.replace(/^###\s*/, ''))}</h4>`;
      }
      if (trimmed.startsWith('>')) {
        return `<blockquote class="border-l-2 border-racing-carmine pl-4 py-1 my-3 text-zinc-300 italic font-serif">${inline(trimmed.replace(/^>\s*/, ''))}</blockquote>`;
      }
      if (trimmed.startsWith('-')) {
        const items = trimmed.split('\n').map(li => `<li class="flex items-start gap-2"><span class="w-1.5 h-1.5 mt-2 shrink-0 rounded-full bg-racing-carmine"></span><span>${inline(li.replace(/^-\s*/, ''))}</span></li>`).join('');
        return `<ul class="space-y-1.5 my-3 text-zinc-300 pl-1">${items}</ul>`;
      }
      if (/^\d+\.\s/.test(trimmed)) {
        const items = trimmed.split('\n').map(li => `<li>${inline(li.replace(/^\d+\.\s*/, ''))}</li>`).join('');
        return `<ol class="list-decimal space-y-1.5 my-3 text-zinc-300 pl-6 marker:text-racing-carmine">${items}</ol>`;
      }
      return `<p class="leading-relaxed text-zinc-300 font-serif">${inline(trimmed)}</p>`;
    }).join('');
  }

  function getRandomTimeStr() {
    const hours = String(Math.floor(9 + Math.random() * 14)).padStart(2, '0');
    const mins = String(Math.floor(Math.random() * 60)).padStart(2, '0');
    return `${hours}:${mins}`;
  }

  function formatNumber(num) {
    return new Intl.NumberFormat('ru-RU').format(num || 0);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    let icon = 'info';
    let borderColor = 'border-surface-700';
    let iconColor = 'text-zinc-300';

    if (type === 'success') {
      icon = 'check';
      borderColor = 'border-surface-700';
      iconColor = 'text-emerald-400';
    } else if (type === 'error') {
      icon = 'alert-circle';
      borderColor = 'border-red-900/60';
      iconColor = 'text-red-400';
    } else if (type === 'warning') {
      icon = 'alert-triangle';
      borderColor = 'border-amber-900/60';
      iconColor = 'text-amber-400';
    }

    const toast = document.createElement('div');
    toast.className = `bg-surface-900 border ${borderColor} rounded-xl px-4 py-2.5 shadow-xl flex items-center gap-2.5 text-xs text-zinc-200 transform translate-y-2 opacity-0 transition-all duration-200 pointer-events-auto`;
    toast.innerHTML = `
      <i data-lucide="${icon}" class="w-4 h-4 ${iconColor} shrink-0"></i>
      <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    refreshIcons();

    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    });

    setTimeout(() => {
      toast.classList.remove('opacity-100');
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 200);
    }, 2800);
  }

  // ========================================================
  // 14. СТАРТ
  // ========================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

  window.RACE4LIFE = {
    state,
    createPost,
    updatePost,
    deletePost,
    toggleLike,
    setAuthorMode,
    resetDatabaseToDefault,
    exportDatabaseToJSON
  };

})();
