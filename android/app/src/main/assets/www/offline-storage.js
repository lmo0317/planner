/**
 * NEO Planner - Offline & Android Local Storage Layer
 * Seamlessly handles API requests locally using localStorage when running standalone,
 * inside an Android App (WebView), or when backend server is not available.
 */

(function () {
  const STORAGE_KEY = 'planner_todos_local';

  // Sample initial data if user opens app for the first time
  const INITIAL_TODOS = [
    {
      id: 1,
      title: 'NEO Planner 사용법 확인하기',
      startDate: `${new Date().toISOString().split('T')[0]}T10:00`,
      endDate: `${new Date().toISOString().split('T')[0]}T11:00`,
      allDay: false,
      category: 'general',
      priority: 'high',
      completed: false,
      description: '안드로이드 어플 로컬 저장소 모드로 작동 중입니다.',
      source: 'general'
    },
    {
      id: 2,
      title: '주간 일정 정리하기',
      startDate: `${new Date().toISOString().split('T')[0]}T14:00`,
      endDate: `${new Date().toISOString().split('T')[0]}T15:00`,
      allDay: false,
      category: 'general',
      priority: 'medium',
      completed: false,
      description: '월/주/일/목록 뷰에서 일정을 관리해 보세요.',
      source: 'general'
    }
  ];

  function normalizeLocalTodo(todo) {
    const date = todo.date || new Date().toISOString().split('T')[0];
    const time = todo.time || '09:00';
    const startDate = todo.startDate || `${date}T${time}`;
    const hour = Number(time.slice(0, 2));
    const endDate = todo.endDate || `${date}T${hour < 23 ? String(hour + 1).padStart(2, '0') : '23'}:${hour < 23 ? time.slice(3, 5) : '59'}`;
    return {
      ...todo,
      startDate,
      endDate,
      allDay: Boolean(todo.allDay),
      color: todo.color || '#4f46e5',
      content: todo.content || todo.description || ''
    };
  }

  function getLocalTodos() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TODOS));
        return INITIAL_TODOS;
      }
      const todos = JSON.parse(data).map(normalizeLocalTodo);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
      return todos;
    } catch (e) {
      console.error('LocalStorage read error:', e);
      return [];
    }
  }

  function saveLocalTodos(todos) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch (e) {
      console.error('LocalStorage write error:', e);
    }
  }

  // Korean Holiday helper for offline mode
  function getOfflineHolidays(year) {
    const fixedHolidays = [
      { date: `${year}-01-01`, name: '신정', isHeaderHoliday: true },
      { date: `${year}-03-01`, name: '삼일절', isHeaderHoliday: true },
      { date: `${year}-05-05`, name: '어린이날', isHeaderHoliday: true },
      { date: `${year}-06-06`, name: '현충일', isHeaderHoliday: true },
      { date: `${year}-08-15`, name: '광복절', isHeaderHoliday: true },
      { date: `${year}-10-03`, name: '개천절', isHeaderHoliday: true },
      { date: `${year}-10-09`, name: '한글날', isHeaderHoliday: true },
      { date: `${year}-12-25`, name: '성탄절', isHeaderHoliday: true }
    ];

    // Common lunar holiday presets (2024 - 2030)
    const lunarPresets = {
      2024: [
        { date: '2024-02-09', name: '설날 연휴' }, { date: '2024-02-10', name: '설날' }, { date: '2024-02-11', name: '설날 연휴' }, { date: '2024-02-12', name: '대체공휴일' },
        { date: '2024-05-15', name: '부처님오신날' },
        { date: '2024-09-16', name: '추석 연휴' }, { date: '2024-09-17', name: '추석' }, { date: '2024-09-18', name: '추석 연휴' }
      ],
      2025: [
        { date: '2025-01-28', name: '설날 연휴' }, { date: '2025-01-29', name: '설날' }, { date: '2025-01-30', name: '설날 연휴' },
        { date: '2025-05-05', name: '부처님오신날' },
        { date: '2025-10-05', name: '추석 연휴' }, { date: '2025-10-06', name: '추석' }, { date: '2025-10-07', name: '추석 연휴' }, { date: '2025-10-08', name: '대체공휴일' }
      ],
      2026: [
        { date: '2026-02-16', name: '설날 연휴' }, { date: '2026-02-17', name: '설날' }, { date: '2026-02-18', name: '설날 연휴' },
        { date: '2026-05-24', name: '부처님오신날' },
        { date: '2026-09-24', name: '추석 연휴' }, { date: '2026-09-25', name: '추석' }, { date: '2026-09-26', name: '추석 연휴' }
      ],
      2027: [
        { date: '2027-02-06', name: '설날 연휴' }, { date: '2027-02-07', name: '설날' }, { date: '2027-02-08', name: '설날 연휴' }, { date: '2027-02-09', name: '대체공휴일' },
        { date: '2027-05-13', name: '부처님오신날' },
        { date: '2027-09-14', name: '추석 연휴' }, { date: '2027-09-15', name: '추석' }, { date: '2027-09-16', name: '추석 연휴' }
      ]
    };

    const extra = lunarPresets[year] || [];
    return [...fixedHolidays, ...extra];
  }

  function extractDateFromText(text, now) {
    const monthDayMatch = text.match(/(\d{1,2})월\s*(\d{1,2})일/);
    const dayOfWeekMatch = text.match(/(이번\s*주|다음\s*주|다다음\s*주)?\s*(월|화|수|목|금|토|일)요일/);

    if (text.includes('오늘')) return new Date(now);
    if (text.includes('내일')) { const d = new Date(now); d.setDate(d.getDate() + 1); return d; }
    if (text.includes('모레')) { const d = new Date(now); d.setDate(d.getDate() + 2); return d; }
    if (text.includes('글피')) { const d = new Date(now); d.setDate(d.getDate() + 3); return d; }
    if (monthDayMatch) {
      const month = parseInt(monthDayMatch[1], 10) - 1;
      const day = parseInt(monthDayMatch[2], 10);
      const d = new Date(now.getFullYear(), month, day);
      if (d < now && month < now.getMonth()) d.setFullYear(d.getFullYear() + 1);
      return d;
    }
    if (dayOfWeekMatch) {
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const targetDay = days.indexOf(dayOfWeekMatch[2]);
      const currentDay = now.getDay();
      let diff = (targetDay - currentDay + 7) % 7;
      if (diff === 0) diff = 7;
      if (dayOfWeekMatch[1] && dayOfWeekMatch[1].includes('다음')) diff += 7;
      const d = new Date(now);
      d.setDate(d.getDate() + diff);
      return d;
    }
    return null;
  }

  function parseSingleLineSchedule(line, defaultDate, now) {
    if (!line || !line.trim()) return null;
    let targetDate = new Date(defaultDate || now);
    let title = line.trim();

    const lineDate = extractDateFromText(title, now);
    if (lineDate) {
      targetDate = lineDate;
      title = title.replace(/오늘|내일|모레|글피|\d{1,2}월\s*\d{1,2}일|(이번\s*주|다음\s*주)?\s*[월화수목금토일]요일/g, '').trim();
    }

    const rangeRegex = /(?:(오전|오후|아침|저녁|밤|새벽)\s*)?(\d{1,2})(?::(\d{2})|시)?\s*(?:-|~|부터|\/)\s*(?:(오전|오후|아침|저녁|밤|새벽)\s*)?(\d{1,2})(?::(\d{2})|시)?/i;
    const rangeMatch = title.match(rangeRegex);

    let startHour = 9, startMin = 0, endHour = 10, endMin = 0;
    let isAllDay = true;

    if (rangeMatch) {
      isAllDay = false;
      const startAmPm = rangeMatch[1];
      let sH = parseInt(rangeMatch[2], 10);
      const sM = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : 0;
      const endAmPm = rangeMatch[4] || startAmPm;
      let eH = parseInt(rangeMatch[5], 10);
      const eM = rangeMatch[6] ? parseInt(rangeMatch[6], 10) : 0;

      if (startAmPm && /오후|저녁|밤/.test(startAmPm) && sH < 12) sH += 12;
      if (startAmPm && /오전|아침|새벽/.test(startAmPm) && sH === 12) sH = 0;
      if (endAmPm && /오후|저녁|밤/.test(endAmPm) && eH < 12) eH += 12;
      if (endAmPm && /오전|아침|새벽/.test(endAmPm) && eH === 12) eH = 0;

      if (!startAmPm && !endAmPm) {
        if (sH <= 6) sH += 12;
        if (eH < sH && eH <= 12) eH += 12;
      }

      startHour = sH; startMin = sM;
      endHour = eH; endMin = eM;
      title = title.replace(rangeMatch[0], '').trim();
    } else {
      const singleRegex = /(?:(오전|오후|아침|저녁|밤|새벽)\s*)?(\d{1,2})(?::(\d{2})|시(?:\s*(\d{1,2})분)?)/i;
      const singleMatch = title.match(singleRegex);
      if (singleMatch) {
        isAllDay = false;
        const ampm = singleMatch[1];
        let h = parseInt(singleMatch[2], 10);
        const m = singleMatch[3] ? parseInt(singleMatch[3], 10) : (singleMatch[4] ? parseInt(singleMatch[4], 10) : 0);

        if (ampm && /오후|저녁|밤/.test(ampm) && h < 12) h += 12;
        if (ampm && /오전|아침|새벽/.test(ampm) && h === 12) h = 0;
        if (!ampm && h <= 6) h += 12;

        startHour = h; startMin = m;
        endHour = Math.min(23, h + 1); endMin = m;
        title = title.replace(singleMatch[0], '').trim();
      } else if (/점심/.test(title)) {
        isAllDay = false;
        startHour = 12; startMin = 0; endHour = 13; endMin = 0;
        title = title.replace('점심', '').trim();
      } else if (/저녁/.test(title)) {
        isAllDay = false;
        startHour = 18; startMin = 0; endHour = 19; endMin = 0;
        title = title.replace('저녁', '').trim();
      }
    }

    title = title.replace(/^[에은는을를과와의\s\-\~:]+|[에은는을를과와의\s\-\~:]+$/g, '').trim();
    if (!title) title = line.trim();

    const y = targetDate.getFullYear();
    const mo = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${mo}-${d}`;

    const sHStr = String(startHour).padStart(2, '0');
    const sMStr = String(startMin).padStart(2, '0');
    const eHStr = String(endHour).padStart(2, '0');
    const eMStr = String(endMin).padStart(2, '0');

    const startDate = isAllDay ? `${dateStr}T00:00:00+09:00` : `${dateStr}T${sHStr}:${sMStr}:00+09:00`;
    const endDate = isAllDay ? `${dateStr}T23:59:59+09:00` : `${dateStr}T${eHStr}:${eMStr}:00+09:00`;

    let category = 'general';
    if (/회의|미팅|업무|보고|프로젝트|출근|퇴근|출장|마감/i.test(title)) category = 'work';
    else if (/공부|과제|시험|강의|수업|스터디|학원|독서/i.test(title)) category = 'study';
    else if (/축구|체육|운동|헬스|수영|병원|치과|친구|약속|생일|여행|데이트|식사|쇼핑|토토/i.test(title)) category = 'personal';

    return {
      title,
      content: '',
      startDate,
      endDate,
      allDay: isAllDay,
      priority: 'medium',
      category,
      dateReason: isAllDay ? `${dateStr} 종일` : `${dateStr} ${sHStr}:${sMStr}~${eHStr}:${eMStr}`,
      confidence: 0.95
    };
  }

  // Offline Natural Language Processing helper supporting multi-line & multi-event inputs
  function parseNaturalLanguageOffline(text, baseDate) {
    if (!text || typeof text !== 'string' || !text.trim()) return [];
    const trimmed = text.trim();
    const now = baseDate ? new Date(baseDate) : new Date();

    const rawLines = trimmed
      .split(/\r?\n+|(?<=[^\d])[,;](?=[^\d])/)
      .map(l => l.trim())
      .filter(Boolean);

    if (rawLines.length === 0) return [];

    let globalDate = new Date(now);
    let linesToProcess = [];

    for (const line of rawLines) {
      const isOnlyDate = /^(오늘|내일|모레|글피|\d{1,2}월\s*\d{1,2}일|\d{4}[-./년]\s*\d{1,2}[-./월]\s*\d{1,2}|(이번\s*주|다음\s*주)?\s*[월화수목금토일]요일)$/i.test(line);
      if (isOnlyDate) {
        const parsedDate = extractDateFromText(line, now);
        if (parsedDate) globalDate = parsedDate;
      } else {
        linesToProcess.push(line);
      }
    }

    if (linesToProcess.length === 0) linesToProcess = rawLines;

    const events = [];
    for (const line of linesToProcess) {
      const parsedEvent = parseSingleLineSchedule(line, globalDate, now);
      if (parsedEvent) events.push(parsedEvent);
    }

    return events;
  }

  // Local API handler router
  async function handleLocalApi(urlStr, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const url = new URL(urlStr, 'http://localhost');
    const pathname = url.pathname;

    // GET /api/todos
    if (pathname === '/api/todos' && method === 'GET') {
      const todos = getLocalTodos();
      return new Response(JSON.stringify(todos), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST /api/todos
    if (pathname === '/api/todos' && method === 'POST') {
      const body = options.body ? JSON.parse(options.body) : {};
      const todos = getLocalTodos();
      const newTodo = {
        ...body,
        id: Date.now(),
        title: body.title || '새 일정',
        startDate: body.startDate || `${body.date || new Date().toISOString().split('T')[0]}T${body.time || '09:00'}`,
        endDate: body.endDate || `${body.date || new Date().toISOString().split('T')[0]}T10:00`,
        allDay: Boolean(body.allDay),
        color: body.color || '#4f46e5',
        category: body.category || 'general',
        priority: body.priority || 'medium',
        completed: Boolean(body.completed),
        description: body.description || '',
        source: body.source || 'general',
        created_at: new Date().toISOString()
      };
      todos.push(newTodo);
      saveLocalTodos(todos);
      return new Response(JSON.stringify(newTodo), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // PUT /api/todos/:id
    const putMatch = pathname.match(/^\/api\/todos\/([^/]+)$/);
    if (putMatch && method === 'PUT') {
      const id = putMatch[1];
      const body = options.body ? JSON.parse(options.body) : {};
      let todos = getLocalTodos();
      let updatedTodo = null;
      todos = todos.map(t => {
        if (String(t.id) === String(id)) {
          updatedTodo = { ...t, ...body, id: t.id };
          return updatedTodo;
        }
        return t;
      });
      saveLocalTodos(todos);
      return new Response(JSON.stringify(updatedTodo || body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // DELETE /api/todos/:id
    const delMatch = pathname.match(/^\/api\/todos\/([^/]+)$/);
    if (delMatch && method === 'DELETE') {
      const id = delMatch[1];
      let todos = getLocalTodos();
      todos = todos.filter(t => String(t.id) !== String(id));
      saveLocalTodos(todos);
      return new Response(JSON.stringify({ message: 'Deleted successfully' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST /api/todos/parse-natural-language
    if (pathname === '/api/todos/parse-natural-language' && method === 'POST') {
      const body = options.body ? JSON.parse(options.body) : {};
      const events = parseNaturalLanguageOffline(body.text, body.baseDate);
      return new Response(JSON.stringify({ success: true, events, clarification: '' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET /api/holidays
    if (pathname === '/api/holidays' && method === 'GET') {
      const year = parseInt(url.searchParams.get('year') || new Date().getFullYear(), 10);
      const holidays = getOfflineHolidays(year);
      return new Response(JSON.stringify({ year, holidays }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Auth & Integration Status Fallbacks
    if (pathname.includes('/status') || pathname.includes('/session')) {
      return new Response(JSON.stringify({ authenticated: false, connected: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Default empty success response
    return new Response(JSON.stringify({ success: true, offline: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const REMOTE_API_BASE = 'https://minohlee.mooo.com';

  // Intercept window.fetch
  const originalFetch = window.fetch;
  window.fetch = async function (resource, options = {}) {
    const urlString = typeof resource === 'string' ? resource : resource ? resource.url : '';
    const isFileProtocol = window.location.protocol === 'file:';
    const isApiCall = urlString.includes('/api/');

    if (isFileProtocol && isApiCall) {
      const remoteUrl = urlString.startsWith('http') ? urlString : `${REMOTE_API_BASE}${urlString}`;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const fetchOptions = { ...options, credentials: 'include', signal: controller.signal };
        const response = await originalFetch(remoteUrl, fetchOptions);
        clearTimeout(timeoutId);
        if (response.ok || response.status < 500) {
          return response;
        }
      } catch (err) {
        console.warn(`Remote server (${remoteUrl}) unreachable, falling back to local offline storage:`, err);
      }
      return handleLocalApi(urlString, options);
    }

    if (isApiCall) {
      try {
        const response = await originalFetch(resource, options);
        return response;
      } catch (err) {
        console.warn('Backend server unreachable, switching to local offline storage:', err);
        return handleLocalApi(urlString, options);
      }
    }

    return originalFetch(resource, options);
  };

  console.log('📱 NEO Planner Local Storage & Offline Engine Ready!');
})();
