// State management
let currentViewDate = new Date();
let currentView = 'month'; // 'month' or 'list'
let isTransitioning = false;
let todos = [];
let searchQueryParams = '';
let visibleScheduleTypes = new Set(['device', 'general', 'kidsnote', 'google']);
let currentGoogleCalendarName = '이지 플래너';
const holidayCache = new Map();
const holidayRequests = new Map();
let calendarWeekLaneCache = new Map();
let mobileSelectedDate = formatDateString(new Date());

// DOM Elements
const calendarGrid = document.getElementById('calendar-grid');
const currentViewTitle = document.getElementById('current-view-title');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnToday = document.getElementById('btn-today');
const btnNewTask = document.getElementById('btn-new-task');
const taskModal = document.getElementById('task-modal');
const closeModalBtn = document.querySelector('.close-modal');
const btnCancelModal = document.getElementById('btn-cancel-modal');
const taskForm = document.getElementById('task-form');
const btnDeleteTask = document.getElementById('btn-delete-task');
const btnSyncTaskGoogle = document.getElementById('btn-sync-task-google');
const naverMapPlaceInput = document.getElementById('naver-map-place');
const themeToggle = document.getElementById('theme-toggle');
const viewSelectors = document.querySelectorAll('.nav-menu [data-view]');
const searchInput = document.getElementById('search-input');
const scheduleTypeFilters = document.querySelectorAll('.schedule-type-filter input[type="checkbox"]');
const toastElement = document.getElementById('toast');
const mobileFab = document.getElementById('mobile-fab');
const mobileMenuButton = document.getElementById('mobile-menu-button');
const mobileMenuBackdrop = document.getElementById('mobile-menu-backdrop');
const mobileSearchButton = document.getElementById('mobile-search-button');
const mobileSearchPanel = document.getElementById('mobile-search-panel');
const mobileSearchInput = document.getElementById('mobile-search-input');
const mobileSearchClose = document.getElementById('mobile-search-close');
const mobileMoreButton = document.getElementById('mobile-more-button');
const mobileNavItems = document.querySelectorAll('[data-mobile-view]');
const mobileCurrentViewTitle = document.getElementById('mobile-current-view-title');
const mobilePrevBtn = document.getElementById('mobile-prev-btn');
const mobileNextBtn = document.getElementById('mobile-next-btn');
const mobileMonthGrid = document.getElementById('mobile-month-grid');
const mobileSelectedDateLabel = document.getElementById('mobile-selected-date-label');
const mobileSelectedDayTitle = document.getElementById('mobile-selected-day-title');
const mobileSelectedDayCount = document.getElementById('mobile-selected-day-count');
const mobileDayAgendaList = document.getElementById('mobile-day-agenda-list');
const dayAgendaModal = document.getElementById('day-agenda-modal');
const closeDayAgendaModalBtn = document.getElementById('close-day-agenda-modal');
const btnDayAgendaClose = document.getElementById('btn-day-agenda-close');
const btnDayAgendaAdd = document.getElementById('btn-day-agenda-add');
const dayAgendaTitle = document.getElementById('day-agenda-title');
const dayAgendaCount = document.getElementById('day-agenda-count');
const dayAgendaList = document.getElementById('day-agenda-list');
let dayAgendaDate = null;
let modalPageStack = [];
const btnTimeTree = document.getElementById('btn-timetree');
const timeTreeModal = document.getElementById('timetree-modal');
const timeTreeStatus = document.getElementById('timetree-status');
const timeTreeLoginForm = document.getElementById('timetree-login-form');
const timeTreeEmail = document.getElementById('timetree-email');
const timeTreePassword = document.getElementById('timetree-password');
const btnTimeTreeLogin = document.getElementById('btn-timetree-login');
const btnTimeTreeDisconnect = document.getElementById('btn-timetree-disconnect');
const closeTimeTreeModal = document.getElementById('close-timetree-modal');
let timeTreeSyncedTodoIds = new Set();

// Views Panels
const calendarViewPanel = document.getElementById('calendar-view');
const weekViewPanel = document.getElementById('week-view');
const dayViewPanel = document.getElementById('day-view');
const listViewPanel = document.getElementById('list-view');
const weekGrid = document.getElementById('week-grid');
const dayGrid = document.getElementById('day-grid');
const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
const sidebarSettingsBtn = document.getElementById('sidebar-settings-btn');
const btnGoogleCalendar = document.getElementById('btn-google-calendar');
const googleCalendarModal = document.getElementById('google-calendar-modal');
const closeGoogleCalendarModalBtn = document.getElementById('close-google-calendar-modal');
const googleCalendarStatus = document.getElementById('google-calendar-status');
const googleCalendarStatusCard = document.getElementById('google-calendar-status-card');
const googleCalendarStatusTitle = document.getElementById('google-calendar-status-title');
const btnConnectGoogleCalendar = document.getElementById('btn-connect-google-calendar');
const btnDisconnectGoogleCalendar = document.getElementById('btn-disconnect-google-calendar');
const googleCalendarTargetPanel = document.getElementById('google-calendar-target-panel');
const googleCalendarTarget = document.getElementById('google-calendar-target');
const btnSaveGoogleCalendarTarget = document.getElementById('btn-save-google-calendar-target');
let googleCalendarConfigured = false;
let googleCalendarConnected = false;
let googleCalendarSelected = false;
let googleSyncedTodoIds = new Set();

function setGoogleCalendarModalStatus(state, title, detail) {
  googleCalendarStatusCard?.classList.remove('is-checking', 'is-connected', 'is-disconnected', 'is-error');
  googleCalendarStatusCard?.classList.add(`is-${state}`);
  if (googleCalendarStatusTitle) googleCalendarStatusTitle.textContent = title;
  if (googleCalendarStatus) googleCalendarStatus.textContent = detail;
}

// List view containers
const pendingList = document.getElementById('pending-list');
const completedList = document.getElementById('completed-list');
const pendingListCount = document.getElementById('pending-list-count');
const completedListCount = document.getElementById('completed-list-count');

// Progress stats
const todayProgress = document.getElementById('today-progress');
const completedCountText = document.getElementById('completed-count');
const totalCountText = document.getElementById('total-count');

// AI Natural-language Schedule DOM Elements
const btnAiSchedule = document.getElementById('btn-ai-schedule');
const aiScheduleModal = document.getElementById('ai-schedule-modal');
const closeAiScheduleModal = document.getElementById('close-ai-schedule-modal');
const btnCancelAiSchedule = document.getElementById('btn-cancel-ai-schedule');
const btnAnalyzeAiSchedule = document.getElementById('btn-analyze-ai-schedule');
const btnSaveAiSchedules = document.getElementById('btn-save-ai-schedules');
const btnAiScheduleBack = document.getElementById('btn-ai-schedule-back');
const aiScheduleText = document.getElementById('ai-schedule-text');
const aiScheduleInputPanel = document.getElementById('ai-schedule-input-panel');
const aiScheduleLoading = document.getElementById('ai-schedule-loading');
const aiSchedulePreview = document.getElementById('ai-schedule-preview');
const aiScheduleList = document.getElementById('ai-schedule-list');
const aiScheduleCount = document.getElementById('ai-schedule-count');
const aiSelectedCount = document.getElementById('ai-selected-count');
const aiScheduleClarification = document.getElementById('ai-schedule-clarification');

// KidsNote Import DOM Elements
const btnImportKidsNote = document.getElementById('btn-import-kidsnote');
const kidsNoteModal = document.getElementById('kidsnote-modal');
const closeKidsNoteModal = document.getElementById('close-kidsnote-modal');
const btnCancelKidsNote = document.getElementById('btn-cancel-kidsnote');
const btnAnalyzeKidsNote = document.getElementById('btn-analyze-kidsnote');
const btnSaveKidsNote = document.getElementById('btn-save-kidsnote');
const btnKidsNoteBack = document.getElementById('btn-kidsnote-back');
const kidsNoteInputPanel = document.getElementById('kidsnote-input-panel');
const kidsNoteSessionPanel = document.getElementById('kidsnote-session-panel');
const kidsNoteUsername = document.getElementById('kidsnote-username');
const kidsNotePassword = document.getElementById('kidsnote-password');
const kidsNoteLoginForm = document.getElementById('kidsnote-login-form');
const btnKidsNoteLogin = document.getElementById('btn-kidsnote-login');
const btnKidsNoteLogout = document.getElementById('btn-kidsnote-logout');
const kidsNoteConnectionStatus = document.getElementById('kidsnote-connection-status');
const kidsNoteConnectionText = document.getElementById('kidsnote-connection-text');
const kidsNoteStartDate = document.getElementById('kidsnote-start-date');
const kidsNoteLoading = document.getElementById('kidsnote-loading');
const kidsNotePreview = document.getElementById('kidsnote-preview');
const kidsNoteList = document.getElementById('kidsnote-list');
const kidsNoteCount = document.getElementById('kidsnote-count');
const kidsNoteSummary = document.getElementById('kidsnote-summary');
const kidsNoteSelectedCount = document.getElementById('kidsnote-selected-count');

let aiScheduleEventsState = [];
let kidsNoteEventsState = [];
let kidsNoteSessionConnected = false;
let kidsNoteSavedEventKeys = new Set();
let editingNaverMapLink = '';

function isNaverMapUrl(value) {
  return /^https?:\/\/(?:(?:map|m\.map|app\.map|place|m\.place)\.naver\.com|naver\.me)(?:[/?#]|$)[^\s]*$/i.test(String(value || '').trim());
}

function findNaverMapUrl(value) {
  const matches = String(value || '').match(/https?:\/\/[^\s<]+/gi) || [];
  return matches.find(isNaverMapUrl) || '';
}

function syncNaverMapLink(content, nextLink) {
  let nextContent = String(content || '');

  if (editingNaverMapLink && editingNaverMapLink !== nextLink) {
    if (nextLink) {
      nextContent = nextContent.replace(editingNaverMapLink, nextLink);
    } else {
      const lines = nextContent.split('\n');
      const linkIndex = lines.findIndex(line => line.trim() === editingNaverMapLink);
      if (linkIndex >= 0) {
        lines.splice(linkIndex, 1);
        if (linkIndex > 0 && /^📍\s*네이버 지도(?: 장소)?\s*$/.test(lines[linkIndex - 1].trim())) {
          lines.splice(linkIndex - 1, 1);
        }
        nextContent = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
      }
    }
  }

  if (nextLink && !nextContent.includes(nextLink)) {
    nextContent = `${nextContent.trimEnd()}${nextContent.trim() ? '\n\n' : ''}📍 네이버 지도\n${nextLink}`;
  }

  return nextContent;
}

function appendLinkedContent(element, value) {
  const text = String(value || '');
  const urlPattern = /https?:\/\/[^\s<]+/gi;
  let cursor = 0;
  let match;

  while ((match = urlPattern.exec(text)) !== null) {
    element.appendChild(document.createTextNode(text.slice(cursor, match.index)));
    const url = match[0];
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'memo-link';
    link.textContent = isNaverMapUrl(url) ? '네이버 지도 열기' : url;
    link.addEventListener('click', event => {
      event.stopPropagation();
      if (isNaverMapUrl(url) && window.NativePlanner?.openExternalUrl) {
        event.preventDefault();
        window.NativePlanner.openExternalUrl(url);
      }
    });
    element.appendChild(link);
    cursor = match.index + url.length;
  }

  element.appendChild(document.createTextNode(text.slice(cursor)));
}

// Initialize application
function initApp() {
  if (kidsNoteStartDate) {
    kidsNoteStartDate.value = formatDateString(new Date());
  }
  initTheme();
  setupEventListeners();
  setupAiScheduleEventListeners();
  setupKidsNoteEventListeners();
  setupGoogleCalendarEventListeners();
  showGoogleCalendarCallbackResult();
  fetchTodos();
  refreshGoogleCalendarStatus();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

function setupTimeTreeEventListeners() {
  btnTimeTree?.addEventListener('click', async () => {
    document.querySelector('.app-container')?.classList.remove('mobile-menu-open');
    timeTreeModal?.classList.add('open');
    await refreshTimeTreeStatus();
  });
  closeTimeTreeModal?.addEventListener('click', () => timeTreeModal?.classList.remove('open'));
  timeTreeModal?.addEventListener('click', event => {
    if (event.target === timeTreeModal) timeTreeModal.classList.remove('open');
  });
  btnTimeTreeLogin?.addEventListener('click', async () => {
    btnTimeTreeLogin.disabled = true;
    timeTreeStatus.textContent = '타임트리에 로그인하고 있습니다...';
    try {
      const response = await fetch('/api/timetree/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: timeTreeEmail.value.trim(), password: timeTreePassword.value }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      timeTreePassword.value = '';
      await refreshTimeTreeStatus();
      showToast('타임트리가 연결되었습니다.', 'success');
    } catch (error) { timeTreeStatus.textContent = error.message; }
    finally { btnTimeTreeLogin.disabled = false; }
  });
  btnTimeTreeDisconnect?.addEventListener('click', async () => {
    await fetch('/api/timetree/session', { method: 'DELETE' });
    await refreshTimeTreeStatus();
  });
}

async function refreshTimeTreeStatus() {
  try {
    const response = await fetch('/api/timetree/status', { cache: 'no-store' });
    const result = await response.json();
    timeTreeSyncedTodoIds = new Set(result.syncedTodoIds || []);
    timeTreeStatus.textContent = result.connected ? '타임트리가 연결되어 있습니다.' : '이메일과 설정한 비밀번호로 로그인해 주세요.';
    timeTreeLoginForm?.classList.toggle('hidden', result.connected);
    btnTimeTreeDisconnect?.classList.toggle('hidden', !result.connected);
  } catch { if (timeTreeStatus) timeTreeStatus.textContent = '연결 상태를 확인하지 못했습니다.'; }
}

async function syncTodoWithTimeTree(todo, button, force = false) {
  button.disabled = true;
  button.textContent = '동기화 중...';
  try {
    const response = await fetch(`/api/timetree/sync/${encodeURIComponent(todo.id)}${force ? '?force=1' : ''}`, { method: 'POST' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    timeTreeSyncedTodoIds.add(String(todo.id));
    button.textContent = '동기화됨';
    showToast(result.alreadySynced ? '이미 타임트리에 등록된 일정입니다.' : '타임트리에 등록했습니다.', 'success');
  } catch (error) { button.disabled = false; button.textContent = force ? '다시 동기화' : '타임트리 동기화'; showToast(error.message, 'danger'); }
}

function showGoogleCalendarCallbackResult() {
  const params = new URLSearchParams(window.location.search);
  const result = params.get('googleCalendar');
  if (!result) return;
  showToast(result === 'connected' ? 'Google 계정이 연결되었습니다. 사용할 캘린더를 선택해 주세요.' : 'Google Calendar 연결에 실패했습니다.', result === 'connected' ? 'success' : 'danger');
  params.delete('googleCalendar');
  const search = params.toString();
  history.replaceState({}, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`);
}

function setupGoogleCalendarEventListeners() {
  btnGoogleCalendar?.addEventListener('click', async () => {
    document.querySelector('.app-container')?.classList.remove('mobile-menu-open');
    googleCalendarModal?.classList.add('open');
    await refreshGoogleCalendarStatus();
  });
  closeGoogleCalendarModalBtn?.addEventListener('click', () => googleCalendarModal?.classList.remove('open'));
  googleCalendarModal?.addEventListener('click', event => {
    if (event.target === googleCalendarModal) googleCalendarModal.classList.remove('open');
  });
  btnConnectGoogleCalendar?.addEventListener('click', () => {
    if (!googleCalendarConfigured) {
      showToast('Google 연결은 아직 운영자 설정이 완료되지 않았습니다.', 'info');
      return;
    }
    window.location.assign(`/api/google-calendar/connect${window.location.pathname.startsWith('/m') ? '?mobile=1' : ''}`);
  });
  btnDisconnectGoogleCalendar?.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/google-calendar/disconnect', { method: 'POST' });
      if (!response.ok) throw new Error('Google Calendar 연결 해제에 실패했습니다.');
      showToast('Google Calendar 연결을 해제했습니다.', 'success');
      await refreshGoogleCalendarStatus();
      await fetchTodos();
    } catch (error) {
      showToast(error.message, 'danger');
    }
  });
  btnSaveGoogleCalendarTarget?.addEventListener('click', async () => {
    const calendarId = googleCalendarTarget?.value;
    if (!calendarId) return;
    const selectedOption = googleCalendarTarget.options[googleCalendarTarget.selectedIndex];
    const calendarName = selectedOption?.dataset?.name || selectedOption?.textContent?.replace(/\s*\(기본\)$/, '') || '선택한 캘린더';
    btnSaveGoogleCalendarTarget.disabled = true;
    btnSaveGoogleCalendarTarget.textContent = '저장 중...';
    try {
      if (window.NativePlanner?.setGoogleCalendarTarget) {
        window.NativePlanner.setGoogleCalendarTarget(calendarId, calendarName);
        await refreshGoogleCalendarStatus();
      } else {
        const response = await fetch('/api/google-calendar/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ calendarId }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '캘린더 선택을 적용하지 못했습니다.');
        showToast(`'${result.calendarName}' 캘린더를 목록에 추가했습니다.`, 'success');
        await refreshGoogleCalendarStatus();
      }
      await fetchTodos();
    } catch (error) { showToast(error.message, 'danger'); }
    finally { btnSaveGoogleCalendarTarget.disabled = false; btnSaveGoogleCalendarTarget.textContent = '저장'; }
  });
}

window.handleNativeGoogleSyncResult = async (success, message, importedTodosJson) => {
  if (success && importedTodosJson) {
    try {
      const importedTodos = typeof importedTodosJson === 'string' ? JSON.parse(importedTodosJson) : importedTodosJson;
      if (Array.isArray(importedTodos) && importedTodos.length > 0) {
        let hasNew = false;
        for (const newTodo of importedTodos) {
          if (!todos.some(t => String(t.id) === String(newTodo.id) || (t.googleEventId && t.googleEventId === newTodo.googleEventId))) {
            todos.push(newTodo);
            hasNew = true;
            fetch('/api/todos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newTodo)
            }).catch(err => console.warn('Failed to persist imported todo:', err));
          }
        }
        if (hasNew) {
          render();
          updateStats();
        }
      }
    } catch (e) { console.error('Failed to process imported Google todos:', e); }
  }
  showToast(message || (success ? 'Google Calendar 동기화가 완료되었습니다.' : 'Google Calendar 동기화에 실패했습니다.'), success ? 'success' : 'danger');
};

function updateGoogleFilterLabel(name) {
  if (name) currentGoogleCalendarName = name;
  const labelText = `구글 (${currentGoogleCalendarName || '이지 플래너'})`;
  const labelEl = document.getElementById('google-filter-label');
  const labelDesktop = document.getElementById('google-filter-label-desktop');
  if (labelEl) labelEl.textContent = labelText;
  if (labelDesktop) labelDesktop.textContent = labelText;
  updateVisibleScheduleSubtitle();
}

function updateVisibleScheduleSubtitle() {
  const subtitleEl = document.querySelector('.mobile-title-subtitle');
  if (subtitleEl) subtitleEl.remove();
}

async function loadGoogleCalendarTargets(selectedCalendarId) {
  let result;
  if (window.NativePlanner?.getGoogleCalendars) {
    const raw = window.NativePlanner.getGoogleCalendars();
    result = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (result.error) throw new Error(result.error);
  } else {
    const response = await fetch('/api/google-calendar/calendars');
    result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Google 캘린더 목록을 불러오지 못했습니다.');
  }
  googleCalendarTarget.replaceChildren(...result.calendars.map(calendar => {
    const option = document.createElement('option');
    option.value = calendar.id;
    option.dataset.name = calendar.name;
    option.textContent = `${calendar.name}${calendar.primary ? ' (기본)' : ''}`;
    return option;
  }));
  const targetId = selectedCalendarId || result.selectedCalendarId || result.calendars.find(calendar => calendar.primary)?.id || '';
  googleCalendarTarget.value = targetId;
  const selectedOption = googleCalendarTarget.options[googleCalendarTarget.selectedIndex];
  if (selectedOption?.dataset?.name) {
    updateGoogleFilterLabel(selectedOption.dataset.name);
  }
}

async function refreshGoogleCalendarStatus() {
  if (!googleCalendarStatus) return;
  setGoogleCalendarModalStatus('checking', '확인 중', '연결 상태를 확인하고 있습니다.');
  try {
    if (window.NativePlanner?.getGoogleCalendarStatus) {
      const nativeStatus = JSON.parse(window.NativePlanner.getGoogleCalendarStatus());
      googleCalendarConnected = Boolean(nativeStatus.connected);
      googleCalendarSelected = Boolean(nativeStatus.calendarId);
      if (nativeStatus.calendarName) {
        updateGoogleFilterLabel(nativeStatus.calendarName);
      }
      googleCalendarConfigured = true;
      setGoogleCalendarModalStatus(
        nativeStatus.connected ? 'connected' : 'disconnected',
        nativeStatus.connected ? '연결됨' : 'Google 계정 연결',
        nativeStatus.connected
          ? (nativeStatus.calendarId ? `${nativeStatus.email || 'Google 계정'} · ‘${nativeStatus.calendarName || 'Google'}’ 캘린더를 표시합니다.` : `${nativeStatus.email || 'Google 계정'} · 사용할 캘린더를 선택해 주세요.`)
          : '플래너 일정을 Google 캘린더에서도 볼 수 있습니다.'
      );
      btnConnectGoogleCalendar.textContent = nativeStatus.connected ? 'Google 계정 변경' : 'Google 계정 연결';
      btnConnectGoogleCalendar?.classList.remove('hidden');
      btnDisconnectGoogleCalendar?.classList.add('hidden');
      if (nativeStatus.connected) {
        googleCalendarTargetPanel?.classList.remove('hidden');
        await loadGoogleCalendarTargets(nativeStatus.calendarId);
      } else {
        googleCalendarTargetPanel?.classList.add('hidden');
      }
      return;
    }
    const response = await fetch('/api/google-calendar/status');
    const status = await response.json();
    googleCalendarConfigured = Boolean(status.configured);
    googleCalendarConnected = Boolean(status.connected && status.sharingReady);
    googleCalendarSelected = Boolean(status.calendarId);
    googleSyncedTodoIds = new Set((status.syncedTodoIds || []).map(String));
    if (!status.configured) {
      setGoogleCalendarModalStatus('disconnected', '연결 준비 안 됨', '잠시 후 다시 시도해 주세요.');
      btnConnectGoogleCalendar.textContent = '연결할 수 없음';
      btnConnectGoogleCalendar.disabled = true;
      btnConnectGoogleCalendar?.classList.add('is-disabled');
      btnConnectGoogleCalendar?.setAttribute('aria-disabled', 'true');
      btnDisconnectGoogleCalendar?.classList.add('hidden');
      googleCalendarTargetPanel?.classList.add('hidden');
      return;
    }
    btnConnectGoogleCalendar?.classList.remove('is-disabled');
    btnConnectGoogleCalendar?.removeAttribute('aria-disabled');
    btnConnectGoogleCalendar.disabled = false;
    if (status.connected) {
      if (status.sharingReady) {
        setGoogleCalendarModalStatus('connected', '연결됨', status.calendarId ? `${status.account?.email || 'Google 계정'} · ‘${status.calendarName}’ 캘린더를 표시합니다.` : `${status.account?.email || 'Google 계정'} · 사용할 캘린더를 선택해 주세요.`);
        btnConnectGoogleCalendar?.classList.add('hidden');
        googleCalendarTargetPanel?.classList.remove('hidden');
        await loadGoogleCalendarTargets(status.calendarId);
      } else {
        setGoogleCalendarModalStatus('disconnected', '다시 연결해 주세요', 'Google 계정 연결이 만료되었습니다.');
        btnConnectGoogleCalendar.textContent = 'Google로 다시 연결';
        btnConnectGoogleCalendar?.classList.remove('hidden');
        googleCalendarTargetPanel?.classList.add('hidden');
      }
      btnDisconnectGoogleCalendar?.classList.remove('hidden');
    } else {
      setGoogleCalendarModalStatus('disconnected', status.reconnectRequired ? '다시 연결해 주세요' : 'Google 계정 연결', status.reconnectRequired ? 'Google 계정 연결이 만료되었습니다.' : '플래너 일정을 Google 캘린더에서도 볼 수 있습니다.');
      btnConnectGoogleCalendar.textContent = status.reconnectRequired ? 'Google 계정 다시 연결' : 'Google 계정 연결';
      btnConnectGoogleCalendar?.classList.remove('hidden');
      btnDisconnectGoogleCalendar?.classList.add('hidden');
      googleCalendarTargetPanel?.classList.add('hidden');
    }
  } catch (error) {
    googleCalendarConnected = false;
    setGoogleCalendarModalStatus('error', '상태 확인 실패', '인터넷 또는 플래너 서버를 확인한 뒤 다시 시도해 주세요.');
    showToast(error.message, 'danger');
  }
}

// Theme Setup
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'light') {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
  }
  lucide.createIcons();
}

function toggleTheme() {
  if (document.body.classList.contains('dark-theme')) {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    localStorage.setItem('theme', 'light');
  } else {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
    localStorage.setItem('theme', 'dark');
  }
}

// Event Listeners Setup
function setupEventListeners() {
  themeToggle.addEventListener('click', toggleTheme);

  // Accordion toggle listeners
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      header.parentElement.classList.toggle('expanded');
    });
  });

  // Sidebar Close and Theme/Settings listeners
  sidebarCloseBtn?.addEventListener('click', () => {
    document.querySelector('.app-container')?.classList.remove('mobile-menu-open');
    document.getElementById('mobile-more-button')?.classList.remove('active');
  });
  mobileMenuBackdrop?.addEventListener('click', () => {
    document.querySelector('.app-container')?.classList.remove('mobile-menu-open');
    document.getElementById('mobile-more-button')?.classList.remove('active');
  });

  sidebarSettingsBtn?.addEventListener('click', () => {
    themeToggle?.click();
  });

  // Swipe left to close sidebar drawer
  initSidebarSwipeToClose();

  // Mobile Today Button Click
  const mobileTodayBtn = document.getElementById('mobile-today-btn');
  mobileTodayBtn?.addEventListener('click', () => {
    currentViewDate = new Date();
    render();
  });

  // Mobile FAB overlay toggle
  const mobileFabOverlay = document.getElementById('mobile-fab-overlay');
  mobileFab?.addEventListener('click', () => {
    if (mobileFabOverlay) {
      const isHidden = mobileFabOverlay.classList.contains('hidden');
      if (isHidden) {
        mobileFabOverlay.classList.remove('hidden');
        mobileFab.style.transform = 'rotate(45deg)';
        mobileFab.style.background = '#e040fb'; // Pinkish close state
      } else {
        mobileFabOverlay.classList.add('hidden');
        mobileFab.style.transform = '';
        mobileFab.style.background = '';
      }
    }
  });

  // Close overlay when clicking background
  mobileFabOverlay?.addEventListener('click', (e) => {
    if (e.target === mobileFabOverlay) {
      mobileFabOverlay.classList.add('hidden');
      mobileFab.style.transform = '';
      mobileFab.style.background = '';
    }
  });

  // Mobile FAB overlay menu item actions
  const mobileMenuAiBtn = document.getElementById('mobile-menu-ai-btn');
  mobileMenuAiBtn?.addEventListener('click', () => {
    mobileFabOverlay.classList.add('hidden');
    mobileFab.style.transform = '';
    mobileFab.style.background = '';
    openAiScheduleModal();
  });

  document.querySelectorAll('.mobile-fab-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      mobileFabOverlay.classList.add('hidden');
      mobileFab.style.transform = '';
      mobileFab.style.background = '';
      const action = item.dataset.action;
      if (action === 'event' || action === 'todo') {
        openModal();
      } else {
        showToast(`${item.querySelector('span').textContent} 기능은 준비 중입니다.`, 'info');
      }
    });
  });
  mobileMenuButton?.addEventListener('click', () => {
    document.querySelector('.app-container')?.classList.toggle('mobile-menu-open');
  });
  mobileMoreButton?.addEventListener('click', () => {
    document.querySelector('.app-container')?.classList.toggle('mobile-menu-open');
    mobileMoreButton.classList.toggle('active');
  });
  mobileSearchButton?.addEventListener('click', () => {
    mobileSearchPanel?.classList.add('open');
    mobileSearchPanel?.setAttribute('aria-hidden', 'false');
    if (mobileSearchInput) {
      mobileSearchInput.value = searchInput?.value || '';
      mobileSearchInput.focus();
    }
  });
  mobileSearchClose?.addEventListener('click', () => {
    mobileSearchPanel?.classList.remove('open');
    mobileSearchPanel?.setAttribute('aria-hidden', 'true');
  });
  mobileSearchInput?.addEventListener('input', event => {
    const value = event.target.value;
    if (searchInput) searchInput.value = value;
    searchQueryParams = value.toLowerCase().trim();
    render();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      document.querySelector('.app-container')?.classList.remove('mobile-menu-open');
      mobileSearchPanel?.classList.remove('open');
      mobileSearchPanel?.setAttribute('aria-hidden', 'true');
    }
  });
  mobileNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetView = item.dataset.mobileView;
      viewSelectors.forEach(view => view.classList.toggle('active', view.dataset.view === targetView));
      mobileNavItems.forEach(nav => nav.classList.toggle('active', nav === item));
      currentView = targetView;
      switchView();
    });
  });

  // Navigation (Month vs List)
  viewSelectors.forEach(el => {
    el.addEventListener('click', () => {
      viewSelectors.forEach(v => v.classList.remove('active'));
      el.classList.add('active');
      currentView = el.dataset.view;
      switchView();
      // Auto-close mobile menu drawer on selection
      document.querySelector('.app-container')?.classList.remove('mobile-menu-open');
    });
  });

  // Search filter
  searchInput.addEventListener('input', (e) => {
    searchQueryParams = e.target.value.toLowerCase().trim();
    render();
  });

  // Calendar navigation
  btnPrev.addEventListener('click', () => {
    navigateCalendarWithAnim(-1);
  });
  btnNext.addEventListener('click', () => {
    navigateCalendarWithAnim(1);
  });
  btnToday.addEventListener('click', () => {
    currentViewDate = new Date();
    render();
  });

  // Task Modal triggers
  btnNewTask.addEventListener('click', () => openModal());
  closeModalBtn.addEventListener('click', closeModal);
  btnCancelModal.addEventListener('click', closeModal);

  taskForm.addEventListener('submit', handleFormSubmit);
  btnDeleteTask.addEventListener('click', handleDeleteTask);
  btnSyncTaskGoogle?.addEventListener('click', syncCurrentTaskToGoogle);

  closeDayAgendaModalBtn.addEventListener('click', closeDayAgendaModal);
  btnDayAgendaClose.addEventListener('click', closeDayAgendaModal);
  btnDayAgendaAdd.addEventListener('click', () => {
    const startIso = `${dayAgendaDate}T09:00`;
    const endIso = `${dayAgendaDate}T10:00`;
    const returnDate = dayAgendaDate;
    closeDayAgendaModal();
    openModal(null, startIso, endIso, { type: 'dayAgenda', date: returnDate });
  });

  scheduleTypeFilters.forEach(filter => {
    filter.addEventListener('change', () => {
      visibleScheduleTypes = new Set(
        Array.from(scheduleTypeFilters).filter(input => input.checked).map(input => input.value)
      );
      updateVisibleScheduleSubtitle();
      render();
    });
  });

  // Close modal when clicking outside the content
  window.addEventListener('click', (e) => {
    if (e.target === taskModal) {
      closeModal();
    }
    if (e.target === dayAgendaModal) {
      closeDayAgendaModal();
    }
  });

  // Mobile Topbar Calendar Navigation Arrows
  mobilePrevBtn?.addEventListener('click', () => {
    navigateCalendarWithAnim(-1);
  });
  mobileNextBtn?.addEventListener('click', () => {
    navigateCalendarWithAnim(1);
  });
}

function initSidebarSwipeToClose() {
  const sidebar = document.querySelector('.sidebar');
  const appContainer = document.querySelector('.app-container');
  if (!sidebar) return;

  let startX = 0;
  let startY = 0;
  let isTracking = false;
  let isSwipingLeft = false;

  const handleStart = (clientX, clientY) => {
    if (!appContainer?.classList.contains('mobile-menu-open')) return;
    startX = clientX;
    startY = clientY;
    isTracking = true;
    isSwipingLeft = false;
  };

  const handleMove = (clientX, clientY, e) => {
    if (!isTracking || !appContainer?.classList.contains('mobile-menu-open')) return;
    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    if (deltaX < 0 && Math.abs(deltaX) > Math.abs(deltaY) * 0.7) {
      isSwipingLeft = true;
      if (Math.abs(deltaX) > 10 && e && e.cancelable) {
        e.preventDefault();
      }
      sidebar.style.transition = 'none';
      sidebar.style.transform = `translateX(${deltaX}px)`;
    }
  };

  const handleEnd = (clientX, clientY) => {
    if (!isTracking) return;
    isTracking = false;
    sidebar.style.transition = '';
    sidebar.style.transform = '';

    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    if (isSwipingLeft && deltaX <= -35 && Math.abs(deltaX) > Math.abs(deltaY) * 0.6) {
      appContainer?.classList.remove('mobile-menu-open');
      const mobileMoreButton = document.getElementById('mobile-more-button');
      mobileMoreButton?.classList.remove('active');
    }
    isSwipingLeft = false;
  };

  const handleCancel = () => {
    if (!isTracking) return;
    isTracking = false;
    isSwipingLeft = false;
    sidebar.style.transition = '';
    sidebar.style.transform = '';
  };

  // Touch event listeners
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      handleStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY, e);
    }
  }, { passive: false });

  document.addEventListener('touchend', (e) => {
    if (e.changedTouches.length > 0) {
      handleEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }
  }, { passive: true });

  document.addEventListener('touchcancel', handleCancel, { passive: true });
}

// Fetch events from server
async function fetchTodos() {
  try {
    const response = await fetch('/api/todos');
    if (!response.ok) throw new Error('서버 데이터를 불러오지 못했습니다.');
    const plannerTodos = await response.json();
    let googleTodos = [];
    try {
      if (window.NativePlanner?.getGoogleCalendarEvents) {
        const raw = window.NativePlanner.getGoogleCalendarEvents();
        const result = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!result.error) googleTodos = result.events || [];
      } else {
        const googleResponse = await fetch('/api/google-calendar/events');
        if (googleResponse.ok) googleTodos = (await googleResponse.json()).events || [];
      }
    } catch (error) {
      console.warn('Google calendar events are unavailable:', error.message);
    }
    todos = mergePlannerAndGoogleTodos(plannerTodos, googleTodos);
    render();
    updateStats();
  } catch (error) {
    showToast(error.message, 'danger');
  }
}

function mergePlannerAndGoogleTodos(plannerTodos, googleTodos) {
  const plannerById = new Map(plannerTodos.map(todo => [String(todo.id), todo]));
  const plannerGoogleEventIds = new Set(plannerTodos.map(todo => todo.googleEventId).filter(Boolean).map(String));
  const mirrorsByPlannerId = new Map();
  const googleOnlyTodos = [];

  googleTodos.forEach(googleTodo => {
    const plannerTodoId = googleTodo.plannerTodoId == null ? '' : String(googleTodo.plannerTodoId);
    if (plannerTodoId && plannerById.has(plannerTodoId)) {
      mirrorsByPlannerId.set(plannerTodoId, googleTodo);
      googleSyncedTodoIds.add(plannerTodoId);
      return;
    }
    if (googleTodo.googleEventId && plannerGoogleEventIds.has(String(googleTodo.googleEventId))) return;
    googleOnlyTodos.push(googleTodo);
  });

  const mergedPlannerTodos = plannerTodos.map(todo => {
    const todoId = String(todo.id);
    const mirror = mirrorsByPlannerId.get(todoId);
    if (!mirror && !googleSyncedTodoIds.has(todoId)) return todo;
    return {
      ...todo,
      googleSynced: true,
      googleSyncEventId: mirror?.googleEventId || null,
      googleSyncCalendarName: mirror?.googleCalendarName || currentGoogleCalendarName || 'Google 캘린더'
    };
  });

  return [...mergedPlannerTodos, ...googleOnlyTodos];
}

async function syncCurrentTaskToGoogle() {
  const id = document.getElementById('task-id').value;
  const todo = todos.find(item => String(item.id) === String(id));
  if (!todo || todo.readOnly || todo.scheduleType === 'google') return;
  btnSyncTaskGoogle.disabled = true;
  btnSyncTaskGoogle.textContent = '동기화 중...';
  try {
    let result;
    if (window.NativePlanner?.syncGoogleCalendarTodo) {
      const raw = window.NativePlanner.syncGoogleCalendarTodo(JSON.stringify(todo));
      result = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (result.error) throw new Error(result.error);
    } else {
      const response = await fetch(`/api/google-calendar/sync/${encodeURIComponent(todo.id)}`, { method: 'POST' });
      result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Google 동기화에 실패했습니다.');
    }
    googleSyncedTodoIds.add(String(todo.id));
    todo.googleSynced = true;
    todo.googleSyncCalendarName = result.calendarName || currentGoogleCalendarName || 'Google 캘린더';
    updateTaskCalendarSource(todo);
    btnSyncTaskGoogle.textContent = 'Google 다시 동기화';
    showToast(`'${todo.title}' 일정을 Google에 동기화했습니다.`, 'success');
    await fetchTodos();
  } catch (error) {
    btnSyncTaskGoogle.textContent = googleSyncedTodoIds.has(String(todo.id)) ? 'Google 다시 동기화' : 'Google 동기화';
    showToast(error.message, 'danger');
  } finally {
    btnSyncTaskGoogle.disabled = false;
  }
}

// View switcher (Calendar / Week / Day / List)
function switchView() {
  if (currentView === 'month') {
    calendarViewPanel.classList.add('active');
    weekViewPanel.classList.remove('active');
    dayViewPanel.classList.remove('active');
    listViewPanel.classList.remove('active');
    document.querySelector('.nav-buttons').classList.remove('hidden');
    renderCalendar();
  } else if (currentView === 'week') {
    calendarViewPanel.classList.remove('active');
    weekViewPanel.classList.add('active');
    dayViewPanel.classList.remove('active');
    listViewPanel.classList.remove('active');
    document.querySelector('.nav-buttons').classList.remove('hidden');
    renderWeek();
  } else if (currentView === 'day') {
    calendarViewPanel.classList.remove('active');
    weekViewPanel.classList.remove('active');
    dayViewPanel.classList.add('active');
    listViewPanel.classList.remove('active');
    document.querySelector('.nav-buttons').classList.remove('hidden');
    renderDay();
  } else {
    calendarViewPanel.classList.remove('active');
    weekViewPanel.classList.remove('active');
    dayViewPanel.classList.remove('active');
    listViewPanel.classList.add('active');
    document.querySelector('.nav-buttons').classList.add('hidden');
    renderList();
  }
}

// Navigate Calendar
function navigateCalendar(direction) {
  if (currentView === 'week') {
    currentViewDate.setDate(currentViewDate.getDate() + (direction * 7));
  } else if (currentView === 'day') {
    currentViewDate.setDate(currentViewDate.getDate() + direction);
  } else {
    const currentMonth = currentViewDate.getMonth();
    currentViewDate.setMonth(currentMonth + direction);
  }
  render();
}

// Navigate Calendar with smooth Slide & Opacity Transition
function navigateCalendarWithAnim(direction) {
  if (isTransitioning) return;

  // List view doesn't have horizontal swipe transition
  if (currentView === 'list') {
    navigateCalendar(direction);
    return;
  }

  const activePanel = document.querySelector('.view-panel.active');
  if (!activePanel) {
    navigateCalendar(direction);
    return;
  }

  isTransitioning = true;

  const outClass = direction > 0 ? 'slide-out-left' : 'slide-out-right';
  const inClass = direction > 0 ? 'slide-in-right' : 'slide-in-left';

  // 1. Start slide-out animation
  activePanel.classList.add(outClass);

  // 2. Perform state update and render when old content is out (after 150ms)
  setTimeout(() => {
    if (currentView === 'week') {
      currentViewDate.setDate(currentViewDate.getDate() + (direction * 7));
    } else if (currentView === 'day') {
      currentViewDate.setDate(currentViewDate.getDate() + direction);
    } else {
      const currentMonth = currentViewDate.getMonth();
      currentViewDate.setMonth(currentMonth + direction);
    }

    render();

    activePanel.classList.remove(outClass);
    activePanel.classList.add(inClass);

    // 3. Clear the slide-in class when animation is complete (after 150ms)
    setTimeout(() => {
      activePanel.classList.remove(inClass);
      isTransitioning = false;
    }, 150);
  }, 150);
}

function getTodoScheduleType(todo) {
  if (todo.scheduleType === 'kidsnote') return 'kidsnote';
  if (todo.googleEventId || todo.scheduleType === 'google' || todo.isGoogleCalendar) return 'google';
  return 'device';
}

const CALENDAR_SOURCE_COLORS = {
  device: '#4f46e5',
  kidsnote: '#10b981',
  google: '#4285f4'
};

function getTodoCalendarLabel(todo) {
  const type = getTodoScheduleType(todo);
  if (type === 'kidsnote') return '키즈노트';
  if (type === 'google') return `Google · ${todo.googleCalendarName || currentGoogleCalendarName || 'Google 캘린더'}`;
  return '디바이스';
}

function getTodoCalendarColor(todo) {
  const type = getTodoScheduleType(todo);
  return type === 'google' ? (todo.color || CALENDAR_SOURCE_COLORS.google) : CALENDAR_SOURCE_COLORS[type];
}

function appendTodoCalendarBadge(container, todo) {
  const badges = document.createElement('span');
  badges.className = 'event-calendar-badges';
  const badge = document.createElement('span');
  const type = getTodoScheduleType(todo);
  badge.className = `event-calendar-source is-${type}`;
  badge.textContent = getTodoCalendarLabel(todo);
  badges.appendChild(badge);
  if (isTodoGoogleSynced(todo)) {
    const syncStatus = document.createElement('span');
    syncStatus.className = 'event-google-sync-status';
    syncStatus.textContent = 'Google 동기화됨 ✓';
    syncStatus.title = todo.googleSyncCalendarName || currentGoogleCalendarName || 'Google 캘린더';
    badges.appendChild(syncStatus);
  }
  container.appendChild(badges);
  return badge;
}

function isTodoGoogleSynced(todo) {
  return getTodoScheduleType(todo) !== 'google'
    && Boolean(todo.googleSynced || googleSyncedTodoIds.has(String(todo.id)));
}

function updateTaskCalendarSource(todo) {
  const source = document.getElementById('task-calendar-source');
  const googleStatus = document.getElementById('task-google-sync-status');
  const calendarMeta = source?.closest('.task-calendar-meta');
  if (!source) return;
  if (!todo) {
    calendarMeta?.classList.add('hidden');
    source.className = 'task-calendar-source hidden';
    source.textContent = '';
    googleStatus?.classList.add('hidden');
    if (googleStatus) googleStatus.textContent = 'Google 동기화됨';
    return;
  }
  calendarMeta?.classList.remove('hidden');
  const type = getTodoScheduleType(todo);
  source.className = `task-calendar-source is-${type}`;
  source.textContent = getTodoCalendarLabel(todo);
  if (googleStatus) {
    const synced = isTodoGoogleSynced(todo);
    googleStatus.classList.toggle('hidden', !synced);
    googleStatus.textContent = synced
      ? `Google 동기화됨 · ${todo.googleSyncCalendarName || currentGoogleCalendarName || 'Google 캘린더'}`
      : 'Google 동기화됨';
  }
}

// Get filtered tasks helper
function getFilteredTodos() {
  return todos.filter(todo => {
    const type = getTodoScheduleType(todo);
    if (!visibleScheduleTypes.has(type) && !(type === 'device' && visibleScheduleTypes.has('general'))) {
      return false;
    }

    // Search Filter
    if (searchQueryParams) {
      const matchTitle = (todo.title || '').toLowerCase().includes(searchQueryParams);
      const matchContent = (todo.content || '').toLowerCase().includes(searchQueryParams);
      if (!matchTitle && !matchContent) return false;
    }
    return true;
  });
}

function render() {
  if (currentView === 'month') {
    renderCalendar();
  } else if (currentView === 'week') {
    renderWeek();
  } else if (currentView === 'day') {
    renderDay();
  } else {
    renderList();
    const mobileTodayBtn = document.getElementById('mobile-today-btn');
    if (mobileTodayBtn) mobileTodayBtn.classList.add('hidden');
  }
}
// Render Calendar Month View
function renderCalendar() {
  calendarGrid.innerHTML = '';
  calendarWeekLaneCache = new Map();
  const today = new Date();

  const year = currentViewDate.getFullYear();
  const month = currentViewDate.getMonth();

  ensureHolidayYear(year);
  if (month === 0) ensureHolidayYear(year - 1);
  if (month === 11) ensureHolidayYear(year + 1);

  // Format Month Title
  currentViewTitle.textContent = `${year}년 ${month + 1}월`;
  if (mobileCurrentViewTitle) {
    mobileCurrentViewTitle.innerHTML = `${year}. ${month + 1}. <i data-lucide="chevron-down" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-left: 2px;"></i>`;
  }

  const mobileTodayBtn = document.getElementById('mobile-today-btn');
  if (mobileTodayBtn) {
    const isCurrentMonthShown = (year === today.getFullYear() && month === today.getMonth());
    if (isCurrentMonthShown) {
      mobileTodayBtn.classList.add('hidden');
    } else {
      mobileTodayBtn.classList.remove('hidden');
      const isFuture = currentViewDate > today;
      if (isFuture) {
        mobileTodayBtn.innerHTML = '<i data-lucide="chevron-left"></i><span>오늘</span>';
      } else {
        mobileTodayBtn.innerHTML = '<span>오늘</span><i data-lucide="chevron-right"></i>';
      }
      lucide.createIcons();
    }
  }

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const prevLastDay = new Date(year, month, 0);

  const startDayOfWeek = firstDay.getDay(); // Day of week of first date
  const totalDays = lastDay.getDate();
  const prevTotalDays = prevLastDay.getDate();

  // Render only the weeks this month needs.  Keeping a fixed 42-cell grid
  // made short months show an unnecessary extra week of next-month dates.
  const weekCount = Math.ceil((startDayOfWeek + totalDays) / 7);
  const requiredCellCount = weekCount * 7;
  calendarGrid.style.gridTemplateRows = `repeat(${weekCount}, minmax(0, 1fr))`;
  let cellCount = 0;

  // 1. Previous month trailing days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = prevTotalDays - i;
    const prevMonthDate = new Date(year, month - 1, day);
    createCalendarCell(prevMonthDate, false);
    cellCount++;
  }

  // 2. Current month days
  for (let i = 1; i <= totalDays; i++) {
    const currentDate = new Date(year, month, i);
    const isToday = currentDate.toDateString() === today.toDateString();
    createCalendarCell(currentDate, true, isToday);
    cellCount++;
  }

  // 3. Keep the final week aligned, but don't render next-month dates.
  while (cellCount < requiredCellCount) {
    createEmptyCalendarCell();
    cellCount++;
  }

  renderMobileMonth(year, month, startDayOfWeek, totalDays, requiredCellCount);

  lucide.createIcons();
}

function renderMobileMonth(year, month, startDayOfWeek, totalDays, requiredCellCount) {
  if (!mobileMonthGrid) return;

  const selected = new Date(`${mobileSelectedDate}T00:00:00`);
  if (selected.getFullYear() !== year || selected.getMonth() !== month) {
    const today = new Date();
    const defaultDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : 1;
    mobileSelectedDate = formatDateString(new Date(year, month, defaultDay));
  }

  const weeks = Math.ceil(requiredCellCount / 7);
  mobileMonthGrid.style.gridTemplateRows = `repeat(${weeks}, minmax(0, 1fr))`;
  mobileMonthGrid.innerHTML = '';
  for (let index = 0; index < requiredCellCount; index++) {
    const day = index - startDayOfWeek + 1;
    if (day < 1 || day > totalDays) {
      const spacer = document.createElement('span');
      spacer.classList.add('mobile-month-spacer');
      spacer.setAttribute('aria-hidden', 'true');
      mobileMonthGrid.appendChild(spacer);
      continue;
    }

    const date = new Date(year, month, day);
    const dateString = formatDateString(date);
    const dayTodos = getFilteredTodos().filter(todo => {
      const start = todo.startDate.substring(0, 10);
      const end = todo.endDate.substring(0, 10);
      return dateString >= start && dateString <= end;
    });
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.add('mobile-month-day');
    button.dataset.date = dateString;
    button.setAttribute('aria-label', `${month + 1}월 ${day}일, 일정 ${dayTodos.length}개`);
    if (dateString === mobileSelectedDate) button.classList.add('selected');
    if (dateString === formatDateString(new Date())) button.classList.add('today');
    if (date.getDay() === 0 || getHoliday(dateString)) button.classList.add('holiday');
    if (date.getDay() === 6) button.classList.add('saturday');

    const number = document.createElement('span');
    number.classList.add('mobile-month-day-number');
    number.textContent = day;
    button.appendChild(number);

    if (dayTodos.length) {
      const dots = document.createElement('span');
      dots.classList.add('mobile-month-dots');
      [...new Set(dayTodos.slice(0, 3).map(getTodoCalendarColor))].forEach(color => {
        const dot = document.createElement('i');
        dot.style.backgroundColor = color;
        dots.appendChild(dot);
      });
      button.appendChild(dots);
    }

    button.addEventListener('click', () => {
      mobileSelectedDate = dateString;
      openDayAgendaModal(dateString);
    });
    mobileMonthGrid.appendChild(button);
  }
}

function renderMobileDayAgenda() {
  if (!mobileDayAgendaList) return;
  const date = new Date(`${mobileSelectedDate}T00:00:00`);
  const dayTodos = getFilteredTodos().filter(todo => {
    const start = todo.startDate.substring(0, 10);
    const end = todo.endDate.substring(0, 10);
    return mobileSelectedDate >= start && mobileSelectedDate <= end;
  }).sort((a, b) => a.startDate.localeCompare(b.startDate));

  mobileSelectedDateLabel.textContent = date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  mobileSelectedDayTitle.textContent = date.toDateString() === new Date().toDateString() ? '오늘 일정' : '선택한 날의 일정';
  mobileSelectedDayCount.textContent = `${dayTodos.length}개`;
  mobileDayAgendaList.innerHTML = '';

  if (!dayTodos.length) {
    const empty = document.createElement('button');
    empty.type = 'button';
    empty.classList.add('mobile-day-agenda-empty');
    empty.innerHTML = '<i data-lucide="calendar-plus"></i><span>등록된 일정이 없습니다.</span><strong>이 날짜에 일정 추가</strong>';
    empty.addEventListener('click', () => openModal(null, `${mobileSelectedDate}T09:00`, `${mobileSelectedDate}T10:00`));
    mobileDayAgendaList.appendChild(empty);
    return;
  }

  dayTodos.forEach(todo => {
    const item = document.createElement('button');
    item.type = 'button';
    item.classList.add('mobile-agenda-card');
    if (todo.completed) item.classList.add('completed');
    item.style.setProperty('--mobile-agenda-color', getTodoCalendarColor(todo));
    const isAllDay = todo.allDay || todo.startDate.substring(0, 10) < todo.endDate.substring(0, 10);

    const time = document.createElement('span');
    time.classList.add('mobile-agenda-time');
    time.textContent = isAllDay ? '종일' : formatTime(todo.startDate);
    const content = document.createElement('span');
    content.classList.add('mobile-agenda-content');
    const title = document.createElement('strong');
    title.textContent = todo.title;
    content.appendChild(title);
    appendTodoCalendarBadge(content, todo);
    if (todo.content) {
      const detail = document.createElement('small');
      appendLinkedContent(detail, todo.content);
      content.appendChild(detail);
    }
    item.append(time, content);
    item.addEventListener('click', () => openModal(todo, null, null, { type: 'dayAgenda', date: mobileSelectedDate }));
    mobileDayAgendaList.appendChild(item);
  });
}

function createEmptyCalendarCell() {
  const cell = document.createElement('div');
  cell.classList.add('calendar-day', 'calendar-day-empty');
  cell.setAttribute('aria-hidden', 'true');
  calendarGrid.appendChild(cell);
}

function createCalendarCell(date, isCurrentMonth, isToday = false) {
  const cell = document.createElement('div');
  cell.classList.add('calendar-day');
  if (!isCurrentMonth) cell.classList.add('other-month');
  if (isToday) cell.classList.add('today');
  if (date.getDay() === 0) cell.classList.add('sunday');
  if (date.getDay() === 6) cell.classList.add('saturday');

  const dateStringStr = formatDateString(date);
  cell.dataset.date = dateStringStr;

  const holiday = getHoliday(dateStringStr);
  if (holiday) {
    cell.classList.add('holiday');
    cell.title = holiday.name;
  }

  const dateHeader = document.createElement('div');
  dateHeader.classList.add('calendar-date-header');

  if (holiday) {
    const holidayName = document.createElement('span');
    holidayName.classList.add('holiday-name');
    holidayName.textContent = holiday.name;
    dateHeader.appendChild(holidayName);
  }

  const dayNumber = document.createElement('span');
  dayNumber.classList.add('day-number');
  dayNumber.textContent = date.getDate();
  dateHeader.appendChild(dayNumber);
  cell.appendChild(dateHeader);

  // Add Event Container
  const eventContainer = document.createElement('div');
  eventContainer.classList.add('day-events');
  cell.appendChild(eventContainer);

  // Events use stable weekly lanes so multi-day bars stay connected horizontally.
  const weekLanes = getCalendarWeekLanes(date);

  // Count how many actual events exist on this day across all lanes
  let dayTodosCount = 0;
  weekLanes.forEach(lane => {
    const hasTodo = lane.some(item => {
      const start = item.startDate.substring(0, 10);
      const end = item.endDate.substring(0, 10);
      return dateStringStr >= start && dateStringStr <= end;
    });
    if (hasTodo) dayTodosCount++;
  });

  for (let i = 0; i < weekLanes.length; i++) {
    // Keep month cells clean: show at most three rows and expose the rest in the day agenda.
    if (i === 3 && dayTodosCount > 3) {
      const moreEl = document.createElement('div');
      moreEl.classList.add('event-more-label');
      moreEl.textContent = `+ ${dayTodosCount - 3}개`;
      moreEl.addEventListener('click', (e) => {
        e.stopPropagation();
        openDayAgenda(dateStringStr);
      });
      eventContainer.appendChild(moreEl);
      break;
    }

    // Hard limit: never render more than three schedule rows inside the cell.
    if (i >= 3) {
      break;
    }

    const lane = weekLanes[i];
    const todo = lane.find(item => {
      const start = item.startDate.substring(0, 10);
      const end = item.endDate.substring(0, 10);
      return dateStringStr >= start && dateStringStr <= end;
    });

    if (!todo) {
      const placeholder = document.createElement('div');
      placeholder.classList.add('event-lane-placeholder');
      eventContainer.appendChild(placeholder);
    } else {
      const eventStart = todo.startDate.substring(0, 10);
      const eventEnd = todo.endDate.substring(0, 10);
      const isPeriodEvent = eventStart < eventEnd;
      const continuesBefore = isPeriodEvent && dateStringStr > eventStart && date.getDay() !== 0;
      const continuesAfter = isPeriodEvent && dateStringStr < eventEnd && date.getDay() !== 6;

      const eventEl = document.createElement('div');
      eventEl.classList.add('event-item');
      if (isPeriodEvent) eventEl.classList.add('period-event');
      if (continuesBefore) eventEl.classList.add('continues-before');
      if (continuesAfter) eventEl.classList.add('continues-after');
      if (todo.completed) eventEl.classList.add('completed');

      const calendarColor = getTodoCalendarColor(todo);
      eventEl.style.backgroundColor = calendarColor;
      eventEl.style.borderLeftColor = darkenColor(calendarColor, -30);

      const isTimedEvent = false;
      if (continuesBefore) {
        eventEl.textContent = '\u00a0';
      } else if (isTimedEvent) {
        const timeLabel = document.createElement('span');
        timeLabel.classList.add('event-time-label');
        timeLabel.textContent = formatTime(todo.startDate);

        const titleLabel = document.createElement('span');
        titleLabel.classList.add('event-title-label');
        titleLabel.textContent = todo.title;
        eventEl.append(timeLabel, titleLabel);
      } else {
        eventEl.textContent = todo.title;
      }
      eventEl.title = todo.allDay
        ? `${getTodoCalendarLabel(todo)} · ${todo.title}\n(종일)`
        : `${getTodoCalendarLabel(todo)} · ${todo.title}\n(${formatTime(todo.startDate)} ~ ${formatTime(todo.endDate)})`;

      // A compact card opens the full agenda for this date.
      eventEl.addEventListener('click', (e) => {
        e.stopPropagation();
        openDayAgenda(dateStringStr);
      });

      eventContainer.appendChild(eventEl);
    }
  }

  // Click a date to see every schedule on that day.
  cell.addEventListener('click', () => {
    openDayAgenda(dateStringStr);
  });

  calendarGrid.appendChild(cell);
}

function getTodosForDate(dateString) {
  return todos
    .filter(todo => {
      const start = todo.startDate.substring(0, 10);
      const end = todo.endDate.substring(0, 10);
      return dateString >= start && dateString <= end;
    })
    .sort((a, b) => {
      const aAllDay = a.allDay || a.startDate.substring(0, 10) < a.endDate.substring(0, 10);
      const bAllDay = b.allDay || b.startDate.substring(0, 10) < b.endDate.substring(0, 10);
      if (aAllDay !== bAllDay) return aAllDay ? -1 : 1;
      return a.startDate.localeCompare(b.startDate);
    });
}

function openDayAgenda(dateString) {
  openDayAgendaModal(dateString);
}

function openDayAgendaModal(dateString) {
  dayAgendaDate = dateString;
  const date = new Date(`${dateString}T00:00:00`);
  const dayLabel = date.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
  });
  const dayTodos = getTodosForDate(dateString);

  if (dayAgendaTitle) dayAgendaTitle.textContent = dayLabel;
  if (dayAgendaCount) dayAgendaCount.textContent = `${dayTodos.length}개`;
  if (dayAgendaList) {
    dayAgendaList.innerHTML = '';

    if (dayTodos.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'day-agenda-empty';
      empty.style.padding = '24px 16px';
      empty.style.textAlign = 'center';
      empty.style.color = '#8b9691';
      empty.innerHTML = '<p style="margin:0 0 12px; font-size: 0.92rem;">등록된 일정이 없습니다.</p><button type="button" class="btn btn-primary" style="margin:0 auto; padding:8px 16px; font-size:0.85rem;"><i data-lucide="plus"></i> 이 날짜에 일정 추가</button>';
      empty.querySelector('button')?.addEventListener('click', () => {
        closeDayAgendaModal();
        openModal(null, `${dateString}T09:00`, `${dateString}T10:00`, { type: 'dayAgenda', date: dateString });
      });
      dayAgendaList.appendChild(empty);
    } else {
      dayTodos.forEach(todo => {
        const item = document.createElement('div');
        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        item.classList.add('day-agenda-item');
        if (todo.completed) item.classList.add('completed');
        item.style.setProperty('--agenda-color', getTodoCalendarColor(todo));

        const isAllDay = todo.allDay || (todo.startDate && todo.endDate && todo.startDate.substring(0, 10) < todo.endDate.substring(0, 10));
        const time = document.createElement('span');
        time.classList.add('day-agenda-time');
        time.textContent = isAllDay ? '종일' : `${formatTime(todo.startDate)} ~ ${formatTime(todo.endDate)}`;

        const details = document.createElement('span');
        details.classList.add('day-agenda-details');
        const title = document.createElement('strong');
        title.textContent = todo.title;
        details.appendChild(title);
        appendTodoCalendarBadge(details, todo);
        if (todo.content) {
          const content = document.createElement('small');
          appendLinkedContent(content, todo.content);
          details.appendChild(content);
        }

        item.append(time, details);
        const openTodo = () => {
          closeDayAgendaModal();
          openModal(todo, null, null, { type: 'dayAgenda', date: dateString });
        };
        item.addEventListener('click', openTodo);
        item.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openTodo(); } });
        dayAgendaList.appendChild(item);
      });
    }
  }

  dayAgendaModal?.classList.add('open');
  lucide.createIcons();
}

function closeDayAgendaModal() {
  dayAgendaModal.classList.remove('open');
}

function getCalendarWeekLanes(date) {
  const weekStartDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
  const weekEndDate = new Date(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate() + 6);
  const weekStart = formatDateString(weekStartDate);
  const weekEnd = formatDateString(weekEndDate);

  if (calendarWeekLaneCache.has(weekStart)) return calendarWeekLaneCache.get(weekStart);

  const weekEvents = getFilteredTodos()
    .filter(todo => todo.startDate.substring(0, 10) <= weekEnd && todo.endDate.substring(0, 10) >= weekStart)
    .sort((a, b) => {
      const startCompare = a.startDate.localeCompare(b.startDate);
      if (startCompare !== 0) return startCompare;
      return b.endDate.localeCompare(a.endDate);
    });

  const lanes = [];
  weekEvents.forEach(todo => {
    const clippedStart = todo.startDate.substring(0, 10) < weekStart ? weekStart : todo.startDate.substring(0, 10);
    const clippedEnd = todo.endDate.substring(0, 10) > weekEnd ? weekEnd : todo.endDate.substring(0, 10);
    let targetLane = lanes.find(lane => lane.every(item => {
      const itemStart = item.startDate.substring(0, 10) < weekStart ? weekStart : item.startDate.substring(0, 10);
      const itemEnd = item.endDate.substring(0, 10) > weekEnd ? weekEnd : item.endDate.substring(0, 10);
      return clippedEnd < itemStart || clippedStart > itemEnd;
    }));

    if (!targetLane) {
      targetLane = [];
      lanes.push(targetLane);
    }
    targetLane.push(todo);
  });

  calendarWeekLaneCache.set(weekStart, lanes);
  return lanes;
}

function getHoliday(dateString) {
  const year = Number(dateString.substring(0, 4));
  return holidayCache.get(year)?.get(dateString) || null;
}

function ensureHolidayYear(year) {
  if (holidayCache.has(year) || holidayRequests.has(year)) return;

  const request = fetch(`/api/holidays?year=${year}`)
    .then(response => {
      if (!response.ok) throw new Error(`Holiday API returned ${response.status}`);
      return response.json();
    })
    .then(data => {
      const holidays = new Map(
        (data.holidays || []).map(holiday => [holiday.date, holiday])
      );
      holidayCache.set(year, holidays);
    })
    .catch(error => {
      console.warn(`Failed to load Korean holidays for ${year}:`, error);
      holidayCache.set(year, new Map());
    })
    .finally(() => {
      holidayRequests.delete(year);
      if (currentView === 'month') renderCalendar();
    });

  holidayRequests.set(year, request);
}

// Render List View
function renderList() {
  pendingList.innerHTML = '';
  completedList.innerHTML = '';

  const filtered = getFilteredTodos();

  let pendingCount = 0;
  let completedCount = 0;

  // Sort list view by start date
  filtered.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  filtered.forEach(todo => {
    const item = createTodoListItem(todo);
    if (todo.completed) {
      completedList.appendChild(item);
      completedCount++;
    } else {
      pendingList.appendChild(item);
      pendingCount++;
    }
  });

  pendingListCount.textContent = pendingCount;
  completedListCount.textContent = completedCount;

  if (pendingCount === 0) {
    pendingList.innerHTML = '<div class="todo-empty-state">대기중인 일정이 없습니다.</div>';
  }
  if (completedCount === 0) {
    completedList.innerHTML = '<div class="todo-empty-state">완료된 일정이 없습니다.</div>';
  }

  lucide.createIcons();
}

function createTodoListItem(todo) {
  const item = document.createElement('div');
  item.classList.add('todo-item');
  if (todo.completed) item.classList.add('completed');

  // Side color border
  const border = document.createElement('div');
  border.classList.add('todo-left-border');
  border.style.backgroundColor = getTodoCalendarColor(todo);
  item.appendChild(border);

  // Checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.classList.add('todo-checkbox');
  checkbox.checked = todo.completed;
  checkbox.disabled = Boolean(todo.readOnly);
  checkbox.addEventListener('change', async (e) => {
    e.stopPropagation();
    await toggleTodoComplete(todo.id, checkbox.checked);
  });
  item.appendChild(checkbox);

  // Details
  const details = document.createElement('div');
  details.classList.add('todo-details');

  const title = document.createElement('h4');
  title.textContent = todo.title;
  details.appendChild(title);
  appendTodoCalendarBadge(details, todo);

  // Time range
  const time = document.createElement('div');
  time.classList.add('todo-time');
  const durationText = formatEventDuration(todo.startDate, todo.endDate, todo.allDay);
  time.innerHTML = `<i data-lucide="clock" style="width:14px;height:14px;"></i> <span>${durationText}</span>`;
  details.appendChild(time);

  // Content description
  if (todo.content) {
    const content = document.createElement('div');
    content.classList.add('todo-content');
    appendLinkedContent(content, todo.content);
    details.appendChild(content);
  }

  item.appendChild(details);

  // Action buttons
  const actions = document.createElement('div');
  actions.classList.add('todo-actions');

  const editBtn = document.createElement('button');
  editBtn.classList.add('btn-icon');
  editBtn.style.padding = '0';
  editBtn.style.width = '30px';
  editBtn.style.height = '30px';
  editBtn.innerHTML = todo.readOnly ? '<i data-lucide="eye" style="width:14px;height:14px;"></i>' : '<i data-lucide="edit-3" style="width:14px;height:14px;"></i>';
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openModal(todo);
  });
  actions.appendChild(editBtn);

  item.appendChild(actions);

  // Click whole item to view/edit (excluding clicking checkbox)
  item.addEventListener('click', () => {
    openModal(todo);
  });

  return item;
}

// Toggle Complete Function
async function toggleTodoComplete(id, completed) {
  try {
    const response = await fetch(`/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed })
    });
    if (!response.ok) throw new Error('상태를 업데이트하지 못했습니다.');

    // Update local state
    const index = todos.findIndex(t => t.id === id);
    if (index !== -1) {
      todos[index].completed = completed;
    }

    render();
    updateStats();
    showToast(completed ? '일정을 완료했습니다! 🎉' : '일정을 대기 상태로 변경했습니다.', 'success');
  } catch (error) {
    showToast(error.message, 'danger');
    fetchTodos(); // rollback UI
  }
}

// Update stats progress widget
function updateStats() {
  const todayStr = formatDateString(new Date());

  // Today's task list (starts today, ends today, or spans across today)
  const todayTasks = todos.filter(todo => !todo.readOnly && (() => {
    const start = todo.startDate.substring(0, 10);
    const end = todo.endDate.substring(0, 10);
    return todayStr >= start && todayStr <= end;
  })());

  const total = todayTasks.length;
  const completed = todayTasks.filter(t => t.completed).length;

  if (totalCountText) totalCountText.textContent = total;
  if (completedCountText) completedCountText.textContent = completed;

  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  if (todayProgress) todayProgress.style.width = `${progressPercent}%`;
}

// Modal handling
function openModal(todo = null, customStart = null, customEnd = null, returnState = null) {
  taskForm.reset();
  editingNaverMapLink = '';
  if (returnState) modalPageStack.push(returnState);
  else modalPageStack = [];
  updateTaskCalendarSource(todo);

  if (todo) {
    // Edit Mode
    document.getElementById('modal-title').textContent = '일정 세부 정보';
    document.getElementById('task-id').value = todo.id;
    document.getElementById('task-title').value = todo.title;
    document.getElementById('task-start-date').value = formatIsoForInput(todo.startDate);
    document.getElementById('task-end-date').value = formatIsoForInput(todo.endDate);
    document.getElementById('task-content').value = todo.content;
    editingNaverMapLink = findNaverMapUrl(todo.content);
    if (naverMapPlaceInput) naverMapPlaceInput.value = editingNaverMapLink;

    const isGoogleEvent = Boolean(todo.readOnly || todo.scheduleType === 'google' || todo.isGoogleCalendar);
    btnDeleteTask.classList.toggle('hidden', isGoogleEvent);
    btnSyncTaskGoogle?.classList.toggle('hidden', isGoogleEvent || !googleCalendarConnected || !googleCalendarSelected);
    if (btnSyncTaskGoogle && !isGoogleEvent) btnSyncTaskGoogle.textContent = googleSyncedTodoIds.has(String(todo.id)) ? 'Google 다시 동기화' : 'Google 동기화';
    taskForm.querySelectorAll('input:not(#task-id), textarea').forEach(field => { field.disabled = isGoogleEvent; });
    document.getElementById('btn-save-task').classList.toggle('hidden', isGoogleEvent);
  } else {
    // Create Mode
    document.getElementById('modal-title').textContent = '새 일정 추가';
    document.getElementById('task-id').value = '';

    const now = new Date();
    const start = customStart || formatIsoForInput(new Date(now.setMinutes(0)));
    const end = customEnd || formatIsoForInput(new Date(now.setHours(now.getHours() + 1)));

    document.getElementById('task-start-date').value = start;
    document.getElementById('task-end-date').value = end;
    btnDeleteTask.classList.add('hidden');
    btnSyncTaskGoogle?.classList.add('hidden');
    taskForm.querySelectorAll('input:not(#task-id), textarea').forEach(field => { field.disabled = false; });
    document.getElementById('btn-save-task').classList.remove('hidden');
  }

  taskModal.classList.add('open');
  lucide.createIcons();
}

function closeModal({ restorePrevious = true } = {}) {
  taskModal.classList.remove('open');
  const returnState = modalPageStack.pop();
  if (restorePrevious && returnState?.type === 'dayAgenda' && returnState.date) {
    openDayAgendaModal(returnState.date);
  }
}

// Handle Task Save Form Submit
async function handleFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('task-id').value;
  const existingTodo = todos.find(todo => todo.id === id);
  const naverMapLink = naverMapPlaceInput?.value.trim() || '';
  if (naverMapLink && !isNaverMapUrl(naverMapLink)) {
    showToast('네이버 지도에서 복사한 링크를 입력해 주세요.', 'danger');
    naverMapPlaceInput?.focus();
    return;
  }
  const taskData = {
    title: document.getElementById('task-title').value,
    startDate: document.getElementById('task-start-date').value,
    endDate: document.getElementById('task-end-date').value,
    category: existingTodo?.category || 'general',
    priority: existingTodo?.priority || 'medium',
    scheduleType: existingTodo?.scheduleType === 'kidsnote' ? 'kidsnote' : 'general',
    content: syncNaverMapLink(document.getElementById('task-content').value, naverMapLink)
  };
  taskData.allDay = isAllDayRange(taskData.startDate, taskData.endDate);

  // Validate dates
  if (new Date(taskData.startDate) > new Date(taskData.endDate)) {
    showToast('종료 일시는 시작 일시보다 빠를 수 없습니다.', 'danger');
    return;
  }

  try {
    let response;
    if (id) {
      // Update
      response = await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
    } else {
      // Create
      response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
    }

    if (!response.ok) throw new Error('일정을 저장하지 못했습니다.');

    const result = await response.json();

    if (id) {
      const idx = todos.findIndex(t => t.id === id);
      todos[idx] = result;
      showToast('일정이 수정되었습니다.', 'success');
    } else {
      todos.push(result);
      showToast('새 일정이 등록되었습니다.', 'success');
    }

    closeModal();
    render();
    updateStats();
  } catch (error) {
    showToast(error.message, 'danger');
  }
}

// Delete Task Function
async function handleDeleteTask() {
  const id = document.getElementById('task-id').value;
  if (!id) return;

  if (!confirm('정말 이 일정을 삭제하시겠습니까?')) return;

  try {
    const response = await fetch(`/api/todos/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('일정을 삭제하지 못했습니다.');

    todos = todos.filter(t => t.id !== id);
    closeModal();
    render();
    updateStats();
    showToast('일정이 삭제되었습니다.', 'success');
  } catch (error) {
    showToast(error.message, 'danger');
  }
}

// Toast notification helper
function showToast(message, type = 'info') {
  const toastIcon = document.getElementById('toast-icon');
  const toastMsg = document.getElementById('toast-message');

  // Icon configuration
  toastIcon.removeAttribute('data-lucide');
  if (type === 'success') {
    toastIcon.setAttribute('data-lucide', 'check-circle2');
    toastElement.style.borderLeft = '4px solid var(--success)';
  } else if (type === 'danger') {
    toastIcon.setAttribute('data-lucide', 'alert-circle');
    toastElement.style.borderLeft = '4px solid var(--danger)';
  } else {
    toastIcon.setAttribute('data-lucide', 'info');
    toastElement.style.borderLeft = '4px solid var(--primary)';
  }

  toastMsg.textContent = message;
  lucide.createIcons();

  toastElement.classList.add('show');

  // Hide after 3 seconds
  setTimeout(() => {
    toastElement.classList.remove('show');
  }, 3000);
}

// Date Utility Helpers
function formatDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatIsoForInput(dateOrIso) {
  const d = new Date(dateOrIso);
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().substring(0, 16);
}

function formatLocalIsoWithOffset(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetMinutes);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
}

function formatTime(isoStr) {
  const d = new Date(isoStr);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function isAllDayRange(startIso, endIso) {
  const start = String(startIso || '');
  const end = String(endIso || '');
  return /T00:00(?::00)?(?:$|[+-])/.test(start) && /T23:59(?::59)?(?:$|[+-])/.test(end);
}

function formatEventDuration(startIso, endIso, allDay = false) {
  const s = new Date(startIso);
  const e = new Date(endIso);

  const sDate = `${s.getFullYear()}.${s.getMonth() + 1}.${s.getDate()}`;
  const sTime = `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`;

  const eDate = `${e.getFullYear()}.${e.getMonth() + 1}.${e.getDate()}`;
  const eTime = `${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`;

  if (allDay) {
    return sDate === eDate ? `${sDate} 종일` : `${sDate} ~ ${eDate} 종일`;
  }

  if (sDate === eDate) {
    return `${sDate} ${sTime} ~ ${eTime}`;
  } else {
    return `${sDate} ${sTime} ~ ${eDate} ${eTime}`;
  }
}

// Color Utility (Hex darkening)
function darkenColor(col, amt) {
  let usePound = false;
  if (col[0] == "#") {
    col = col.slice(1);
    usePound = true;
  }
  let num = parseInt(col, 16);
  let r = (num >> 16) + amt;
  if (r > 255) r = 255;
  else if (r < 0) r = 0;
  let b = ((num >> 8) & 0x00FF) + amt;
  if (b > 255) b = 255;
  else if (b < 0) b = 0;
  let g = (num & 0x0000FF) + amt;
  if (g > 255) g = 255;
  else if (g < 0) g = 0;
  return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
}

// KidsNote notice import flow
function setupKidsNoteEventListeners() {
  btnImportKidsNote?.addEventListener('click', () => {
    resetKidsNoteModal();
    kidsNoteModal?.classList.add('open');
  });
  closeKidsNoteModal?.addEventListener('click', closeKidsNote);
  btnCancelKidsNote?.addEventListener('click', closeKidsNote);
  btnAnalyzeKidsNote?.addEventListener('click', analyzeKidsNote);
  btnSaveKidsNote?.addEventListener('click', saveKidsNoteSchedules);
  btnKidsNoteBack?.addEventListener('click', showKidsNoteInput);
  btnKidsNoteLogin?.addEventListener('click', loginKidsNoteAccount);
  btnKidsNoteLogout?.addEventListener('click', logoutKidsNoteAccount);
  window.addEventListener('click', event => {
    if (event.target === kidsNoteModal) closeKidsNote();
  });
}

function closeKidsNote() {
  kidsNoteModal.classList.remove('open');
  kidsNotePassword.value = '';
}

function resetKidsNoteModal() {
  kidsNoteEventsState = [];
  kidsNoteSavedEventKeys = new Set();
  kidsNoteUsername.value = '';
  kidsNotePassword.value = '';
  kidsNoteSessionConnected = false;
  renderKidsNoteConnection();
  kidsNoteSessionPanel.classList.remove('hidden');
  showKidsNoteInput();
  refreshKidsNoteSession();
}

function renderKidsNoteConnection(session = null) {
  kidsNoteLoginForm.classList.toggle('hidden', kidsNoteSessionConnected);
  document.querySelector('#kidsnote-modal .kidsnote-login-help')?.classList.toggle('hidden', kidsNoteSessionConnected);
  kidsNoteConnectionStatus.classList.remove('hidden', 'checking', 'connected', 'disconnected');
  kidsNoteConnectionStatus.classList.add(kidsNoteSessionConnected ? 'connected' : 'disconnected');
  btnKidsNoteLogout.classList.toggle('hidden', !kidsNoteSessionConnected);
  if (kidsNoteSessionConnected && session) {
    const expires = session.expiresAt ? new Date(session.expiresAt).toLocaleDateString('ko-KR') : '';
    kidsNoteConnectionText.textContent = `로그인 세션 등록됨 · 자녀 ID ${session.childId}${expires ? ` · ${expires}까지` : ''}`;
  } else if (!kidsNoteSessionConnected) {
    kidsNoteConnectionText.textContent = '로그인 세션이 등록되어 있지 않습니다.';
  }
}

async function refreshKidsNoteSession() {
  kidsNoteConnectionStatus.classList.remove('hidden', 'connected', 'disconnected');
  kidsNoteConnectionStatus.classList.add('checking');
  kidsNoteConnectionText.textContent = '로그인 세션 확인 중...';
  btnKidsNoteLogout.classList.add('hidden');
  try {
    const response = await fetch('/api/kidsnote/session', { cache: 'no-store' });
    const session = await response.json();
    kidsNoteSessionConnected = response.ok && session.connected === true;
    renderKidsNoteConnection(session);
  } catch {
    kidsNoteSessionConnected = false;
    renderKidsNoteConnection();
  }
}

async function loginKidsNoteAccount() {
  const username = kidsNoteUsername.value.trim();
  const password = kidsNotePassword.value;
  if (!username || !password) {
    showToast('키즈노트 아이디와 비밀번호를 입력해 주세요.', 'danger');
    return;
  }
  btnKidsNoteLogin.disabled = true;
  try {
    const response = await fetch('/api/kidsnote/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || '키즈노트 로그인에 실패했습니다.');
    kidsNotePassword.value = '';
    kidsNoteSessionConnected = true;
    renderKidsNoteConnection(result);
    showToast('키즈노트 로그인 세션을 안전하게 저장했습니다.', 'success');
  } catch (error) {
    kidsNotePassword.value = '';
    showToast(error.message, 'danger');
  } finally {
    btnKidsNoteLogin.disabled = false;
  }
}

async function logoutKidsNoteAccount() {
  btnKidsNoteLogout.disabled = true;
  try {
    await fetch('/api/kidsnote/session', { method: 'DELETE' });
    kidsNoteSessionConnected = false;
    renderKidsNoteConnection();
    showToast('저장된 키즈노트 연결을 해제했습니다.', 'success');
  } finally {
    btnKidsNoteLogout.disabled = false;
  }
}

function showKidsNoteInput() {
  kidsNoteInputPanel.classList.remove('hidden');
  kidsNoteLoading.classList.add('hidden');
  kidsNotePreview.classList.add('hidden');
  kidsNoteList.innerHTML = '';
  kidsNoteCount.textContent = '0';
  kidsNoteSelectedCount.textContent = '0';
  btnAnalyzeKidsNote.classList.remove('hidden');
  btnAnalyzeKidsNote.disabled = false;
  btnSaveKidsNote.classList.add('hidden');
  btnSaveKidsNote.disabled = false;
}

async function analyzeKidsNote() {
  const importStartDate = kidsNoteStartDate.value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(importStartDate)) {
    showToast('가져오기 시작일을 선택해 주세요.', 'danger');
    return;
  }
  const payload = { mode: 'saved_session', baseDate: formatLocalIsoWithOffset(), importStartDate };
  if (!kidsNoteSessionConnected) {
    showToast('먼저 키즈노트 계정으로 로그인해 주세요.', 'danger');
    return;
  }

  kidsNoteInputPanel.classList.add('hidden');
  kidsNotePreview.classList.add('hidden');
  kidsNoteLoading.classList.remove('hidden');
  btnAnalyzeKidsNote.disabled = true;
  try {
    const result = await runKidsNoteBackgroundAnalysis(payload, partial => {
        kidsNoteEventsState = filterKidsNoteEventsByStartDate(partial.events, importStartDate);
        kidsNoteLoading.classList.add('hidden');
        kidsNotePreview.classList.remove('hidden');
        btnAnalyzeKidsNote.classList.add('hidden');
        btnSaveKidsNote.classList.add('hidden');
        const completed = partial.completedChunks || 0;
        const total = partial.totalChunks || 0;
        kidsNoteSummary.textContent = `분석 중 ${completed}/${total} · 알림장 ${partial.analyzedCount || 0}건 확인 · 일정 후보 ${kidsNoteEventsState.length}건`;
        renderKidsNoteCandidates();
      });
    kidsNoteEventsState = filterKidsNoteEventsByStartDate(result.events, importStartDate);
    kidsNoteLoading.classList.add('hidden');
    kidsNotePreview.classList.remove('hidden');
    btnAnalyzeKidsNote.classList.add('hidden');
    kidsNoteSummary.textContent = `알림장 ${result.reportCount || 0}건 중 본문 ${result.analyzedCount || 0}건을 분석했습니다. ${importStartDate} 이후 일정만 표시합니다.`;
    renderKidsNoteCandidates();
    btnSaveKidsNote.classList.toggle('hidden', kidsNoteEventsState.length === 0);
  } catch (error) {
    kidsNoteLoading.classList.add('hidden');
    kidsNoteInputPanel.classList.remove('hidden');
    btnAnalyzeKidsNote.disabled = false;
    showToast(error.message, 'danger');
  }
}

async function runKidsNoteDirectAnalysis(payload) {
  const response = await fetch('/api/kidsnote/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || '키즈노트 데이터를 분석하지 못했습니다.');
  return result;
}

async function runKidsNoteBackgroundAnalysis(payload, onProgress) {
  const startResponse = await fetch('/api/kidsnote/import/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseDate: payload.baseDate, importStartDate: payload.importStartDate })
  });
  const started = await startResponse.json().catch(() => ({}));
  if (!startResponse.ok || !started.jobId) {
    throw new Error(started.error || '키즈노트 분석 작업을 시작하지 못했습니다.');
  }

  let lastCompletedChunks = -1;
  for (let attempt = 0; attempt < 180; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const statusResponse = await fetch(`/api/kidsnote/import/jobs/${encodeURIComponent(started.jobId)}`, { cache: 'no-store' });
    const status = await statusResponse.json().catch(() => ({}));
    if (statusResponse.ok && status.status === 'completed') return status.result;
    const completedChunks = Number(status.result?.completedChunks ?? status.progress?.completedChunks ?? -1);
    if (statusResponse.ok && status.status === 'processing' && status.result &&
        completedChunks !== lastCompletedChunks && typeof onProgress === 'function') {
      lastCompletedChunks = completedChunks;
      onProgress(status.result);
    }
    if (!statusResponse.ok || status.status === 'failed') {
      throw new Error(status.error || '키즈노트 데이터 분석에 실패했습니다.');
    }
  }
  throw new Error('키즈노트 분석 시간이 초과되었습니다. 다시 시도해 주세요.');
}

function filterKidsNoteEventsByStartDate(events, importStartDate) {
  return (Array.isArray(events) ? events : []).filter(event => {
    const eventDate = String(event?.startDate || '').slice(0, 10);
    return eventDate >= importStartDate;
  });
}

function renderKidsNoteCandidates() {
  kidsNoteList.innerHTML = '';
  kidsNoteCount.textContent = kidsNoteEventsState.length;
  if (!kidsNoteEventsState.length) {
    kidsNoteList.innerHTML = '<div class="todo-empty-state">날짜가 명확한 일정 후보를 찾지 못했습니다.</div>';
    updateKidsNoteSelectedCount();
    return;
  }
  kidsNoteEventsState.forEach((event, index) => {
    const eventKey = getKidsNoteEventKey(event);
    const alreadySaved = kidsNoteSavedEventKeys.has(eventKey);
    const card = document.createElement('div');
    card.className = 'extracted-card';
    card.classList.toggle('registered', alreadySaved);
    card.dataset.index = index;
    card.style.borderLeft = `4px solid ${event.color || '#10b981'}`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !alreadySaved;
    checkbox.disabled = alreadySaved;
    checkbox.className = 'extracted-card-checkbox kidsnote-schedule-checkbox';
    checkbox.addEventListener('change', () => {
      card.classList.toggle('disabled', !checkbox.checked);
      updateKidsNoteSelectedCount();
    });
    const details = document.createElement('div');
    details.className = 'extracted-card-details';
    const title = document.createElement('input');
    title.className = 'extracted-card-title';
    title.value = event.title;
    title.addEventListener('input', inputEvent => { kidsNoteEventsState[index].title = inputEvent.target.value; });
    details.appendChild(title);
    const dates = document.createElement('div');
    dates.className = 'ai-schedule-dates';
    dates.appendChild(createAiDateField('시작', event.startDate, value => { kidsNoteEventsState[index].startDate = value; }, event.allDay, false));
    dates.appendChild(createAiDateField('종료', event.endDate, value => { kidsNoteEventsState[index].endDate = value; }, event.allDay, true));
    details.appendChild(dates);
    if (event.content) {
      const content = document.createElement('div');
      content.className = 'extracted-card-desc';
      content.textContent = event.content;
      details.appendChild(content);
    }
    if (event.dateReason) {
      const reason = document.createElement('div');
      reason.className = 'extracted-card-reason';
      reason.textContent = `날짜 판단: ${event.dateReason}`;
      details.appendChild(reason);
    }
    if (event.evidence) {
      const evidence = document.createElement('div');
      evidence.className = 'kidsnote-evidence';
      evidence.textContent = `근거: ${event.evidence}`;
      details.appendChild(evidence);
    }
    const actions = document.createElement('div');
    actions.className = 'kidsnote-card-actions';
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'btn btn-success kidsnote-add-one';
    addButton.disabled = alreadySaved;
    addButton.innerHTML = alreadySaved
      ? '<span>등록됨</span>'
      : '<i data-lucide="calendar-plus"></i><span>이 일정만 추가</span>';
    addButton.addEventListener('click', () => saveSingleKidsNoteSchedule(index, addButton, card, checkbox));
    actions.appendChild(addButton);
    details.appendChild(actions);
    card.appendChild(checkbox);
    card.appendChild(details);
    if (alreadySaved) card.querySelectorAll('input').forEach(input => { input.disabled = true; });
    kidsNoteList.appendChild(card);
  });
  updateKidsNoteSelectedCount();
  lucide.createIcons();
}

function getKidsNoteEventKey(event) {
  return `${event.evidence || event.title || ''}|${event.startDate || ''}`;
}

async function saveSingleKidsNoteSchedule(index, button, card, checkbox) {
  const task = kidsNoteEventsState[index];
  if (!task || !task.title?.trim() || !task.startDate || !task.endDate) {
    showToast('일정 제목과 날짜를 확인해 주세요.', 'danger');
    return;
  }
  button.disabled = true;
  try {
    const response = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...task, scheduleType: 'kidsnote' })
    });
    if (!response.ok) throw new Error('일정을 등록하지 못했습니다.');
    kidsNoteSavedEventKeys.add(getKidsNoteEventKey(task));
    checkbox.checked = false;
    checkbox.disabled = true;
    card.classList.add('registered');
    card.querySelectorAll('input').forEach(input => { input.disabled = true; });
    button.innerHTML = '<span>등록됨</span>';
    updateKidsNoteSelectedCount();
    await fetchTodos();
    showToast(`“${task.title}” 일정을 등록했습니다.`, 'success');
  } catch (error) {
    button.disabled = false;
    showToast(error.message, 'danger');
  }
}

function updateKidsNoteSelectedCount() {
  kidsNoteSelectedCount.textContent = kidsNoteList.querySelectorAll('.kidsnote-schedule-checkbox:checked').length;
}

async function saveKidsNoteSchedules() {
  const selected = Array.from(kidsNoteList.querySelectorAll('.kidsnote-schedule-checkbox:checked'))
    .map(checkbox => kidsNoteEventsState[Number(checkbox.closest('.extracted-card').dataset.index)]);
  if (!selected.length) {
    showToast('등록할 일정을 선택해 주세요.', 'danger');
    return;
  }
  btnSaveKidsNote.disabled = true;
  try {
    const responses = await Promise.all(selected.map(task => fetch('/api/todos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...task, scheduleType: 'kidsnote' })
    })));
    if (responses.some(response => !response.ok)) throw new Error('일부 일정을 등록하지 못했습니다.');
    closeKidsNote();
    await fetchTodos();
    showToast(`${selected.length}개의 키즈노트 일정을 등록했습니다.`, 'success');
  } catch (error) {
    btnSaveKidsNote.disabled = false;
    showToast(error.message, 'danger');
  }
}

// AI natural-language schedule flow
function setupAiScheduleEventListeners() {
  btnAiSchedule?.addEventListener('click', openAiScheduleModal);
  closeAiScheduleModal?.addEventListener('click', closeAiSchedule);
  btnCancelAiSchedule?.addEventListener('click', () => {
    if (btnCancelAiSchedule.textContent === '다시 하기') {
      showAiScheduleInput();
    } else {
      closeAiSchedule();
    }
  });
  btnAnalyzeAiSchedule?.addEventListener('click', analyzeAiScheduleText);
  btnSaveAiSchedules?.addEventListener('click', saveAiSchedules);
  btnAiScheduleBack?.addEventListener('click', showAiScheduleInput);

  document.querySelectorAll('.ai-example-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      aiScheduleText.value = chip.textContent.trim();
      aiScheduleText.focus();
    });
  });

  window.addEventListener('click', (event) => {
    if (event.target === aiScheduleModal) closeAiSchedule();
  });
}

function openAiScheduleModal() {
  resetAiScheduleModal();
  aiScheduleModal.classList.add('open');
  setTimeout(() => aiScheduleText.focus(), 50);
}

function closeAiSchedule() {
  aiScheduleModal.classList.remove('open');
  resetAiScheduleModal();
}

function resetAiScheduleModal() {
  aiScheduleEventsState = [];
  aiScheduleText.value = '';
  aiScheduleList.innerHTML = '';
  if (aiScheduleCount) aiScheduleCount.textContent = '0';
  if (aiSelectedCount) aiSelectedCount.textContent = '0';

  const aiScheduleDisplayTitle = document.getElementById('ai-schedule-display-title');
  const aiMicBtn = document.querySelector('.ai-mic-btn');
  aiScheduleText.classList.remove('hidden');
  if (aiScheduleDisplayTitle) aiScheduleDisplayTitle.classList.add('hidden');
  if (aiMicBtn) aiMicBtn.classList.remove('hidden');

  btnCancelAiSchedule.textContent = '닫기';

  aiScheduleInputPanel.classList.remove('hidden');
  aiScheduleLoading.classList.add('hidden');
  aiSchedulePreview.classList.add('hidden');
  aiScheduleClarification.classList.add('hidden');
  aiScheduleClarification.textContent = '';
  btnAnalyzeAiSchedule.classList.remove('hidden');
  btnAnalyzeAiSchedule.disabled = false;
  btnSaveAiSchedules.classList.add('hidden');
  btnSaveAiSchedules.disabled = false;
}

function showAiScheduleInput() {
  aiScheduleInputPanel.classList.remove('hidden');
  aiSchedulePreview.classList.add('hidden');
  aiScheduleLoading.classList.add('hidden');
  btnAnalyzeAiSchedule.classList.remove('hidden');
  btnAnalyzeAiSchedule.disabled = false;
  btnSaveAiSchedules.classList.add('hidden');

  const aiScheduleDisplayTitle = document.getElementById('ai-schedule-display-title');
  const aiMicBtn = document.querySelector('.ai-mic-btn');
  aiScheduleText.classList.remove('hidden');
  if (aiScheduleDisplayTitle) aiScheduleDisplayTitle.classList.add('hidden');
  if (aiMicBtn) aiMicBtn.classList.remove('hidden');

  btnCancelAiSchedule.textContent = '닫기';
  aiScheduleText.focus();
}

async function analyzeAiScheduleText() {
  const text = aiScheduleText.value.trim();
  if (!text) {
    showToast('추가할 일정을 입력해 주세요.', 'danger');
    return;
  }

  aiScheduleInputPanel.classList.add('hidden');
  aiSchedulePreview.classList.add('hidden');
  aiScheduleLoading.classList.remove('hidden');
  btnAnalyzeAiSchedule.disabled = true;

  const aiScheduleDisplayTitle = document.getElementById('ai-schedule-display-title');
  const aiMicBtn = document.querySelector('.ai-mic-btn');
  aiScheduleText.classList.add('hidden');
  if (aiScheduleDisplayTitle) {
    aiScheduleDisplayTitle.textContent = text;
    aiScheduleDisplayTitle.classList.remove('hidden');
  }
  if (aiMicBtn) aiMicBtn.classList.add('hidden');

  try {
    const response = await fetch('/api/todos/parse-natural-language', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        baseDate: formatLocalIsoWithOffset()
      })
    });

    if (!response.ok) throw new Error('AI 일정 확인 중 오류가 발생했습니다.');
    const result = await response.json();
    aiScheduleEventsState = Array.isArray(result.events) ? result.events : [];

    aiScheduleLoading.classList.add('hidden');
    aiSchedulePreview.classList.remove('hidden');
    btnAnalyzeAiSchedule.classList.add('hidden');

    if (result.clarification) {
      aiScheduleClarification.textContent = result.clarification;
      aiScheduleClarification.classList.remove('hidden');
    } else {
      aiScheduleClarification.classList.add('hidden');
    }

    renderAiScheduleCandidates();
    if (aiScheduleEventsState.length > 0) {
      btnSaveAiSchedules.classList.remove('hidden');
    } else {
      btnSaveAiSchedules.classList.add('hidden');
      if (!result.clarification) {
        aiScheduleClarification.textContent = '날짜와 시작 시간을 포함해 조금 더 구체적으로 입력해 주세요.';
        aiScheduleClarification.classList.remove('hidden');
      }
    }
  } catch (error) {
    console.error(error);
    showToast(error.message, 'danger');
    aiScheduleLoading.classList.add('hidden');

    aiScheduleText.classList.remove('hidden');
    if (aiScheduleDisplayTitle) aiScheduleDisplayTitle.classList.add('hidden');
    if (aiMicBtn) aiMicBtn.classList.remove('hidden');

    aiScheduleInputPanel.classList.remove('hidden');
    btnAnalyzeAiSchedule.disabled = false;
  }
}

function renderAiScheduleCandidates() {
  aiScheduleList.innerHTML = '';
  if (aiScheduleCount) aiScheduleCount.textContent = aiScheduleEventsState.length;

  if (aiScheduleEventsState.length === 0) {
    aiScheduleList.innerHTML = '<div class="todo-empty-state">등록 가능한 일정이 없습니다.</div>';
    updateAiSelectedCount();
    return;
  }

  // Change cancel button to "다시 하기" on mobile
  if (window.innerWidth <= 768) {
    const btnCancelAiSchedule = document.getElementById('btn-cancel-ai-schedule');
    if (btnCancelAiSchedule) btnCancelAiSchedule.textContent = '다시 하기';
  }

  aiScheduleEventsState.forEach((event, index) => {
    const card = document.createElement('div');
    card.classList.add('extracted-card');
    card.dataset.index = index;

    // Check if on mobile
    if (window.innerWidth <= 768) {
      if (event.isEditing) {
        // Render Edit Form inside card
        const form = document.createElement('div');
        form.classList.add('card-edit-form');

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.value = event.title;
        titleInput.placeholder = '일정 제목';

        const startInput = document.createElement('input');
        startInput.type = 'datetime-local';
        startInput.value = toDatetimeLocalString(event.startDate);

        const endInput = document.createElement('input');
        endInput.type = 'datetime-local';
        endInput.value = toDatetimeLocalString(event.endDate);

        const actionsRow = document.createElement('div');
        actionsRow.style.display = 'flex';
        actionsRow.style.gap = '8px';
        actionsRow.style.marginTop = '4px';

        const btnSave = document.createElement('button');
        btnSave.type = 'button';
        btnSave.className = 'btn btn-success';
        btnSave.style.padding = '6px 12px';
        btnSave.style.fontSize = '0.85rem';
        btnSave.innerHTML = '<i data-lucide="check"></i> 저장';
        btnSave.addEventListener('click', () => {
          if (titleInput.value.trim()) {
            event.title = titleInput.value.trim();
            event.startDate = new Date(startInput.value).toISOString();
            event.endDate = new Date(endInput.value).toISOString();
            event.isEditing = false;
            renderAiScheduleCandidates();
          } else {
            showToast('일정 제목을 입력하세요.', 'danger');
          }
        });

        const btnCancel = document.createElement('button');
        btnCancel.type = 'button';
        btnCancel.className = 'btn btn-secondary';
        btnCancel.style.padding = '6px 12px';
        btnCancel.style.fontSize = '0.85rem';
        btnCancel.innerHTML = '<i data-lucide="x"></i> 취소';
        btnCancel.addEventListener('click', () => {
          event.isEditing = false;
          renderAiScheduleCandidates();
        });

        actionsRow.appendChild(btnSave);
        actionsRow.appendChild(btnCancel);

        form.appendChild(titleInput);
        form.appendChild(startInput);
        form.appendChild(endInput);
        form.appendChild(actionsRow);
        card.appendChild(form);
      } else {
        // Render Naver Calendar Premium Card Layout
        const startParsed = formatCustomTime(event.startDate);
        const endParsed = formatCustomTime(event.endDate);

        // Left Column (Time)
        const timeCol = document.createElement('div');
        timeCol.classList.add('card-time-col');
        if (event.allDay) {
          timeCol.classList.add('all-day');
          timeCol.innerHTML = '<div class="time-all-day">종일</div>';
        } else {
          timeCol.innerHTML = `
            <div class="time-start">${startParsed.time}</div>
            <div class="time-end">${endParsed.timeOnly}</div>
          `;
        }

        // Vertical Divider
        const divider = document.createElement('div');
        divider.classList.add('card-divider');

        // Right Column
        const rightCol = document.createElement('div');
        rightCol.classList.add('card-right-col');

        const titleEl = document.createElement('div');
        titleEl.classList.add('event-card-title');
        titleEl.textContent = event.title;

        const dateEl = document.createElement('div');
        dateEl.classList.add('event-card-date');
        dateEl.textContent = formatCustomDate(event.startDate);

        const calSelect = document.createElement('div');
        calSelect.classList.add('calendar-select');
        calSelect.innerHTML = `<span>[기본] 내 캘린더</span> <i data-lucide="chevron-down"></i>`;

        rightCol.appendChild(titleEl);
        rightCol.appendChild(dateEl);
        rightCol.appendChild(calSelect);

        // Edit Pencil Icon
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'card-edit-btn';
        editBtn.innerHTML = '<i data-lucide="pencil"></i>';
        editBtn.addEventListener('click', () => {
          event.isEditing = true;
          renderAiScheduleCandidates();
        });

        card.appendChild(timeCol);
        card.appendChild(divider);
        card.appendChild(rightCol);
        card.appendChild(editBtn);
      }
    } else {
      // Desktop: Keep original card structure with inputs and badges
      card.style.borderLeft = `4px solid ${event.color || '#4f46e5'}`;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.classList.add('extracted-card-checkbox', 'ai-schedule-checkbox');
      checkbox.addEventListener('change', () => {
        card.classList.toggle('disabled', !checkbox.checked);
        updateAiSelectedCount();
      });

      const details = document.createElement('div');
      details.classList.add('extracted-card-details');

      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.classList.add('extracted-card-title');
      titleInput.value = event.title;
      titleInput.addEventListener('input', e => {
        aiScheduleEventsState[index].title = e.target.value;
      });
      details.appendChild(titleInput);

      const dates = document.createElement('div');
      dates.classList.add('ai-schedule-dates');
      dates.appendChild(createAiDateField('시작', event.startDate, value => {
        aiScheduleEventsState[index].startDate = value;
      }, event.allDay, false));
      dates.appendChild(createAiDateField('종료', event.endDate, value => {
        aiScheduleEventsState[index].endDate = value;
      }, event.allDay, true));
      details.appendChild(dates);

      if (event.dateReason) {
        const reason = document.createElement('div');
        reason.classList.add('extracted-card-reason');
        reason.textContent = `날짜 판단: ${event.dateReason}`;
        details.appendChild(reason);
      }

      const meta = document.createElement('div');
      meta.classList.add('extracted-card-meta');

      if (event.allDay) {
        const allDayBadge = document.createElement('span');
        allDayBadge.classList.add('badge', 'badge-all-day');
        allDayBadge.textContent = '종일';
        meta.appendChild(allDayBadge);
      }

      if (Number.isFinite(event.confidence)) {
        const confidenceBadge = document.createElement('span');
        confidenceBadge.classList.add('badge', 'badge-confidence');
        confidenceBadge.textContent = `신뢰도 ${Math.round(event.confidence * 100)}%`;
        meta.appendChild(confidenceBadge);
      }
      details.appendChild(meta);

      card.appendChild(checkbox);
      card.appendChild(details);
    }

    aiScheduleList.appendChild(card);
  });

  updateAiSelectedCount();
  lucide.createIcons();
}

function formatCustomDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const yy = String(d.getFullYear()).slice(-2);
  const m = d.getMonth() + 1;
  const date = d.getDate();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const day = dayNames[d.getDay()];
  return `${yy}. ${m}. ${date}.(${day})`;
}

function formatCustomTime(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { ampm: '', time: '', timeOnly: '' };
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? '오후' : '오전';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return {
    ampm,
    time: `${ampm} ${String(hours).padStart(2, '0')}:${minutes}`,
    timeOnly: `${String(hours).padStart(2, '0')}:${minutes}`
  };
}

function toDatetimeLocalString(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function createAiDateField(labelText, value, onChange, allDay = false, isEnd = false) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('ai-schedule-date-field');

  const label = document.createElement('label');
  label.textContent = labelText;

  const input = document.createElement('input');
  input.type = allDay ? 'date' : 'datetime-local';
  input.value = allDay ? String(value).slice(0, 10) : formatIsoForInput(value);
  input.addEventListener('change', event => {
    const nextValue = allDay
      ? `${event.target.value}T${isEnd ? '23:59:59' : '00:00:00'}`
      : event.target.value;
    onChange(nextValue);
  });

  wrapper.appendChild(label);
  wrapper.appendChild(input);
  return wrapper;
}

function updateAiSelectedCount() {
  const selected = aiScheduleList.querySelectorAll('.ai-schedule-checkbox:checked').length;
  if (aiSelectedCount) aiSelectedCount.textContent = selected;
}

async function saveAiSchedules() {
  const selectedTasks = [];
  aiScheduleList.querySelectorAll('.ai-schedule-checkbox:checked').forEach(checkbox => {
    const card = checkbox.closest('.extracted-card');
    selectedTasks.push(aiScheduleEventsState[Number(card.dataset.index)]);
  });

  if (selectedTasks.length === 0) {
    showToast('등록할 일정을 선택해 주세요.', 'danger');
    return;
  }

  for (const task of selectedTasks) {
    if (!task.title.trim()) {
      showToast('일정 제목을 입력해 주세요.', 'danger');
      return;
    }
    if (!task.startDate || !task.endDate || new Date(task.startDate) >= new Date(task.endDate)) {
      showToast('일정의 시작 및 종료 시간을 확인해 주세요.', 'danger');
      return;
    }
  }

  btnSaveAiSchedules.disabled = true;
  try {
    const responses = await Promise.all(selectedTasks.map(task => fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    })));
    if (responses.some(response => !response.ok)) throw new Error('일부 일정을 등록하지 못했습니다.');

    showToast(`${selectedTasks.length}개의 AI 일정이 등록되었습니다.`, 'success');
    aiScheduleModal.classList.remove('open');
    resetAiScheduleModal();
    await fetchTodos();
  } catch (error) {
    console.error(error);
    showToast(error.message, 'danger');
    btnSaveAiSchedules.disabled = false;
  }
}

function renderWeek() {
  weekGrid.innerHTML = '';

  const today = new Date();
  const startOfWeek = getStartOfWeek(currentViewDate);

  // Update Topbar Title for week view
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const startYear = startOfWeek.getFullYear();
  const startMonth = startOfWeek.getMonth() + 1;
  const endYear = endOfWeek.getFullYear();
  const endMonth = endOfWeek.getMonth() + 1;

  let weekTitle = `${startYear}년 ${startMonth}월`;
  let mobileWeekTitle = `${startYear}. ${startMonth}.`;
  if (startYear !== endYear) {
    weekTitle = `${startYear}년 ${startMonth}월 ~ ${endYear}년 ${endMonth}월`;
    mobileWeekTitle = `${startYear}. ${startMonth}. ~ ${endMonth}.`;
  } else if (startMonth !== endMonth) {
    weekTitle = `${startYear}년 ${startMonth}월 ~ ${endMonth}월`;
    mobileWeekTitle = `${startYear}. ${startMonth}. ~ ${endMonth}.`;
  }

  currentViewTitle.textContent = weekTitle;
  if (mobileCurrentViewTitle) {
    mobileCurrentViewTitle.innerHTML = `${mobileWeekTitle} <i data-lucide="chevron-down" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-left: 2px;"></i>`;
  }

  // Check if today is in this week
  let isTodayInWeek = false;
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(startOfWeek);
    dayDate.setDate(startOfWeek.getDate() + i);
    if (dayDate.toDateString() === today.toDateString()) {
      isTodayInWeek = true;
      break;
    }
  }

  const mobileTodayBtn = document.getElementById('mobile-today-btn');
  if (mobileTodayBtn) {
    if (isTodayInWeek) {
      mobileTodayBtn.classList.add('hidden');
    } else {
      mobileTodayBtn.classList.remove('hidden');
      const isFuture = currentViewDate > today;
      if (isFuture) {
        mobileTodayBtn.innerHTML = '<i data-lucide="chevron-left"></i><span>오늘</span>';
      } else {
        mobileTodayBtn.innerHTML = '<span>오늘</span><i data-lucide="chevron-right"></i>';
      }
      lucide.createIcons();
    }
  }

  const filteredTodos = getFilteredTodos();
  const dayEntries = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + index);
    const dateString = formatDateString(date);
    const todos = filteredTodos.filter(todo => {
      const start = todo.startDate.substring(0, 10);
      const end = todo.endDate.substring(0, 10);
      return dateString >= start && dateString <= end;
    });
    return { date, dateString, todos };
  });
  const isAllDayTodo = todo => todo.allDay || todo.startDate.substring(0, 10) < todo.endDate.substring(0, 10);
  const maxAllDayRows = Math.max(0, ...dayEntries.map(({ todos }) => todos.filter(isAllDayTodo).length));
  weekGrid.style.setProperty('--week-all-day-rows', maxAllDayRows);

  const timeAxis = document.createElement('aside');
  timeAxis.classList.add('week-time-axis');
  const headerSpacer = document.createElement('div');
  headerSpacer.classList.add('week-time-axis-day-header');
  timeAxis.appendChild(headerSpacer);
  const allDaySpacer = document.createElement('div');
  allDaySpacer.classList.add('week-time-axis-all-day');
  timeAxis.appendChild(allDaySpacer);
  for (let hour = 0; hour < 24; hour++) {
    const slot = document.createElement('div');
    slot.classList.add('week-time-axis-slot');
    slot.textContent = `${String(hour).padStart(2, '0')}:00`;
    timeAxis.appendChild(slot);
  }
  weekGrid.appendChild(timeAxis);

  // Generate 7 days

  dayEntries.forEach(({ date: dayDate, dateString: dayStringStr, todos: dayTodos }) => {

    const isToday = dayDate.toDateString() === today.toDateString();

    // Day column wrapper
    const col = document.createElement('div');
    col.classList.add('week-day-col');
    if (isToday) col.classList.add('today');

    const dayOfWeek = dayDate.getDay();
    if (dayOfWeek === 0) col.classList.add('sunday');
    if (dayOfWeek === 6) col.classList.add('saturday');

    // Header for this day in the grid
    const headerContainer = document.createElement('div');
    headerContainer.classList.add('week-day-header-container');

    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const label = document.createElement('div');
    label.classList.add('week-day-label');
    label.textContent = dayNames[dayOfWeek];

    const num = document.createElement('div');
    num.classList.add('week-day-number');
    num.textContent = dayDate.getDate();

    headerContainer.appendChild(label);
    headerContainer.appendChild(num);
    col.appendChild(headerContainer);

    // Separate all-day items from time-based items.  Time-based cards are
    // positioned in the hourly grid instead of being stacked at the top.
    dayTodos.sort((a, b) => {
      const aAllDay = isAllDayTodo(a);
      const bAllDay = isAllDayTodo(b);
      if (aAllDay && !bAllDay) return -1;
      if (!aAllDay && bAllDay) return 1;
      return a.startDate.localeCompare(b.startDate);
    });

    const allDayContainer = document.createElement('div');
    allDayContainer.classList.add('week-all-day-container');
    dayTodos.filter(isAllDayTodo).forEach(todo => {
      const card = document.createElement('div');
      card.classList.add('week-event-card', 'week-all-day-card');
      if (todo.completed) card.classList.add('completed');
      const calendarColor = getTodoCalendarColor(todo);
      card.style.backgroundColor = calendarColor;
      card.style.borderLeftColor = darkenColor(calendarColor, -30);
      const titleEl = document.createElement('div');
      titleEl.classList.add('week-event-title');
      titleEl.textContent = todo.title;
      card.appendChild(titleEl);
      appendTodoCalendarBadge(card, todo);
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal(todo);
      });
      allDayContainer.appendChild(card);
    });
    col.appendChild(allDayContainer);

    const eventsContainer = document.createElement('div');
    eventsContainer.classList.add('week-events-container');
    const timedEvents = dayTodos.filter(todo => !isAllDayTodo(todo)).map(todo => getWeekTimedEventLayout(todo, dayStringStr));
    getWeekEventLanes(timedEvents).forEach(({ todo, start, end, lane, laneCount }) => {
      const card = document.createElement('div');
      card.classList.add('week-event-card', 'week-timed-card');
      if (todo.completed) card.classList.add('completed');
      const calendarColor = getTodoCalendarColor(todo);
      card.style.backgroundColor = calendarColor;
      card.style.borderLeftColor = darkenColor(calendarColor, -30);
      card.style.top = `calc(${start} * var(--week-minute-height))`;
      card.style.height = `max(28px, calc(${end - start} * var(--week-minute-height) - 3px))`;
      card.style.left = `calc(${(lane / laneCount) * 100}% + 2px)`;
      card.style.width = `calc(${100 / laneCount}% - 4px)`;
      card.title = `${formatTime(todo.startDate)} ~ ${formatTime(todo.endDate)} · ${todo.title}`;
      const titleEl = document.createElement('div');
      titleEl.classList.add('week-event-title');
      titleEl.textContent = todo.title;
      card.appendChild(titleEl);
      appendTodoCalendarBadge(card, todo);
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal(todo);
      });
      eventsContainer.appendChild(card);
    });
    col.appendChild(eventsContainer);

    // Add click listener to day column to add a new event for this date
    col.addEventListener('click', () => {
      const startIso = `${dayStringStr}T09:00`;
      const endIso = `${dayStringStr}T10:00`;
      openModal(null, startIso, endIso);
    });

    weekGrid.appendChild(col);
  });

  lucide.createIcons();

  // Auto scroll week grid to 8am or current hour
  requestAnimationFrame(() => {
    const scrollTargetHour = isTodayInWeek ? Math.max(0, Math.min(20, today.getHours() - 1)) : 8;
    const hourSlotHeight = 48;
    weekGrid.scrollTop = scrollTargetHour * hourSlotHeight;
  });
}

function getWeekTimedEventLayout(todo, dayString) {
  const dayStart = new Date(`${dayString}T00:00:00`).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const start = Math.max(dayStart, new Date(todo.startDate).getTime());
  const end = Math.min(dayEnd, new Date(todo.endDate).getTime());
  return {
    todo,
    start: Math.max(0, (start - dayStart) / 60000),
    end: Math.min(24 * 60, Math.max(30, (end - dayStart) / 60000)),
  };
}

function getWeekEventLanes(events) {
  const sorted = [...events].sort((a, b) => a.start - b.start || a.end - b.end);
  const groups = [];
  let group = [];
  let groupEnd = -Infinity;
  sorted.forEach(event => {
    if (group.length && event.start >= groupEnd) {
      groups.push(group);
      group = [];
      groupEnd = -Infinity;
    }
    group.push(event);
    groupEnd = Math.max(groupEnd, event.end);
  });
  if (group.length) groups.push(group);

  return groups.flatMap(items => {
    const laneEnds = [];
    items.forEach(event => {
      let lane = laneEnds.findIndex(end => end <= event.start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = event.end;
      event.lane = lane;
    });
    return items.map(event => ({ ...event, laneCount: laneEnds.length }));
  });
}

function getStartOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day;
  return new Date(date.setDate(diff));
}

function renderDay() {
  dayGrid.innerHTML = '';

  const today = new Date();
  const date = new Date(currentViewDate);
  const dayStringStr = formatDateString(date);
  const isToday = date.toDateString() === today.toDateString();

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const dayVal = date.getDate();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayOfWeek = dayNames[date.getDay()];

  // Update Topbar Title
  currentViewTitle.textContent = `${year}년 ${month}월 ${dayVal}일 (${dayOfWeek})`;
  if (mobileCurrentViewTitle) {
    mobileCurrentViewTitle.innerHTML = `${year}. ${month}. ${dayVal}. (${dayOfWeek}) <i data-lucide="chevron-down" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-left: 2px;"></i>`;
  }

  // Today button logic
  const mobileTodayBtn = document.getElementById('mobile-today-btn');
  if (mobileTodayBtn) {
    if (isToday) {
      mobileTodayBtn.classList.add('hidden');
    } else {
      mobileTodayBtn.classList.remove('hidden');
      const isFuture = date > today;
      if (isFuture) {
        mobileTodayBtn.innerHTML = '<i data-lucide="chevron-left"></i><span>오늘</span>';
      } else {
        mobileTodayBtn.innerHTML = '<span>오늘</span><i data-lucide="chevron-right"></i>';
      }
      lucide.createIcons();
    }
  }

  // Get filtered events for today
  const filteredTodos = getFilteredTodos();
  const dayTodos = filteredTodos.filter(todo => {
    const start = todo.startDate.substring(0, 10);
    const end = todo.endDate.substring(0, 10);
    return dayStringStr >= start && dayStringStr <= end;
  });

  const isAllDayTodo = todo => todo.allDay || (todo.startDate.substring(0, 10) < todo.endDate.substring(0, 10));
  const allDayTodos = dayTodos.filter(isAllDayTodo);
  const timedTodos = dayTodos.filter(todo => !isAllDayTodo(todo));

  // Render Day Header Banner
  const headerContainer = document.createElement('div');
  headerContainer.classList.add('day-timeline-header');

  let dayTypeClass = '';
  if (date.getDay() === 0) dayTypeClass = 'sunday';
  else if (date.getDay() === 6) dayTypeClass = 'saturday';

  headerContainer.innerHTML = `
    <div class="day-timeline-date-info">
      <span class="day-timeline-weekday ${dayTypeClass}">${dayOfWeek}요일</span>
      <span class="day-timeline-full-date">${year}년 ${month}월 ${dayVal}일</span>
    </div>
    <div class="day-timeline-count-badge">${dayTodos.length}개 일정</div>
  `;
  dayGrid.appendChild(headerContainer);

  // Render All Day Section if there are any
  if (allDayTodos.length > 0) {
    const allDaySection = document.createElement('div');
    allDaySection.classList.add('day-all-day-section');

    const allDayLabel = document.createElement('div');
    allDayLabel.classList.add('day-timeline-time-label');
    allDayLabel.innerHTML = '<span class="all-day-badge">종일</span>';

    const allDayContent = document.createElement('div');
    allDayContent.classList.add('day-all-day-content');

    allDayTodos.forEach(todo => {
      const card = createDayEventCard(todo);
      allDayContent.appendChild(card);
    });

    allDaySection.appendChild(allDayLabel);
    allDaySection.appendChild(allDayContent);
    dayGrid.appendChild(allDaySection);
  }

  // 30-Minute Interval Table Grid
  const SLOT_HEIGHT = 40; // 40px per 30 minutes (80px per hour)
  const timelineGrid = document.createElement('div');
  timelineGrid.classList.add('day-timeline-grid');

  for (let slotIndex = 0; slotIndex < 48; slotIndex++) {
    const hour = Math.floor(slotIndex / 2);
    const minute = (slotIndex % 2) * 30;
    const isHour = minute === 0;
    const hourStr = String(hour).padStart(2, '0');
    const minStr = String(minute).padStart(2, '0');
    const timeStr = `${hourStr}:${minStr}`;

    const nextSlotIndex = slotIndex + 1;
    const nextHour = Math.floor(nextSlotIndex / 2) % 24;
    const nextMinute = (nextSlotIndex % 2) * 30;
    const nextHourStr = String(nextHour).padStart(2, '0');
    const nextMinStr = String(nextMinute).padStart(2, '0');
    const nextTimeStr = `${nextHourStr}:${nextMinStr}`;

    const row = document.createElement('div');
    row.className = `day-timeline-row ${isHour ? 'is-hour' : 'is-half-hour'}`;
    row.setAttribute('data-slot', slotIndex);
    row.setAttribute('data-hour', hour);
    row.setAttribute('data-minute', minute);

    if (isToday) {
      const now = new Date();
      const currentSlot = now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0);
      if (slotIndex === currentSlot) {
        row.classList.add('current-slot');
      }
    }

    const label = document.createElement('div');
    label.className = `day-timeline-time-label ${isHour ? 'hour-label' : 'half-hour-label'}`;
    if (isHour) {
      label.innerHTML = `<span>${timeStr}</span>`;
    } else {
      label.innerHTML = `<span>:30</span>`;
    }

    const slot = document.createElement('div');
    slot.className = 'day-timeline-slot';
    slot.title = `${timeStr} ~ ${nextTimeStr} 클릭하여 일정 추가`;

    slot.addEventListener('click', (e) => {
      if (e.target === slot) {
        const startIso = `${dayStringStr}T${timeStr}:00`;
        const endIso = `${dayStringStr}T${nextTimeStr}:00`;
        openModal(null, startIso, endIso);
      }
    });

    row.appendChild(label);
    row.appendChild(slot);
    timelineGrid.appendChild(row);
  }

  // Current Time Indicator (if isToday)
  if (isToday) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentLineTop = (currentMinutes / 30) * SLOT_HEIGHT;

    const nowIndicator = document.createElement('div');
    nowIndicator.className = 'day-current-time-indicator';
    nowIndicator.style.top = `${currentLineTop}px`;
    nowIndicator.innerHTML = `
      <div class="day-current-time-dot"></div>
      <div class="day-current-time-bar"></div>
    `;
    timelineGrid.appendChild(nowIndicator);
  }

  // Place timed events on overlay
  if (timedTodos.length > 0) {
    const overlay = document.createElement('div');
    overlay.classList.add('day-timeline-events-overlay');

    const dayStart = new Date(`${dayStringStr}T00:00:00`).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    const timedEvents = timedTodos.map(todo => {
      const s = new Date(todo.startDate).getTime();
      const e = new Date(todo.endDate).getTime();
      const sTime = Math.max(dayStart, s);
      const eTime = Math.min(dayEnd, e);
      const startMinutes = Math.max(0, Math.floor((sTime - dayStart) / 60000));
      let endMinutes = Math.min(1440, Math.ceil((eTime - dayStart) / 60000));
      if (endMinutes <= startMinutes) {
        endMinutes = Math.min(1440, startMinutes + 30);
      }
      return {
        todo,
        startMinutes,
        endMinutes
      };
    });

    timedEvents.sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);

    const groups = [];
    let group = [];
    let groupEnd = -Infinity;

    timedEvents.forEach(item => {
      if (group.length && item.startMinutes >= groupEnd) {
        groups.push(group);
        group = [];
        groupEnd = -Infinity;
      }
      group.push(item);
      groupEnd = Math.max(groupEnd, item.endMinutes);
    });
    if (group.length) groups.push(group);

    groups.forEach(items => {
      const laneEnds = [];
      items.forEach(item => {
        let lane = laneEnds.findIndex(end => end <= item.startMinutes);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = item.endMinutes;
        item.lane = lane;
      });
      const laneCount = Math.max(1, laneEnds.length);
      items.forEach(item => {
        item.laneCount = laneCount;
      });
    });

    timedEvents.forEach(({ todo, startMinutes, endMinutes, lane, laneCount }) => {
      const card = createDayTimelineEventCard(todo, startMinutes, endMinutes);
      const topPx = (startMinutes / 30) * SLOT_HEIGHT;
      const durationMinutes = Math.max(20, endMinutes - startMinutes);
      const heightPx = Math.max(30, (durationMinutes / 30) * SLOT_HEIGHT - 4);
      const leftPct = (lane / laneCount) * 100;
      const widthPct = 100 / laneCount;

      card.style.top = `${topPx + 2}px`;
      card.style.height = `${heightPx}px`;
      card.style.left = `calc(${leftPct}% + 4px)`;
      card.style.width = `calc(${widthPct}% - 8px)`;

      overlay.appendChild(card);
    });

    timelineGrid.appendChild(overlay);
  }

  dayGrid.appendChild(timelineGrid);

  // Auto-scroll to active hour or default 08:00
  setTimeout(() => {
    let targetMinute = 8 * 60;
    if (timedTodos.length > 0) {
      const earliestStart = Math.min(...timedTodos.map(t => {
        const d = new Date(t.startDate);
        return d.getHours() * 60 + d.getMinutes();
      }));
      targetMinute = Math.max(0, earliestStart - 30);
    } else if (isToday) {
      const now = new Date();
      targetMinute = Math.max(0, (now.getHours() - 1) * 60);
    }
    const scrollOffset = (targetMinute / 30) * SLOT_HEIGHT;
    timelineGrid.scrollTo({ top: Math.max(0, scrollOffset - 10), behavior: 'smooth' });
  }, 60);

  lucide.createIcons();
}

// Helper to create an all-day event card
function createDayEventCard(todo) {
  const card = document.createElement('div');
  card.classList.add('day-event-card');
  if (todo.completed) card.classList.add('completed');

  const calendarColor = getTodoCalendarColor(todo);
  card.style.backgroundColor = calendarColor;
  card.style.borderLeftColor = darkenColor(calendarColor, -30);

  const titleEl = document.createElement('div');
  titleEl.classList.add('day-event-card-title');
  titleEl.textContent = todo.title;
  card.appendChild(titleEl);

  const isAllDay = todo.allDay || (todo.startDate.substring(0, 10) < todo.endDate.substring(0, 10));
  const timeEl = document.createElement('div');
  timeEl.classList.add('day-event-card-time');
  timeEl.textContent = isAllDay ? '종일' : `${formatTime(todo.startDate)} - ${formatTime(todo.endDate)}`;
  card.appendChild(timeEl);
  appendTodoCalendarBadge(card, todo);

  card.addEventListener('click', (e) => {
    e.stopPropagation();
    openModal(todo);
  });

  return card;
}

// Helper to create a timed event card on the 30-minute table grid
function createDayTimelineEventCard(todo, startMinutes, endMinutes) {
  const card = document.createElement('div');
  card.classList.add('day-timeline-event-card');
  if (todo.completed) card.classList.add('completed');

  const calendarColor = getTodoCalendarColor(todo);
  card.style.backgroundColor = calendarColor;
  card.style.borderLeftColor = darkenColor(calendarColor, -30);

  card.title = `${formatTime(todo.startDate)} ~ ${formatTime(todo.endDate)} · ${todo.title}`;

  const contentWrapper = document.createElement('div');
  contentWrapper.classList.add('day-timeline-event-content');

  const titleEl = document.createElement('div');
  titleEl.classList.add('day-timeline-event-title');
  titleEl.textContent = todo.title;
  contentWrapper.appendChild(titleEl);

  const duration = endMinutes - startMinutes;
  if (duration >= 30) {
    const timeEl = document.createElement('div');
    timeEl.classList.add('day-timeline-event-time');
    timeEl.textContent = `${formatTime(todo.startDate)} - ${formatTime(todo.endDate)}`;
    contentWrapper.appendChild(timeEl);
  }

  card.appendChild(contentWrapper);
  appendTodoCalendarBadge(contentWrapper, todo);

  card.addEventListener('click', (e) => {
    e.stopPropagation();
    openModal(todo);
  });

  return card;
}
