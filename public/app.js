// State management
let currentViewDate = new Date();
let currentView = 'month'; // 'month' or 'list'
let todos = [];
let selectedCategory = 'all';
let selectedPriority = 'all';
let searchQueryParams = '';
const holidayCache = new Map();
const holidayRequests = new Map();
let calendarWeekLaneCache = new Map();

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
const themeToggle = document.getElementById('theme-toggle');
const viewSelectors = document.querySelectorAll('.nav-menu [data-view]');
const categoryFilters = document.querySelectorAll('#category-filters li');
const priorityFilters = document.querySelectorAll('#priority-filters li');
const searchInput = document.getElementById('search-input');
const toastElement = document.getElementById('toast');

// Views Panels
const calendarViewPanel = document.getElementById('calendar-view');
const listViewPanel = document.getElementById('list-view');

// List view containers
const pendingList = document.getElementById('pending-list');
const completedList = document.getElementById('completed-list');
const pendingListCount = document.getElementById('pending-list-count');
const completedListCount = document.getElementById('completed-list-count');

// Progress stats
const todayProgress = document.getElementById('today-progress');
const completedCountText = document.getElementById('completed-count');
const totalCountText = document.getElementById('total-count');

// Chat Import DOM Elements
const btnImportChat = document.getElementById('btn-import-chat');
const importModal = document.getElementById('import-modal');
const closeImportModal = document.getElementById('close-import-modal');
const btnCancelImport = document.getElementById('btn-cancel-import');
const btnProcessImport = document.getElementById('btn-process-import');
const btnSaveImported = document.getElementById('btn-save-imported');
const chatDropZone = document.getElementById('chat-drop-zone');
const chatFileInput = document.getElementById('chat-file-input');
const fileNamePreview = document.getElementById('file-name-preview');
const uploadedFilename = document.getElementById('uploaded-filename');
const chatTextArea = document.getElementById('chat-text-area');
const importLoading = document.getElementById('import-loading');
const importPreview = document.getElementById('import-preview');
const extractedSchedulesList = document.getElementById('extracted-schedules-list');
const extractedCount = document.getElementById('extracted-count');
const selectedImportCount = document.getElementById('selected-import-count');

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
const kidsNoteJsonPanel = document.getElementById('kidsnote-json-panel');
const kidsNoteSessionPanel = document.getElementById('kidsnote-session-panel');
const kidsNoteDropZone = document.getElementById('kidsnote-drop-zone');
const kidsNoteFileInput = document.getElementById('kidsnote-file-input');
const kidsNoteFilePreview = document.getElementById('kidsnote-file-preview');
const kidsNoteFilename = document.getElementById('kidsnote-filename');
const kidsNoteUsername = document.getElementById('kidsnote-username');
const kidsNotePassword = document.getElementById('kidsnote-password');
const kidsNoteLoginForm = document.getElementById('kidsnote-login-form');
const btnKidsNoteLogin = document.getElementById('btn-kidsnote-login');
const btnKidsNoteLogout = document.getElementById('btn-kidsnote-logout');
const kidsNoteConnectionStatus = document.getElementById('kidsnote-connection-status');
const kidsNoteConnectionText = document.getElementById('kidsnote-connection-text');
const kidsNoteLoading = document.getElementById('kidsnote-loading');
const kidsNotePreview = document.getElementById('kidsnote-preview');
const kidsNoteList = document.getElementById('kidsnote-list');
const kidsNoteCount = document.getElementById('kidsnote-count');
const kidsNoteSummary = document.getElementById('kidsnote-summary');
const kidsNoteSelectedCount = document.getElementById('kidsnote-selected-count');

// Chat Import State
let extractedEventsState = [];
let extractedChatText = '';
let activeImportTab = 'tab-file';
let aiScheduleEventsState = [];
let kidsNoteMode = 'json';
let kidsNoteJsonData = null;
let kidsNoteEventsState = [];
let kidsNoteSessionConnected = false;

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupEventListeners();
  setupImportEventListeners();
  setupAiScheduleEventListeners();
  setupKidsNoteEventListeners();
  fetchTodos();
});

// Theme Setup
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
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
  
  // Navigation (Month vs List)
  viewSelectors.forEach(el => {
    el.addEventListener('click', () => {
      viewSelectors.forEach(v => v.classList.remove('active'));
      el.classList.add('active');
      currentView = el.dataset.view;
      switchView();
    });
  });

  // Category filters
  categoryFilters.forEach(el => {
    el.addEventListener('click', () => {
      categoryFilters.forEach(c => c.classList.remove('active'));
      el.classList.add('active');
      selectedCategory = el.dataset.category;
      render();
    });
  });

  // Priority filters
  priorityFilters.forEach(el => {
    el.addEventListener('click', () => {
      priorityFilters.forEach(p => p.classList.remove('active'));
      el.classList.add('active');
      selectedPriority = el.dataset.priority;
      render();
    });
  });

  // Search filter
  searchInput.addEventListener('input', (e) => {
    searchQueryParams = e.target.value.toLowerCase().trim();
    render();
  });

  // Calendar navigation
  btnPrev.addEventListener('click', () => {
    navigateCalendar(-1);
  });
  btnNext.addEventListener('click', () => {
    navigateCalendar(1);
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

  // Close modal when clicking outside the content
  window.addEventListener('click', (e) => {
    if (e.target === taskModal) {
      closeModal();
    }
  });

  // Preset Colors in Modal
  document.querySelectorAll('.preset-color').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.preset-color').forEach(p => p.classList.remove('active'));
      el.classList.add('active');
      document.getElementById('task-color').value = el.dataset.color;
    });
  });

  // Update preset color active border when color input changes
  document.getElementById('task-color').addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    document.querySelectorAll('.preset-color').forEach(p => {
      if (p.dataset.color.toLowerCase() === val) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });
  });
}

// Fetch events from server
async function fetchTodos() {
  try {
    const response = await fetch('/api/todos');
    if (!response.ok) throw new Error('서버 데이터를 불러오지 못했습니다.');
    todos = await response.json();
    render();
    updateStats();
  } catch (error) {
    showToast(error.message, 'danger');
  }
}

// View switcher (Calendar / List)
function switchView() {
  if (currentView === 'month') {
    calendarViewPanel.classList.add('active');
    listViewPanel.classList.remove('active');
    document.querySelector('.nav-buttons').classList.remove('hidden');
    renderCalendar();
  } else {
    calendarViewPanel.classList.remove('active');
    listViewPanel.classList.add('active');
    document.querySelector('.nav-buttons').classList.add('hidden');
    renderList();
  }
}

// Navigate Calendar
function navigateCalendar(direction) {
  const currentMonth = currentViewDate.getMonth();
  currentViewDate.setMonth(currentMonth + direction);
  render();
}

// Get filtered tasks helper
function getFilteredTodos() {
  return todos.filter(todo => {
    // 1. Category Filter
    if (selectedCategory !== 'all' && todo.category !== selectedCategory) {
      return false;
    }
    // 2. Priority Filter
    if (selectedPriority !== 'all' && todo.priority !== selectedPriority) {
      return false;
    }
    // 3. Search Filter
    if (searchQueryParams) {
      const matchTitle = todo.title.toLowerCase().includes(searchQueryParams);
      const matchContent = todo.content.toLowerCase().includes(searchQueryParams);
      if (!matchTitle && !matchContent) return false;
    }
    return true;
  });
}

// Main Render router
function render() {
  if (currentView === 'month') {
    renderCalendar();
  } else {
    renderList();
  }
}

// Render Calendar Month View
function renderCalendar() {
  calendarGrid.innerHTML = '';
  calendarWeekLaneCache = new Map();
  
  const year = currentViewDate.getFullYear();
  const month = currentViewDate.getMonth();

  ensureHolidayYear(year);
  if (month === 0) ensureHolidayYear(year - 1);
  if (month === 11) ensureHolidayYear(year + 1);
  
  // Format Month Title
  currentViewTitle.textContent = `${year}년 ${month + 1}월`;
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const prevLastDay = new Date(year, month, 0);
  
  const startDayOfWeek = firstDay.getDay(); // Day of week of first date
  const totalDays = lastDay.getDate();
  const prevTotalDays = prevLastDay.getDate();
  
  const today = new Date();
  
  // 42 cells grid (6 weeks)
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
  
  // 3. Next month leading days
  let nextMonthDay = 1;
  while (cellCount < 42) {
    const nextMonthDate = new Date(year, month + 1, nextMonthDay);
    createCalendarCell(nextMonthDate, false);
    nextMonthDay++;
    cellCount++;
  }
  
  lucide.createIcons();
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
  weekLanes.forEach(lane => {
    const todo = lane.find(item => {
      const start = item.startDate.substring(0, 10);
      const end = item.endDate.substring(0, 10);
      return dateStringStr >= start && dateStringStr <= end;
    });

    if (!todo) {
      const placeholder = document.createElement('div');
      placeholder.classList.add('event-lane-placeholder');
      eventContainer.appendChild(placeholder);
      return;
    }

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
    eventEl.style.backgroundColor = todo.color;
    eventEl.style.borderLeftColor = darkenColor(todo.color, -30);
    eventEl.textContent = continuesBefore ? '\u00a0' : todo.title;
    eventEl.title = todo.allDay
      ? `${todo.title}\n(종일)`
      : `${todo.title}\n(${formatTime(todo.startDate)} ~ ${formatTime(todo.endDate)})`;
    
    // Stop event propagation to prevent triggering cell click
    eventEl.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(todo);
    });
    
    eventContainer.appendChild(eventEl);
  });
  
  // Click cell to add new event
  cell.addEventListener('click', () => {
    const now = new Date();
    // Default time is 09:00 today, 10:00 end
    const startIso = `${dateStringStr}T09:00`;
    const endIso = `${dateStringStr}T10:00`;
    openModal(null, startIso, endIso);
  });
  
  calendarGrid.appendChild(cell);
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
  border.style.backgroundColor = todo.color;
  item.appendChild(border);
  
  // Checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.classList.add('todo-checkbox');
  checkbox.checked = todo.completed;
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
    content.textContent = todo.content;
    details.appendChild(content);
  }
  
  // Metadata tags
  const meta = document.createElement('div');
  meta.classList.add('todo-meta');
  
  const categoryMap = { general: '기타', work: '업무', personal: '개인', study: '학습' };
  const catBadge = document.createElement('span');
  catBadge.classList.add('badge', 'badge-category');
  catBadge.textContent = categoryMap[todo.category] || todo.category;
  meta.appendChild(catBadge);
  
  const priorityMap = { high: '높음', medium: '보통', low: '낮음' };
  const priBadge = document.createElement('span');
  priBadge.classList.add('badge', 'badge-priority', todo.priority);
  let iconName = 'help-circle';
  if (todo.priority === 'high') iconName = 'alert-triangle';
  if (todo.priority === 'medium') iconName = 'alert-circle';
  priBadge.innerHTML = `<i data-lucide="${iconName}" style="width:10px;height:10px;"></i> <span>${priorityMap[todo.priority]}</span>`;
  meta.appendChild(priBadge);
  
  details.appendChild(meta);
  item.appendChild(details);
  
  // Action buttons
  const actions = document.createElement('div');
  actions.classList.add('todo-actions');
  
  const editBtn = document.createElement('button');
  editBtn.classList.add('btn-icon');
  editBtn.style.padding = '0';
  editBtn.style.width = '30px';
  editBtn.style.height = '30px';
  editBtn.innerHTML = '<i data-lucide="edit-3" style="width:14px;height:14px;"></i>';
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
  const todayTasks = todos.filter(todo => {
    const start = todo.startDate.substring(0, 10);
    const end = todo.endDate.substring(0, 10);
    return todayStr >= start && todayStr <= end;
  });
  
  const total = todayTasks.length;
  const completed = todayTasks.filter(t => t.completed).length;
  
  totalCountText.textContent = total;
  completedCountText.textContent = completed;
  
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  todayProgress.style.width = `${progressPercent}%`;
}

// Modal handling
function openModal(todo = null, customStart = null, customEnd = null) {
  taskForm.reset();
  
  // Preset default colors borders
  document.querySelectorAll('.preset-color').forEach(p => p.classList.remove('active'));
  
  if (todo) {
    // Edit Mode
    document.getElementById('modal-title').textContent = '일정 세부 정보';
    document.getElementById('task-id').value = todo.id;
    document.getElementById('task-title').value = todo.title;
    document.getElementById('task-start-date').value = formatIsoForInput(todo.startDate);
    document.getElementById('task-end-date').value = formatIsoForInput(todo.endDate);
    document.getElementById('task-category').value = todo.category;
    document.getElementById('task-priority').value = todo.priority;
    document.getElementById('task-color').value = todo.color;
    document.getElementById('task-content').value = todo.content;
    
    btnDeleteTask.classList.remove('hidden');
    
    // Select active preset color border
    document.querySelectorAll('.preset-color').forEach(p => {
      if (p.dataset.color.toLowerCase() === todo.color.toLowerCase()) {
        p.classList.add('active');
      }
    });
  } else {
    // Create Mode
    document.getElementById('modal-title').textContent = '새 일정 추가';
    document.getElementById('task-id').value = '';
    
    const now = new Date();
    const start = customStart || formatIsoForInput(new Date(now.setMinutes(0)));
    const end = customEnd || formatIsoForInput(new Date(now.setHours(now.getHours() + 1)));
    
    document.getElementById('task-start-date').value = start;
    document.getElementById('task-end-date').value = end;
    document.getElementById('task-color').value = '#4f46e5';
    document.querySelector('.preset-color[data-color="#4f46e5"]').classList.add('active');
    
    btnDeleteTask.classList.add('hidden');
  }
  
  taskModal.classList.add('open');
  lucide.createIcons();
}

function closeModal() {
  taskModal.classList.remove('open');
}

// Handle Task Save Form Submit
async function handleFormSubmit(e) {
  e.preventDefault();
  
  const id = document.getElementById('task-id').value;
  const taskData = {
    title: document.getElementById('task-title').value,
    startDate: document.getElementById('task-start-date').value,
    endDate: document.getElementById('task-end-date').value,
    category: document.getElementById('task-category').value,
    priority: document.getElementById('task-priority').value,
    color: document.getElementById('task-color').value,
    content: document.getElementById('task-content').value
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

// ==========================================
// KAKAOTALK CHAT IMPORT FUNCTIONALITY
// ==========================================

function setupImportEventListeners() {
  // Open / Close modal
  btnImportChat.addEventListener('click', () => {
    resetImportModal();
    importModal.classList.add('open');
  });

  closeImportModal.addEventListener('click', () => {
    importModal.classList.remove('open');
  });

  btnCancelImport.addEventListener('click', () => {
    importModal.classList.remove('open');
  });

  // Close when clicking outside content
  window.addEventListener('click', (e) => {
    if (e.target === importModal) {
      importModal.classList.remove('open');
    }
  });

  // Tab switching
  const tabButtons = importModal.querySelectorAll('.modal-tabs .tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const targetPanel = btn.dataset.tab;
      activeImportTab = targetPanel;
      
      importModal.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(targetPanel).classList.add('active');
    });
  });

  // Drag and Drop Events
  chatDropZone.addEventListener('click', () => chatFileInput.click());
  
  chatFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleChatFile(e.target.files[0]);
    }
  });

  chatDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    chatDropZone.classList.add('dragover');
  });

  chatDropZone.addEventListener('dragleave', () => {
    chatDropZone.classList.remove('dragover');
  });

  chatDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    chatDropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleChatFile(e.dataTransfer.files[0]);
    }
  });

  // Action Buttons
  btnProcessImport.addEventListener('click', processChatImport);
  btnSaveImported.addEventListener('click', saveImportedSchedules);
}

// Reset Import Modal to initial state
function resetImportModal() {
  chatTextArea.value = '';
  chatFileInput.value = '';
  extractedChatText = '';
  extractedEventsState = [];
  
  // Show tabs, hide results and loaders
  document.querySelector('.modal-tabs').style.display = 'flex';
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.remove('hidden');
    if (p.id === activeImportTab) p.classList.add('active');
    else p.classList.remove('active');
  });
  
  fileNamePreview.classList.add('hidden');
  importLoading.classList.add('hidden');
  importPreview.classList.add('hidden');
  
  btnProcessImport.classList.remove('hidden');
  btnProcessImport.disabled = false;
  btnSaveImported.classList.add('hidden');
  
  extractedSchedulesList.innerHTML = '';
  extractedCount.textContent = '0';
  selectedImportCount.textContent = '0';
}

// Read File Content
function handleChatFile(file) {
  if (file.type !== 'text/plain' && !file.name.endsWith('.txt')) {
    showToast('올바른 텍스트 파일(.txt)을 선택해 주세요.', 'danger');
    return;
  }

  uploadedFilename.textContent = file.name;
  fileNamePreview.classList.remove('hidden');

  const reader = new FileReader();
  reader.onload = (e) => {
    extractedChatText = e.target.result;
    showToast('대화 파일을 성공적으로 로드했습니다.', 'success');
  };
  reader.onerror = () => {
    showToast('파일을 읽는 중에 오류가 발생했습니다.', 'danger');
  };
  reader.readAsText(file);
}

// API Call: Process raw text using LLM endpoint
async function processChatImport() {
  let textToParse = '';

  if (activeImportTab === 'tab-file') {
    textToParse = extractedChatText;
  } else {
    textToParse = chatTextArea.value.trim();
  }

  if (!textToParse) {
    showToast('분석할 대화 내용이 없습니다. 파일을 등록하거나 텍스트를 입력해 주세요.', 'danger');
    return;
  }

  // Switch view state to Loading
  document.querySelector('.modal-tabs').style.display = 'none';
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  importLoading.classList.remove('hidden');
  btnProcessImport.disabled = true;

  try {
    // Current base time for resolving relative date expressions
    const baseDate = formatLocalIsoWithOffset();
    
    const response = await fetch('/api/todos/parse-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chatText: textToParse,
        baseDate: baseDate
      })
    });

    if (!response.ok) {
      throw new Error('AI 분석 도중 서버 에러가 발생했습니다.');
    }

    const events = await response.json();
    
    importLoading.classList.add('hidden');
    importPreview.classList.remove('hidden');
    
    if (events && events.length > 0) {
      extractedEventsState = events;
      renderExtractedSchedules(events);
      btnProcessImport.classList.add('hidden');
      btnSaveImported.classList.remove('hidden');
    } else {
      extractedSchedulesList.innerHTML = '<div class="todo-empty-state">대화 내용에서 추출된 일정이 없습니다.</div>';
      btnSaveImported.classList.add('hidden');
      showToast('추출된 일정이 없습니다.', 'info');
    }
  } catch (error) {
    console.error(error);
    showToast(error.message, 'danger');
    // Revert state
    importLoading.classList.add('hidden');
    document.querySelector('.modal-tabs').style.display = 'flex';
    document.querySelectorAll('.tab-panel').forEach(p => {
      if (p.id === activeImportTab) p.classList.add('active');
      p.classList.remove('hidden');
    });
    btnProcessImport.disabled = false;
  }
}

// Render Preview List with Checkbox card controls
function renderExtractedSchedules(events) {
  extractedSchedulesList.innerHTML = '';
  extractedCount.textContent = events.length;
  
  let activeCount = 0;

  events.forEach((event, index) => {
    const card = document.createElement('div');
    card.classList.add('extracted-card');
    card.style.borderLeft = `4px solid ${event.color || '#4f46e5'}`;
    card.dataset.index = index;

    // Checkbox
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.classList.add('extracted-card-checkbox');
    cb.checked = true; // default select
    activeCount++;

    cb.addEventListener('change', () => {
      if (cb.checked) {
        card.classList.remove('disabled');
      } else {
        card.classList.add('disabled');
      }
      updateSelectedImportCount();
    });

    // Details wrapper
    const details = document.createElement('div');
    details.classList.add('extracted-card-details');

    // Header (Title editable field)
    const header = document.createElement('div');
    header.classList.add('extracted-card-header');

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.classList.add('extracted-card-title');
    titleInput.value = event.title;
    titleInput.addEventListener('input', (e) => {
      extractedEventsState[index].title = e.target.value;
    });
    header.appendChild(titleInput);
    details.appendChild(header);

    // Time range display
    const timeInfo = document.createElement('div');
    timeInfo.classList.add('extracted-card-time');
    const startPretty = event.allDay ? event.startDate.slice(0, 10) : formatIsoForInput(event.startDate).replace('T', ' ');
    const endPretty = event.allDay ? event.endDate.slice(0, 10) : formatIsoForInput(event.endDate).replace('T', ' ');
    const rangeText = event.allDay
      ? (startPretty === endPretty ? `${startPretty} · 종일` : `${startPretty} ~ ${endPretty} · 종일`)
      : `${startPretty} ~ ${endPretty}`;
    timeInfo.innerHTML = `<i data-lucide="calendar" style="width:12px;height:12px;"></i> <span>${rangeText}</span>`;
    details.appendChild(timeInfo);

    // Context desc
    if (event.content) {
      const desc = document.createElement('div');
      desc.classList.add('extracted-card-desc');
      desc.textContent = event.content;
      details.appendChild(desc);
    }

    if (event.dateReason) {
      const reason = document.createElement('div');
      reason.classList.add('extracted-card-reason');
      reason.textContent = `날짜 판단: ${event.dateReason}`;
      details.appendChild(reason);
    }

    // Category badge & priority badge
    const meta = document.createElement('div');
    meta.classList.add('extracted-card-meta');
    
    const catBadge = document.createElement('span');
    catBadge.classList.add('badge', 'badge-category');
    const categoryMap = { general: '기타', work: '업무', personal: '개인', study: '학습' };
    catBadge.textContent = categoryMap[event.category] || event.category;
    meta.appendChild(catBadge);

    const priBadge = document.createElement('span');
    priBadge.classList.add('badge', 'badge-priority', event.priority);
    const priorityMap = { high: '높음', medium: '보통', low: '낮음' };
    priBadge.textContent = priorityMap[event.priority] || event.priority;
    meta.appendChild(priBadge);

    if (Number.isFinite(event.confidence)) {
      const confidenceBadge = document.createElement('span');
      confidenceBadge.classList.add('badge', 'badge-confidence');
      confidenceBadge.textContent = `신뢰도 ${Math.round(event.confidence * 100)}%`;
      meta.appendChild(confidenceBadge);
    }

    details.appendChild(meta);

    card.appendChild(cb);
    card.appendChild(details);
    extractedSchedulesList.appendChild(card);
  });

  updateSelectedImportCount();
  lucide.createIcons();
}

// Calculate total checked checkboxes
function updateSelectedImportCount() {
  const checkboxes = document.querySelectorAll('.extracted-card-checkbox');
  let checkedCount = 0;
  checkboxes.forEach(cb => {
    if (cb.checked) checkedCount++;
  });
  selectedImportCount.textContent = checkedCount;
}

// Save checked schedules
async function saveImportedSchedules() {
  const checkboxes = document.querySelectorAll('.extracted-card-checkbox');
  const tasksToSave = [];

  checkboxes.forEach(cb => {
    if (cb.checked) {
      const card = cb.closest('.extracted-card');
      const idx = parseInt(card.dataset.index);
      tasksToSave.push(extractedEventsState[idx]);
    }
  });

  if (tasksToSave.length === 0) {
    showToast('선택된 일정이 없습니다.', 'danger');
    return;
  }

  btnSaveImported.disabled = true;
  showToast(`${tasksToSave.length}개의 일정을 등록하는 중...`, 'info');

  try {
    // Send POST requests concurrently
    const savePromises = tasksToSave.map(task => {
      return fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: task.title,
          content: task.content,
          startDate: task.startDate,
          endDate: task.endDate,
          allDay: task.allDay === true,
          category: task.category,
          priority: task.priority,
          color: task.color,
          dateReason: task.dateReason,
          evidence: task.evidence,
          confidence: task.confidence
        })
      });
    });

    const results = await Promise.all(savePromises);
    
    // Check if any request failed
    const failedIndex = results.findIndex(res => !res.ok);
    if (failedIndex !== -1) {
      throw new Error('일정 중 일부를 저장하는 데 실패했습니다.');
    }

    // Refresh UI
    showToast('모든 일정이 성공적으로 등록되었습니다! 🎉', 'success');
    importModal.classList.remove('open');
    
    // Fetch latest tasks list and update calendar
    fetchTodos();
  } catch (error) {
    console.error(error);
    showToast(error.message, 'danger');
    btnSaveImported.disabled = false;
  }
}

// KidsNote notice import flow
function setupKidsNoteEventListeners() {
  btnImportKidsNote.addEventListener('click', () => {
    resetKidsNoteModal();
    kidsNoteModal.classList.add('open');
  });
  closeKidsNoteModal.addEventListener('click', closeKidsNote);
  btnCancelKidsNote.addEventListener('click', closeKidsNote);
  btnAnalyzeKidsNote.addEventListener('click', analyzeKidsNote);
  btnSaveKidsNote.addEventListener('click', saveKidsNoteSchedules);
  btnKidsNoteBack.addEventListener('click', showKidsNoteInput);
  btnKidsNoteLogin.addEventListener('click', loginKidsNoteAccount);
  btnKidsNoteLogout.addEventListener('click', logoutKidsNoteAccount);
  window.addEventListener('click', event => {
    if (event.target === kidsNoteModal) closeKidsNote();
  });

  document.querySelectorAll('#kidsnote-tabs [data-kidsnote-mode]').forEach(button => {
    button.addEventListener('click', () => {
      kidsNoteMode = button.dataset.kidsnoteMode;
      document.querySelectorAll('#kidsnote-tabs [data-kidsnote-mode]').forEach(item => item.classList.toggle('active', item === button));
      kidsNoteJsonPanel.classList.toggle('hidden', kidsNoteMode !== 'json');
      kidsNoteSessionPanel.classList.toggle('hidden', kidsNoteMode !== 'saved_session');
      if (kidsNoteMode === 'saved_session') refreshKidsNoteSession();
    });
  });

  kidsNoteDropZone.addEventListener('click', () => kidsNoteFileInput.click());
  kidsNoteFileInput.addEventListener('change', event => {
    if (event.target.files[0]) readKidsNoteFile(event.target.files[0]);
  });
  kidsNoteDropZone.addEventListener('dragover', event => {
    event.preventDefault();
    kidsNoteDropZone.classList.add('dragover');
  });
  kidsNoteDropZone.addEventListener('dragleave', () => kidsNoteDropZone.classList.remove('dragover'));
  kidsNoteDropZone.addEventListener('drop', event => {
    event.preventDefault();
    kidsNoteDropZone.classList.remove('dragover');
    if (event.dataTransfer.files[0]) readKidsNoteFile(event.dataTransfer.files[0]);
  });
}

function closeKidsNote() {
  kidsNoteModal.classList.remove('open');
  kidsNotePassword.value = '';
}

function resetKidsNoteModal() {
  kidsNoteMode = 'json';
  kidsNoteJsonData = null;
  kidsNoteEventsState = [];
  kidsNoteFileInput.value = '';
  kidsNoteFilePreview.classList.add('hidden');
  kidsNoteFilename.textContent = '';
  kidsNoteUsername.value = '';
  kidsNotePassword.value = '';
  kidsNoteSessionConnected = false;
  renderKidsNoteConnection();
  kidsNoteJsonPanel.classList.remove('hidden');
  kidsNoteSessionPanel.classList.add('hidden');
  document.querySelectorAll('#kidsnote-tabs [data-kidsnote-mode]').forEach(button => button.classList.toggle('active', button.dataset.kidsnoteMode === 'json'));
  showKidsNoteInput();
  refreshKidsNoteSession();
}

function renderKidsNoteConnection(session = null) {
  kidsNoteLoginForm.classList.toggle('hidden', kidsNoteSessionConnected);
  kidsNoteConnectionStatus.classList.toggle('hidden', !kidsNoteSessionConnected);
  if (kidsNoteSessionConnected && session) {
    const expires = session.expiresAt ? new Date(session.expiresAt).toLocaleDateString('ko-KR') : '';
    kidsNoteConnectionText.textContent = `자녀 ID ${session.childId} 연결됨${expires ? ` · ${expires}까지` : ''}`;
  } else if (!kidsNoteSessionConnected) {
    kidsNoteConnectionText.textContent = '';
  }
}

async function refreshKidsNoteSession() {
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

function readKidsNoteFile(file) {
  if (!file.name.toLowerCase().endsWith('.json')) {
    showToast('키즈노트 JSON 파일을 선택해 주세요.', 'danger');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('JSON 파일은 10MB 이하만 분석할 수 있습니다.', 'danger');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      kidsNoteJsonData = JSON.parse(reader.result);
      kidsNoteFilename.textContent = file.name;
      kidsNoteFilePreview.classList.remove('hidden');
      showToast('키즈노트 JSON을 불러왔습니다.', 'success');
    } catch {
      kidsNoteJsonData = null;
      kidsNoteFilePreview.classList.add('hidden');
      showToast('올바른 JSON 파일이 아닙니다.', 'danger');
    }
  };
  reader.onerror = () => showToast('파일을 읽지 못했습니다.', 'danger');
  reader.readAsText(file);
}

async function analyzeKidsNote() {
  const payload = { mode: kidsNoteMode, baseDate: formatLocalIsoWithOffset() };
  if (kidsNoteMode === 'json') {
    if (!kidsNoteJsonData) {
      showToast('분석할 키즈노트 JSON 파일을 선택해 주세요.', 'danger');
      return;
    }
    payload.data = kidsNoteJsonData;
  } else {
    payload.mode = 'saved_session';
    if (!kidsNoteSessionConnected) {
      showToast('먼저 키즈노트 계정으로 로그인해 주세요.', 'danger');
      return;
    }
  }

  kidsNoteInputPanel.classList.add('hidden');
  kidsNotePreview.classList.add('hidden');
  kidsNoteLoading.classList.remove('hidden');
  btnAnalyzeKidsNote.disabled = true;
  try {
    const response = await fetch('/api/kidsnote/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || '키즈노트 데이터를 분석하지 못했습니다.');
    kidsNoteEventsState = Array.isArray(result.events) ? result.events : [];
    kidsNoteLoading.classList.add('hidden');
    kidsNotePreview.classList.remove('hidden');
    btnAnalyzeKidsNote.classList.add('hidden');
    kidsNoteSummary.textContent = `알림장 ${result.reportCount || 0}건 중 본문 ${result.analyzedCount || 0}건을 분석했습니다.`;
    renderKidsNoteCandidates();
    btnSaveKidsNote.classList.toggle('hidden', kidsNoteEventsState.length === 0);
  } catch (error) {
    kidsNoteLoading.classList.add('hidden');
    kidsNoteInputPanel.classList.remove('hidden');
    btnAnalyzeKidsNote.disabled = false;
    showToast(error.message, 'danger');
  }
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
    const card = document.createElement('div');
    card.className = 'extracted-card';
    card.dataset.index = index;
    card.style.borderLeft = `4px solid ${event.color || '#10b981'}`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
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
    card.appendChild(checkbox);
    card.appendChild(details);
    kidsNoteList.appendChild(card);
  });
  updateKidsNoteSelectedCount();
  lucide.createIcons();
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
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(task)
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
  btnAiSchedule.addEventListener('click', openAiScheduleModal);
  closeAiScheduleModal.addEventListener('click', closeAiSchedule);
  btnCancelAiSchedule.addEventListener('click', closeAiSchedule);
  btnAnalyzeAiSchedule.addEventListener('click', analyzeAiScheduleText);
  btnSaveAiSchedules.addEventListener('click', saveAiSchedules);
  btnAiScheduleBack.addEventListener('click', showAiScheduleInput);

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
  aiScheduleCount.textContent = '0';
  aiSelectedCount.textContent = '0';
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
    aiScheduleInputPanel.classList.remove('hidden');
    btnAnalyzeAiSchedule.disabled = false;
  }
}

function renderAiScheduleCandidates() {
  aiScheduleList.innerHTML = '';
  aiScheduleCount.textContent = aiScheduleEventsState.length;

  if (aiScheduleEventsState.length === 0) {
    aiScheduleList.innerHTML = '<div class="todo-empty-state">등록 가능한 일정이 없습니다.</div>';
    updateAiSelectedCount();
    return;
  }

  const categoryMap = { general: '기타', work: '업무', personal: '개인', study: '학습' };
  const priorityMap = { high: '높음', medium: '보통', low: '낮음' };

  aiScheduleEventsState.forEach((event, index) => {
    const card = document.createElement('div');
    card.classList.add('extracted-card');
    card.dataset.index = index;
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

    const categoryBadge = document.createElement('span');
    categoryBadge.classList.add('badge', 'badge-category');
    categoryBadge.textContent = categoryMap[event.category] || event.category;
    meta.appendChild(categoryBadge);

    if (event.allDay) {
      const allDayBadge = document.createElement('span');
      allDayBadge.classList.add('badge', 'badge-all-day');
      allDayBadge.textContent = '종일';
      meta.appendChild(allDayBadge);
    }

    const priorityBadge = document.createElement('span');
    priorityBadge.classList.add('badge', 'badge-priority', event.priority);
    priorityBadge.textContent = priorityMap[event.priority] || event.priority;
    meta.appendChild(priorityBadge);

    if (Number.isFinite(event.confidence)) {
      const confidenceBadge = document.createElement('span');
      confidenceBadge.classList.add('badge', 'badge-confidence');
      confidenceBadge.textContent = `신뢰도 ${Math.round(event.confidence * 100)}%`;
      meta.appendChild(confidenceBadge);
    }
    details.appendChild(meta);

    card.appendChild(checkbox);
    card.appendChild(details);
    aiScheduleList.appendChild(card);
  });

  updateAiSelectedCount();
  lucide.createIcons();
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
  aiSelectedCount.textContent = selected;
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
