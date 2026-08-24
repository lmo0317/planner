require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const { execFile } = require('child_process');
const { promisify } = require('util');
const db = require('./db');

const execFileAsync = promisify(execFile);
const app = express();
const PORT = process.env.PORT || 3000;
const LLM_BASE_URL = (process.env.LLM_BASE_URL || 'http://minohlee.mooo.com:8081').replace(/\/$/, '');
const LLM_MODEL = process.env.LLM_MODEL || 'gemma-4-e4b-it-q4km';
const LLM_TIMEOUT_MS = Math.max(5000, Number(process.env.LLM_TIMEOUT_MS) || 60000);
const KIDSNOTE_SESSION_SECRET = process.env.KIDSNOTE_SESSION_SECRET || '';
const KIDSNOTE_SESSION_COOKIE = 'planner_kidsnote_session';
const KIDSNOTE_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const KIDSNOTE_SESSION_FILE = path.join(__dirname, 'data', 'kidsnote-sessions.json');
const TIMETREE_SESSION_COOKIE = 'planner_timetree_session';
const TIMETREE_SESSION_FILE = path.join(__dirname, 'data', 'timetree-session.json');
const TIMETREE_CALENDAR_ID = process.env.TIMETREE_CALENDAR_ID || 'UvLp28KQRT2D';
const TIMETREE_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CHROMIUM_EXECUTABLE = process.env.CHROMIUM_EXECUTABLE || '/snap/bin/chromium';
const GOOGLE_CALENDAR_TOKEN_FILE = path.join(__dirname, 'data', 'google-calendar-token.json');
const GOOGLE_CALENDAR_STATE_COOKIE = 'planner_google_calendar_state';
const GOOGLE_CALENDAR_RETURN_COOKIE = 'planner_google_calendar_return';
const GOOGLE_CALENDAR_TIME_ZONE = 'Asia/Seoul';
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
const GOOGLE_CALENDAR_FALLBACK_NAME = '기본 캘린더';
const kidsNoteAnalysisJobs = new Map();
let googleCalendarSyncQueue = Promise.resolve();
let timeTreeSyncQueue = Promise.resolve();

let koreanHolidayModulePromise;

function getGoogleCalendarConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
    encryptionKey: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || ''
  };
}

function isGoogleCalendarConfigured() {
  const config = getGoogleCalendarConfig();
  return Boolean(config.clientId && config.clientSecret && config.redirectUri && config.encryptionKey);
}

function getGoogleCalendarCipherKey() {
  return crypto.createHash('sha256').update(getGoogleCalendarConfig().encryptionKey).digest();
}

function encryptGoogleCalendarToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getGoogleCalendarCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(token), 'utf8'), cipher.final()]);
  return JSON.stringify({
    version: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64')
  }, null, 2);
}

function decryptGoogleCalendarToken(payload) {
  const encrypted = JSON.parse(payload);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getGoogleCalendarCipherKey(), Buffer.from(encrypted.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
  const plain = Buffer.concat([decipher.update(Buffer.from(encrypted.data, 'base64')), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}

function readGoogleCalendarTokenStore() {
  if (!isGoogleCalendarConfigured() || !fs.existsSync(GOOGLE_CALENDAR_TOKEN_FILE)) return null;
  try {
    return decryptGoogleCalendarToken(fs.readFileSync(GOOGLE_CALENDAR_TOKEN_FILE, 'utf8'));
  } catch (error) {
    console.error('Failed to read Google Calendar connection:', error.message);
    return null;
  }
}

function writeGoogleCalendarTokenStore(store) {
  fs.mkdirSync(path.dirname(GOOGLE_CALENDAR_TOKEN_FILE), { recursive: true });
  fs.writeFileSync(GOOGLE_CALENDAR_TOKEN_FILE, encryptGoogleCalendarToken(store), { mode: 0o600 });
}

function parseRequestCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(item => {
    const index = item.indexOf('=');
    return index === -1 ? [] : [item.slice(0, index).trim(), decodeURIComponent(item.slice(index + 1).trim())];
  }).filter(item => item.length));
}

function clearGoogleCalendarStateCookie(res) {
  res.setHeader('Set-Cookie', [
    `${GOOGLE_CALENDAR_STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
    `${GOOGLE_CALENDAR_RETURN_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  ]);
}

function getGoogleOAuthScopes() {
  return ['openid', 'email', 'profile', GOOGLE_CALENDAR_SCOPE];
}

async function getGoogleCalendarAccessToken() {
  const store = readGoogleCalendarTokenStore();
  if (!store?.refreshToken) throw new Error('Google Calendar is not connected.');
  if (store.accessToken && store.expiresAt > Date.now() + 60 * 1000) return { store, accessToken: store.accessToken };

  const config = getGoogleCalendarConfig();
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: store.refreshToken,
      grant_type: 'refresh_token'
    })
  });
  const token = await response.json();
  if (!response.ok) throw new Error(token.error_description || 'Google token refresh failed.');
  store.accessToken = token.access_token;
  store.expiresAt = Date.now() + Number(token.expires_in || 3600) * 1000;
  writeGoogleCalendarTokenStore(store);
  return { store, accessToken: store.accessToken };
}

async function googleCalendarRequest(url, options = {}) {
  const { accessToken } = await getGoogleCalendarAccessToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  if (response.status === 204) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result?.error?.message || 'Google Calendar request failed.');
    error.status = response.status;
    throw error;
  }
  return result;
}

async function fetchGoogleUser(accessToken) {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const profile = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(profile.error_description || 'Google 계정 정보를 가져오지 못했습니다.');
  return { id: profile.sub, email: profile.email || '', name: profile.name || '', picture: profile.picture || '' };
}

function hasGoogleCalendarSharingScope(store) {
  return String(store?.scope || '').split(/\s+/).includes(GOOGLE_CALENDAR_SCOPE);
}

function requireSelectedGoogleCalendar(store) {
  if (!store?.calendarId) {
    const error = new Error('먼저 동기화할 Google 캘린더를 선택해 주세요.');
    error.status = 400;
    throw error;
  }
  return store.calendarId;
}

function toGoogleCalendarEvent(todo) {
  const event = {
    summary: todo.title,
    description: todo.content || '',
    extendedProperties: { private: { plannerTodoId: String(todo.id), plannerSource: 'neo-planner' } }
  };
  if (todo.allDay || todo.startDate.slice(0, 10) !== todo.endDate.slice(0, 10)) {
    const startDate = todo.startDate.slice(0, 10);
    const end = new Date(`${todo.endDate.slice(0, 10)}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    event.start = { date: startDate };
    event.end = { date: end.toISOString().slice(0, 10) };
  } else {
    event.start = { dateTime: normalizeGoogleCalendarDateTime(todo.startDate), timeZone: GOOGLE_CALENDAR_TIME_ZONE };
    event.end = { dateTime: normalizeGoogleCalendarDateTime(todo.endDate), timeZone: GOOGLE_CALENDAR_TIME_ZONE };
  }
  return event;
}

function normalizeGoogleCalendarDateTime(value) {
  let normalized = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) normalized += ':00';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) normalized += '+09:00';
  return normalized;
}

async function syncTodoToGoogleCalendar(todoId) {
  const todo = await db.getTodoById(String(todoId));
  if (!todo) {
    const error = new Error('동기화할 일정을 찾지 못했습니다.');
    error.status = 404;
    throw error;
  }
  const { store } = await getGoogleCalendarAccessToken();
  const calendarId = requireSelectedGoogleCalendar(store);
  store.eventIds = store.eventIds || {};
  const rememberedId = store.eventIds[String(todo.id)];
  const event = toGoogleCalendarEvent(todo);
  let googleEventId = rememberedId || '';
  let action = 'created';

  if (!googleEventId) {
    const params = new URLSearchParams({
      maxResults: '10',
      singleEvents: 'false',
      privateExtendedProperty: `plannerTodoId=${String(todo.id)}`
    });
    const matches = await googleCalendarRequest(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
    googleEventId = (matches.items || []).find(item => item.status !== 'cancelled')?.id || '';
  }

  if (googleEventId) {
    try {
      await googleCalendarRequest(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`, {
        method: 'PUT', body: JSON.stringify(event)
      });
      action = 'updated';
    } catch (error) {
      if (error.status !== 404) throw error;
      googleEventId = '';
    }
  }
  if (!googleEventId) {
    const created = await googleCalendarRequest(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: 'POST', body: JSON.stringify(event)
    });
    googleEventId = created.id;
    action = 'created';
  }

  store.eventIds[String(todo.id)] = googleEventId;
  store.lastSyncedAt = new Date().toISOString();
  writeGoogleCalendarTokenStore(store);
  return { todoId: String(todo.id), googleEventId, action, calendarId, calendarName: store.calendarName };
}

function getKoreanHolidayModule() {
  if (!koreanHolidayModulePromise) {
    koreanHolidayModulePromise = import('@hyunbinseo/holidays-kr');
  }
  return koreanHolidayModulePromise;
}

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const mobileUserAgentPattern = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

app.get(['/m', '/mobile'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

app.get('/kids_note_gallary', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'public', 'kids-note-gallery.html'));
});

app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const forceDesktop = req.query.desktop === '1';
  const useMobileFrontend = !forceDesktop && mobileUserAgentPattern.test(req.get('user-agent') || '');
  res.sendFile(path.join(__dirname, 'public', useMobileFrontend ? 'mobile.html' : 'index.html'));
});

// Serve static files. Keep the entry HTML fresh so a normal reload always
// picks up the latest cache-busted frontend assets after a deployment.
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (path.extname(filePath) === '.html') {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));

app.get('/api/holidays', async (req, res) => {
  const year = Number.parseInt(req.query.year, 10);

  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    return res.status(400).json({ error: 'A valid year between 1900 and 2200 is required' });
  }

  try {
    const { getHolidayPreset } = await getKoreanHolidayModule();
    const preset = await getHolidayPreset(String(year));
    const holidays = Object.entries(preset)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, names]) => ({
        date,
        names,
        name: names.join(', ')
      }));

    res.json({ country: 'KR', year, available: true, holidays });
  } catch (err) {
    if (err instanceof RangeError) {
      return res.json({ country: 'KR', year, available: false, holidays: [] });
    }

    console.error('Failed to load Korean holidays:', err);
    res.status(500).json({ error: 'Failed to load Korean holidays', details: err.message });
  }
});

app.get('/api/todos', async (req, res) => {
  try {
    const todos = await db.getAllTodos();
    res.json(todos);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve tasks', details: err.message });
  }
});

app.get('/api/todos/:id', async (req, res) => {
  try {
    const todo = await db.getTodoById(req.params.id);
    if (!todo) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(todo);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve task', details: err.message });
  }
});

app.post('/api/todos', async (req, res) => {
  try {
    const { title, startDate } = req.body;
    if (!title || !startDate) {
      return res.status(400).json({ error: 'Title and startDate are required' });
    }
    const newTodo = await db.createTodo(req.body);
    res.status(201).json(newTodo);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task', details: err.message });
  }
});

app.put('/api/todos/:id', async (req, res) => {
  try {
    const updatedTodo = await db.updateTodo(req.params.id, req.body);
    if (!updatedTodo) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(updatedTodo);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task', details: err.message });
  }
});

app.delete('/api/todos/:id', async (req, res) => {
  try {
    const success = await db.deleteTodo(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task', details: err.message });
  }
});

const CATEGORY_COLORS = {
  work: '#6366f1',
  personal: '#06b6d4',
  study: '#10b981',
  general: '#ec4899'
};

const KOREAN_WEEKDAYS = {
  '월요일': 0,
  '화요일': 1,
  '수요일': 2,
  '목요일': 3,
  '금요일': 4,
  '토요일': 5,
  '일요일': 6
};

function formatUtcCalendarDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function addCalendarDays(date, days) {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function formatEpochWithOffset(epochMs, offset) {
  const offsetMatch = offset.match(/^([+-])(\d{2}):(\d{2})$/);
  const direction = offsetMatch[1] === '+' ? 1 : -1;
  const offsetMinutes = direction * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3]));
  const local = new Date(epochMs + offsetMinutes * 60 * 1000);
  return `${local.toISOString().slice(0, 19)}${offset}`;
}

function buildNaturalDateHints(text, baseDate) {
  const baseMatch = String(baseDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!baseMatch) return '';
  const anchor = new Date(Date.UTC(Number(baseMatch[1]), Number(baseMatch[2]) - 1, Number(baseMatch[3])));
  const hints = [];
  const addHint = (expression, date) => {
    const hint = `"${expression}"=${formatUtcCalendarDate(date)}`;
    if (!hints.includes(hint)) hints.push(hint);
  };

  for (const [expression, days] of [['오늘', 0], ['내일', 1], ['모레', 2], ['글피', 3]]) {
    if (text.includes(expression)) addHint(expression, addCalendarDays(anchor, days));
  }

  const mondayIndex = (anchor.getUTCDay() + 6) % 7;
  const monday = addCalendarDays(anchor, -mondayIndex);
  const qualifiedWeekdayRegex = /(이번\s*주|다음\s*주|다다음\s*주)\s*(월요일|화요일|수요일|목요일|금요일|토요일|일요일)/g;
  for (const match of text.matchAll(qualifiedWeekdayRegex)) {
    const qualifier = match[1].replace(/\s/g, '');
    const weekOffset = qualifier === '이번주' ? 0 : qualifier === '다음주' ? 7 : 14;
    addHint(match[0], addCalendarDays(monday, weekOffset + KOREAN_WEEKDAYS[match[2]]));
  }

  return hints.length ? `[DATE_HINT: ${hints.join(', ')}]` : '';
}

function hasNaturalTimeExpression(text) {
  return /(?:오전|오후|아침|점심|저녁|밤|새벽)?\s*(?:[01]?\d|2[0-3])\s*(?::\s*[0-5]\d|시(?:\s*[0-5]?\d\s*분)?)/.test(String(text || ''));
}

function isNaturalSchedulePlaceholder(value) {
  return /^(?:미정|없음|제목\s*없음|일정|스케줄|unknown|untitled|none|null)$/i.test(String(value || '').trim());
}

function deriveNaturalScheduleTitle(text) {
  const title = String(text || '')
    .replace(/\s*\[DATE_HINT:[^\]]+\]/g, ' ')
    .replace(/(?:이번\s*주|다음\s*주|다다음\s*주)\s*(?:월요일|화요일|수요일|목요일|금요일|토요일|일요일)/g, ' ')
    .replace(/(?:오늘|내일|모레|글피|월요일|화요일|수요일|목요일|금요일|토요일|일요일)/g, ' ')
    .replace(/(?:(?:\d{4})\s*[년./-]\s*)?\d{1,2}\s*(?:월|[./-])\s*\d{1,2}\s*(?:일)?/g, ' ')
    .replace(/(?:오전|오후|아침|점심|저녁|밤|새벽)?\s*(?:[01]?\d|2[0-3])\s*(?::\s*[0-5]\d|시(?:\s*[0-5]?\d\s*분)?)/g, ' ')
    .replace(/(?:부터|까지|에)(?=\s|$)/g, ' ')
    .replace(/[\s,./~_-]+/g, ' ')
    .trim();
  return title || '일정';
}

function resolveKidsNoteDateExpressions(text, writtenAt) {
  const baseMatch = String(writtenAt || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!baseMatch) return [];
  const anchor = new Date(Date.UTC(Number(baseMatch[1]), Number(baseMatch[2]) - 1, Number(baseMatch[3])));
  const results = [];
  const seen = new Set();
  const addResult = (expression, date) => {
    const resolvedDate = formatUtcCalendarDate(date);
    const key = `${expression}|${resolvedDate}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ expression, date: resolvedDate });
    }
  };

  for (const [expression, days] of [['오늘', 0], ['내일', 1], ['모레', 2], ['글피', 3]]) {
    if (text.includes(expression)) addResult(expression, addCalendarDays(anchor, days));
  }

  const mondayIndex = (anchor.getUTCDay() + 6) % 7;
  const monday = addCalendarDays(anchor, -mondayIndex);
  const qualifiedWeekdayRegex = /(이번\s*주|다음\s*주|다다음\s*주)\s*(월요일|화요일|수요일|목요일|금요일|토요일|일요일)/g;
  for (const match of text.matchAll(qualifiedWeekdayRegex)) {
    const qualifier = match[1].replace(/\s/g, '');
    const weekOffset = qualifier === '이번주' ? 0 : qualifier === '다음주' ? 7 : 14;
    addResult(match[0], addCalendarDays(monday, weekOffset + KOREAN_WEEKDAYS[match[2]]));
  }

  const explicitDateRegex = /(?:(\d{4})\s*[년./-]\s*)?(\d{1,2})\s*(?:월|[./-])\s*(\d{1,2})\s*(?:일)?/g;
  for (const match of text.matchAll(explicitDateRegex)) {
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    let year = match[1] ? Number(match[1]) : anchor.getUTCFullYear();
    let date = new Date(Date.UTC(year, month - 1, day));
    if (!match[1] && date.getTime() < anchor.getTime() - 31 * 24 * 60 * 60 * 1000) {
      year++;
      date = new Date(Date.UTC(year, month - 1, day));
    }
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) continue;
    addResult(match[0], date);
  }

  return results;
}

function getBaseOffset(baseDate) {
  const explicit = String(baseDate || '').match(/([+-]\d{2}:\d{2})$/);
  if (explicit) return explicit[1];
  const offsetMinutes = -new Date().getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}

function normalizeEventDate(value, fallbackOffset, defaultTime = '09:00') {
  if (typeof value !== 'string') return null;
  let normalized = value.trim().replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) normalized += `T${defaultTime}`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(normalized)) normalized += fallbackOffset;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/.test(normalized)) return null;
  const epochMs = new Date(normalized).getTime();
  return Number.isNaN(epochMs) ? null : formatEpochWithOffset(epochMs, fallbackOffset);
}

function normalizeAllDayBoundary(value, fallbackOffset, isEnd = false) {
  const date = String(value || '').trim().match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (!date) return null;
  const normalized = `${date}T${isEnd ? '23:59:59' : '00:00:00'}${fallbackOffset}`;
  return Number.isNaN(new Date(normalized).getTime()) ? null : normalized;
}

function normalizeExtractedEvent(event, baseDate, options = {}) {
  if (!event || typeof event !== 'object' || typeof event.title !== 'string') return null;
  if (event.status !== 'active') return null;
  const title = event.title.trim();
  if (!title || /^(없음|해당\s*없음|일정\s*없음|이벤트\s*없음|none|null)$/i.test(title)) return null;
  const decisionText = `${event.content || ''} ${event.dateReason || ''}`;
  if (/(최종(?:적으로)?[^.]{0,20}취소|취소(?:되었|됐|됨)|일정[^.]{0,15}취소|예약[^.]{0,15}취소)/.test(decisionText)) return null;
  const fallbackOffset = getBaseOffset(baseDate);
  const allDay = options.forceAllDay === true || event.allDay === true;
  const startDate = allDay
    ? normalizeAllDayBoundary(event.startDate, fallbackOffset)
    : normalizeEventDate(event.startDate, fallbackOffset);
  let endDate = allDay
    ? normalizeAllDayBoundary(event.endDate || event.startDate, fallbackOffset, true)
    : normalizeEventDate(event.endDate, fallbackOffset, '10:00');
  if (!startDate) return null;

  const startTime = new Date(startDate).getTime();
  if (!endDate || new Date(endDate).getTime() <= startTime) {
    endDate = allDay
      ? normalizeAllDayBoundary(event.startDate, fallbackOffset, true)
      : formatEpochWithOffset(startTime + 60 * 60 * 1000, fallbackOffset);
  }

  if (new Date(endDate).getTime() - startTime > 31 * 24 * 60 * 60 * 1000) return null;

  const category = Object.hasOwn(CATEGORY_COLORS, event.category) ? event.category : 'general';
  const priority = ['low', 'medium', 'high'].includes(event.priority) ? event.priority : 'medium';
  const confidence = Math.max(0, Math.min(1, Number(event.confidence) || 0));
  if (confidence < 0.65) return null;

  return {
    title: title.slice(0, 120),
    content: String(event.content || '').trim().slice(0, 600),
    startDate,
    endDate,
    allDay,
    priority,
    category,
    color: CATEGORY_COLORS[category],
    dateReason: String(event.dateReason || '').trim().slice(0, 500),
    evidence: String(event.evidence || '')
      .replace(/\s*\[DATE_HINT:[^\]]+\]/g, '')
      .replace(/\s*\[EVENT_CANDIDATE:\d+\]/g, '')
      .trim()
      .slice(0, 500),
    confidence
  };
}

function deduplicateEvents(events) {
  const unique = new Map();
  for (const event of events) {
    const normalizedTitle = event.title.toLowerCase().replace(/\s+/g, '').replace(/[^\p{L}\p{N}]/gu, '');
    const key = `${event.startDate.slice(0, 16)}|${normalizedTitle}`;
    const existing = unique.get(key);
    if (!existing || event.confidence > existing.confidence) unique.set(key, event);
  }
  return Array.from(unique.values()).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
}

function normalizeCandidateText(value) {
  return String(value || '').toLowerCase().replace(/키즈노트\s*#\d+\s*:/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function normalizeKidsNoteEventIdentity(value) {
  return normalizeCandidateText(value)
    // Remove explicit calendar dates so a period notice and a boundary-day
    // reminder share the same identity (e.g. 여름방학 + 7월27일~7월31일).
    .replace(/\d{1,2}월\d{1,2}일/g, '')
    // These words describe the notice, not the actual calendar event.
    .replace(/(일정|기간|안내|공지|알림|운영|실시|예정|관련|안내문|공문|입니다|이에요|입니다)/g, '');
}

function getKidsNoteDateRange(event) {
  const start = Date.parse(`${String(event.startDate || '').slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${String(event.endDate || '').slice(0, 10)}T00:00:00Z`);
  return { start, end, days: Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.round((end - start) / 86400000)) : 0 };
}

function getKidsNoteEventType(value) {
  const title = String(value || '');
  const match = title.match(/방학|개학|휴원|휴관|운동회|발표회|오리엔테이션|설명회|견학|소풍|체험|검진|검사|예방접종|입학|졸업|상담|수업|생일|파티|공연|관람/);
  return match ? match[0] : '';
}

function isKidsNoteAssessmentEvent(event) {
  return /(?:시험|테스트|평가|\btest\b|\bexam\b)/i.test(`${event?.title || ''} ${event?.content || ''} ${event?.evidence || ''}`);
}

function kidsNoteEventDetailsReferenceTitle(event, title) {
  const normalizedTitle = normalizeCandidateText(title);
  if (normalizedTitle.length < 4) return false;
  return normalizeCandidateText(`${event?.content || ''} ${event?.evidence || ''}`).includes(normalizedTitle);
}

function diceSimilarity(left, right) {
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;
  const counts = new Map();
  for (let i = 0; i < left.length - 1; i++) {
    const pair = left.slice(i, i + 2);
    counts.set(pair, (counts.get(pair) || 0) + 1);
  }
  let overlap = 0;
  for (let i = 0; i < right.length - 1; i++) {
    const pair = right.slice(i, i + 2);
    const count = counts.get(pair) || 0;
    if (count > 0) {
      overlap++;
      counts.set(pair, count - 1);
    }
  }
  return (2 * overlap) / (left.length + right.length - 2);
}

function areSameKidsNoteCandidate(left, right) {
  const leftRange = getKidsNoteDateRange(left);
  const rightRange = getKidsNoteDateRange(right);
  const sameDateRange = left.startDate.slice(0, 10) === right.startDate.slice(0, 10) &&
    left.endDate.slice(0, 10) === right.endDate.slice(0, 10);

  const leftTitle = normalizeCandidateText(left.title);
  const rightTitle = normalizeCandidateText(right.title);
  if (!leftTitle || !rightTitle) return false;

  const leftIdentity = normalizeKidsNoteEventIdentity(left.title);
  const rightIdentity = normalizeKidsNoteEventIdentity(right.title);
  const containedRange = (leftRange.days > 0 || rightRange.days > 0) &&
    ((leftRange.start <= rightRange.start && leftRange.end >= rightRange.end) ||
      (rightRange.start <= leftRange.start && rightRange.end >= leftRange.end));

  // A notice may repeat a multi-day event on its first or last day. Treat it
  // as one candidate only when the normalized event identity is strong and
  // the shorter date range is fully contained by the longer one.
  if (!sameDateRange) {
    if (!containedRange || !leftIdentity || !rightIdentity) return false;
    if (leftIdentity === rightIdentity) return true;
    const identityShorter = leftIdentity.length <= rightIdentity.length ? leftIdentity : rightIdentity;
    const identityLonger = identityShorter === leftIdentity ? rightIdentity : leftIdentity;
    return identityShorter.length >= 3 && identityLonger.includes(identityShorter) &&
      diceSimilarity(leftIdentity, rightIdentity) >= 0.58;
  }

  if (leftTitle === rightTitle) return true;
  if (leftIdentity && rightIdentity && leftIdentity === rightIdentity) return true;

  // A detailed exam notice may use a generic Korean heading while naming the
  // canonical English exam title in its body (for example, Quater Test and
  // 2분기 시험안내). The cross-reference is stronger than title similarity.
  if (isKidsNoteAssessmentEvent(left) && isKidsNoteAssessmentEvent(right) &&
      (kidsNoteEventDetailsReferenceTitle(left, right.title) || kidsNoteEventDetailsReferenceTitle(right, left.title))) {
    return true;
  }

  // A shared event type on the exact same period is a duplicate even when one
  // notice uses a longer explanatory title (for example, an event and its notice).
  const leftEventType = getKidsNoteEventType(left.title);
  const rightEventType = getKidsNoteEventType(right.title);
  if (leftEventType && leftEventType === rightEventType) return true;

  const shorter = leftTitle.length <= rightTitle.length ? leftTitle : rightTitle;
  const longer = shorter === leftTitle ? rightTitle : leftTitle;
  const containmentRatio = shorter.length / longer.length;
  if (shorter.length >= 4 && longer.includes(shorter) && containmentRatio >= 0.5) return true;
  if (diceSimilarity(leftTitle, rightTitle) >= 0.66) return true;

  if (leftIdentity && rightIdentity) {
    const identityShorter = leftIdentity.length <= rightIdentity.length ? leftIdentity : rightIdentity;
    const identityLonger = identityShorter === leftIdentity ? rightIdentity : leftIdentity;
    if (identityShorter.length >= 3 && identityLonger.includes(identityShorter)) return true;
    if (diceSimilarity(leftIdentity, rightIdentity) >= 0.58) return true;
  }

  const leftEvidence = normalizeCandidateText(left.evidence);
  const rightEvidence = normalizeCandidateText(right.evidence);
  if (Math.min(leftEvidence.length, rightEvidence.length) < 12) return false;
  return diceSimilarity(leftEvidence, rightEvidence) >= 0.82;
}

function chooseKidsNoteCanonicalTitle(left, right) {
  const leftReferenced = kidsNoteEventDetailsReferenceTitle(right, left.title);
  const rightReferenced = kidsNoteEventDetailsReferenceTitle(left, right.title);
  if (leftReferenced !== rightReferenced) return leftReferenced ? left.title : right.title;

  const noticePattern = /(안내|공지|알림|안내문|일정|기간|운영|실시|예정)/g;
  const score = title => (String(title || '').match(noticePattern) || []).length * 100 + String(title || '').length;
  return score(left.title) <= score(right.title) ? left.title : right.title;
}

function mergeKidsNoteTextParts(values, maxLength) {
  const parts = [];
  for (const value of values) {
    const text = String(value || '').trim();
    if (!text) continue;
    const normalized = normalizeCandidateText(text);
    if (!normalized) continue;
    const containingIndex = parts.findIndex(part => normalizeCandidateText(part).includes(normalized));
    if (containingIndex >= 0) continue;
    const containedIndexes = parts
      .map((part, index) => normalized.includes(normalizeCandidateText(part)) ? index : -1)
      .filter(index => index >= 0);
    for (const index of containedIndexes.reverse()) parts.splice(index, 1);
    parts.push(text);
  }
  return parts.join('\n').slice(0, maxLength);
}

function mergeKidsNoteDuplicateEvents(left, right) {
  const leftScore = getKidsNoteDateRange(left).days * 5000 + (Number(left.confidence) || 0) * 1000 + String(left.content || '').length + String(left.evidence || '').length;
  const rightScore = getKidsNoteDateRange(right).days * 5000 + (Number(right.confidence) || 0) * 1000 + String(right.content || '').length + String(right.evidence || '').length;
  const base = rightScore > leftScore ? right : left;
  const title = chooseKidsNoteCanonicalTitle(left, right);
  const alternateTitles = [left.title, right.title].filter(candidate => candidate !== title);
  const priorityRank = { low: 0, medium: 1, high: 2 };
  const priority = priorityRank[left.priority] >= priorityRank[right.priority] ? left.priority : right.priority;

  return {
    ...base,
    title,
    content: mergeKidsNoteTextParts([...alternateTitles, left.content, right.content], 1200),
    evidence: mergeKidsNoteTextParts([left.evidence, right.evidence], 1000),
    dateReason: String(left.dateReason || '').length >= String(right.dateReason || '').length ? left.dateReason : right.dateReason,
    confidence: Math.max(Number(left.confidence) || 0, Number(right.confidence) || 0),
    priority
  };
}

function deduplicateKidsNoteEvents(events) {
  const unique = [];
  for (const event of events) {
    const duplicateIndex = unique.findIndex(existing => areSameKidsNoteCandidate(existing, event));
    if (duplicateIndex === -1) {
      unique.push(event);
      continue;
    }
    unique[duplicateIndex] = mergeKidsNoteDuplicateEvents(unique[duplicateIndex], event);
  }
  return unique.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getKidsNoteReports(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.results)) return payload.results;
  if (payload.data) return getKidsNoteReports(payload.data);
  return [];
}

function getKidsNoteNextCollectionUrl(nextValue, endpoint) {
  if (!nextValue) return '';
  const text = String(nextValue).trim();
  if (!text) return '';
  if (/^(https?:)?\/\//i.test(text) || text.startsWith('/')) {
    try {
      const url = new URL(text, endpoint);
      if (/^https?:$/.test(url.protocol) && url.pathname.includes('/api/')) return url.href;
    } catch {}
  }
  const url = new URL(endpoint);
  if (url.searchParams.has('cursor')) url.searchParams.set('cursor', text);
  else if (url.searchParams.has('page')) url.searchParams.set('page', text);
  else url.searchParams.set('cursor', text);
  return url.href;
}

function parseRequestCookies(req) {
  return String(req.headers.cookie || '').split(';').reduce((cookies, part) => {
    const separator = part.indexOf('=');
    if (separator < 1) return cookies;
    cookies[part.slice(0, separator).trim()] = decodeURIComponent(part.slice(separator + 1).trim());
    return cookies;
  }, {});
}

function mergeSetCookies(existingCookie, setCookieHeaders = []) {
  const values = new Map();
  String(existingCookie || '').split(';').forEach(part => {
    const separator = part.indexOf('=');
    if (separator > 0) values.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  });
  for (const header of setCookieHeaders || []) {
    const pair = String(header).split(';', 1)[0];
    const separator = pair.indexOf('=');
    if (separator > 0) values.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
  }
  return Array.from(values, ([name, value]) => `${name}=${value}`).join('; ');
}

function kidsNoteWebRequest({ method = 'GET', requestPath, body = '', cookie = '' }) {
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: 'www.kidsnote.com',
      port: 443,
      path: requestPath,
      method,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        Origin: 'https://www.kidsnote.com',
        Referer: 'https://www.kidsnote.com/login',
        Cookie: cookie,
        'User-Agent': 'Mozilla/5.0 NEO-Planner-KidsNote-Connector/1.0'
      },
      timeout: 15000
    }, response => {
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size <= 2 * 1024 * 1024) chunks.push(chunk);
      });
      response.on('end', () => resolve({
        status: response.statusCode || 0,
        location: response.headers.location || '',
        setCookies: response.headers['set-cookie'] || [],
        body: Buffer.concat(chunks).toString('utf8')
      }));
    });
    request.on('timeout', () => request.destroy(new Error('키즈노트 로그인 시간이 초과되었습니다.')));
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

async function loginToKidsNote(username, password) {
  const loginPage = await kidsNoteWebRequest({ requestPath: '/login' });
  let cookie = mergeSetCookies('', loginPage.setCookies);
  const body = new URLSearchParams({ username, password, remember_me: 'on' }).toString();
  const result = await kidsNoteWebRequest({ method: 'POST', requestPath: '/kr/login', body, cookie });
  cookie = mergeSetCookies(cookie, result.setCookies);
  const redirectedAwayFromLogin = result.status >= 300 && result.status < 400 && result.location && !/\/login(?:\?|$)/.test(result.location);
  if (!redirectedAwayFromLogin || !cookie) {
    const error = new Error('키즈노트 아이디 또는 비밀번호가 올바르지 않거나 추가 인증이 필요합니다.');
    error.status = 401;
    throw error;
  }
  return cookie;
}

async function loginToKidsNoteBrowser(username, password) {
  const puppeteer = require('puppeteer-core');
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_EXECUTABLE,
      headless: true,

      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      timeout: 30000
    });
    const page = await browser.newPage();
    let childId = '';
    let enrollment = '';
    page.on('request', request => {
      const match = request.url().match(/\/children\/(\d+)\/reports(?:\/|\?)/);
      if (!match) return;
      childId = childId || match[1];
      const headers = request.headers();
      enrollment = enrollment || headers['x-enrollment'] || '';
    });

    await page.goto('https://www.kidsnote.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('input[name="username"]', { timeout: 15000 });
    await page.type('input[name="username"]', username);
    await page.type('input[name="password"]', password);
    const loginOutcome = Promise.race([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null),
      page.waitForFunction(() => {
        const loginPath = /^\/(?:[a-z]{2}\/)?login\/?$/.test(location.pathname);
        const invalidInput = Boolean(document.querySelector('input[aria-invalid="true"]'));
        return !loginPath || invalidInput;
      }, { timeout: 20000 }).catch(() => null)
    ]);
    await page.click('button[type="submit"]');
    await loginOutcome;

    if (/\/(?:[a-z]{2}\/)?login(?:\/|\?|$)/.test(page.url())) {
      const error = new Error('키즈노트 아이디 또는 비밀번호가 올바르지 않거나 추가 인증이 필요합니다.');
      error.status = 401;
      throw error;
    }

    await page.goto('https://www.kidsnote.com/service/report', { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!childId) {
      try {
        await page.waitForFunction(() => performance.getEntriesByType('resource').some(entry => /\/children\/\d+\/reports/.test(entry.name)), { timeout: 20000 });
      } catch {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    const cookies = await page.cookies();
    const cookie = cookies.map(item => `${item.name}=${item.value}`).join('; ');
    if (!cookie || !childId) {
      const error = new Error('로그인은 되었지만 자녀 알림장 정보를 찾지 못했습니다. 키즈노트에서 자녀 연결 상태를 확인해 주세요.');
      error.status = 422;
      throw error;
    }
    return { cookie, childId, enrollment };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

function getKidsNoteEncryptionKey() {
  if (!KIDSNOTE_SESSION_SECRET || KIDSNOTE_SESSION_SECRET.length < 32) {
    const error = new Error('키즈노트 세션 암호화 키가 설정되지 않았습니다.');
    error.status = 503;
    throw error;
  }
  return crypto.createHash('sha256').update(KIDSNOTE_SESSION_SECRET).digest();
}

function encryptKidsNoteCookie(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKidsNoteEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function decryptKidsNoteCookie(value) {
  const [ivValue, tagValue, ciphertextValue] = String(value || '').split('.');
  if (!ivValue || !tagValue || !ciphertextValue) throw new Error('저장된 키즈노트 세션이 손상되었습니다.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKidsNoteEncryptionKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, 'base64url')), decipher.final()]).toString('utf8');
}

function readKidsNoteSessions() {
  try {
    const sessions = JSON.parse(fs.readFileSync(KIDSNOTE_SESSION_FILE, 'utf8'));
    return sessions && typeof sessions === 'object' ? sessions : {};
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Failed to read KidsNote sessions:', error.message);
    return {};
  }
}

function writeKidsNoteSessions(sessions) {
  fs.mkdirSync(path.dirname(KIDSNOTE_SESSION_FILE), { recursive: true });
  const temporaryPath = `${KIDSNOTE_SESSION_FILE}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(sessions, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporaryPath, KIDSNOTE_SESSION_FILE);
}

function getKidsNoteSessionCookieAttributes(req) {
  const forwardedProtocol = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const isHttps = req.secure || forwardedProtocol === 'https';
  return `HttpOnly; SameSite=${isHttps ? 'None' : 'Lax'}; ${isHttps ? 'Secure; ' : ''}Path=/`;
}

function saveKidsNoteSession(childId, cookie, enrollment = '') {
  const sessions = readKidsNoteSessions();
  const now = Date.now();
  for (const [key, session] of Object.entries(sessions)) {
    if (!session?.expiresAt || session.expiresAt <= now) delete sessions[key];
  }
  const token = crypto.randomBytes(32).toString('base64url');
  sessions[token] = {
    childId: String(childId),
    encryptedCookie: encryptKidsNoteCookie(JSON.stringify({ cookie, enrollment })),
    createdAt: now,
    expiresAt: now + KIDSNOTE_SESSION_TTL_MS
  };
  writeKidsNoteSessions(sessions);
  return token;
}

function getSavedKidsNoteSession(req) {
  const token = parseRequestCookies(req)[KIDSNOTE_SESSION_COOKIE];
  if (!token) return null;
  const sessions = readKidsNoteSessions();
  const session = sessions[token];
  if (!session || session.expiresAt <= Date.now()) {
    if (session) {
      delete sessions[token];
      writeKidsNoteSessions(sessions);
    }
    return null;
  }
  try {
    const decrypted = decryptKidsNoteCookie(session.encryptedCookie);
    let credentials;
    try {
      credentials = JSON.parse(decrypted);
    } catch {
      credentials = { cookie: decrypted, enrollment: '' };
    }
    return { token, childId: session.childId, cookie: credentials.cookie, enrollment: credentials.enrollment || '', expiresAt: session.expiresAt };
  } catch (error) {
    console.error('Failed to decrypt KidsNote session:', error.message);
    return null;
  }
}

function clearSavedKidsNoteSession(req, res) {
  const token = parseRequestCookies(req)[KIDSNOTE_SESSION_COOKIE];
  if (token) {
    const sessions = readKidsNoteSessions();
    delete sessions[token];
    writeKidsNoteSessions(sessions);
  }
  res.setHeader('Set-Cookie', `${KIDSNOTE_SESSION_COOKIE}=; ${getKidsNoteSessionCookieAttributes(req)}; Max-Age=0`);
}

function formatKidsNoteReport(report, index) {
  if (!report || typeof report !== 'object') return null;
  const content = stripHtml(report.content || report.body || report.text || report.description);
  if (!content) return null;
  const writtenAt = String(report.date_written || report.created_at || report.created || report.date || '').trim();
  const title = stripHtml(report.title || report.subject || report.name || '알림장');
  const sourceId = String(report.id || report.uuid || index + 1);
  const dateHints = buildNaturalDateHints(content, writtenAt);
  return {
    sourceId,
    writtenAt,
    title,
    content: content.slice(0, 5000),
    text: `[KIDSNOTE_REPORT id=${sourceId} written_at=${writtenAt || 'unknown'}]\n제목: ${title}\n내용: ${content.slice(0, 5000)}${dateHints ? `\n${dateHints}` : ''}`
  };
}

function correctKidsNoteRelativeDate(event, reportsById) {
  const report = reportsById.get(String(event?.sourceId || ''));
  const writtenDateMatch = String(report?.writtenAt || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!event || !writtenDateMatch) return event;

  const reason = `${event.dateReason || ''}\n${event.evidence || ''}`;
  const relativeMatch = reason.match(/글피|모레|내일|오늘/);
  if (!relativeMatch) return event;
  const dayOffsets = { 오늘: 0, 내일: 1, 모레: 2, 글피: 3 };
  const anchor = new Date(Date.UTC(
    Number(writtenDateMatch[1]), Number(writtenDateMatch[2]) - 1, Number(writtenDateMatch[3])
  ));
  const resolvedDate = formatUtcCalendarDate(addCalendarDays(anchor, dayOffsets[relativeMatch[0]]));
  const startDateMatch = String(event.startDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!startDateMatch) return event;

  const emittedStart = new Date(Date.UTC(
    Number(startDateMatch[1]), Number(startDateMatch[2]) - 1, Number(startDateMatch[3])
  ));
  const resolvedStart = new Date(`${resolvedDate}T00:00:00Z`);
  const shiftDays = Math.round((resolvedStart.getTime() - emittedStart.getTime()) / (24 * 60 * 60 * 1000));
  const shiftDatePart = value => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
    if (!match) return value;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return `${formatUtcCalendarDate(addCalendarDays(date, shiftDays))}${match[4]}`;
  };

  return {
    ...event,
    startDate: shiftDatePart(event.startDate),
    endDate: shiftDatePart(event.endDate),
    dateReason: `${String(event.dateReason || '').trim()} (공지 작성일 ${report.writtenAt} 기준 ${relativeMatch[0]}=${resolvedDate})`.trim()
  };
}

async function fetchKidsNoteReports(childId, cookie, options = {}) {
  if (!/^\d+$/.test(String(childId || ''))) {
    const error = new Error('자녀 ID는 숫자만 입력할 수 있습니다.');
    error.status = 400;
    throw error;
  }
  if (!cookie || typeof cookie !== 'string' || /[\r\n]/.test(cookie)) {
    const error = new Error('유효한 키즈노트 Cookie가 필요합니다.');
    error.status = 400;
    throw error;
  }

  const reports = [];
  const reportsEndpoint = `https://www.kidsnote.com/api/v1_2/children/${childId}/reports/?page_size=100`;
  let nextUrl = reportsEndpoint;
  const maxPages = Math.max(1, Math.min(20, Number(options.maxPages) || 20));
  for (let page = 0; nextUrl && page < maxPages; page++) {
    const url = new URL(nextUrl, 'https://www.kidsnote.com');
    const allowedHosts = new Set(['www.kidsnote.com', 'kapi.kidsnote.com']);
    if (url.protocol === 'http:' && allowedHosts.has(url.hostname)) url.protocol = 'https:';
    const expectedReportsPath = new RegExp(`/children/${String(childId)}/reports(?:/|$)`);
    if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname) || !expectedReportsPath.test(url.pathname)) {
      console.error('Rejected KidsNote pagination URL:', url.origin, url.pathname);
      throw new Error('키즈노트 응답의 다음 페이지 주소가 올바르지 않습니다.');
    }
    let response;
    let lastFetchError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await fetch(url, {
          headers: {
            Cookie: cookie.trim(),
            Accept: 'application/json',
            ...(options.enrollment ? { 'X-ENROLLMENT': options.enrollment } : {}),
            'User-Agent': 'NEO-Planner-KidsNote-Importer/1.0'
          },
          redirect: 'manual',
          signal: AbortSignal.timeout(15000)
        });
        break;
      } catch (error) {
        lastFetchError = error;
        if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }
    if (!response) throw new Error(`키즈노트 서버 연결에 실패했습니다: ${lastFetchError?.message || 'network error'}`);
    if (response.status === 401 || response.status === 403 || response.status === 302) {
      const error = new Error('키즈노트 로그인이 만료되었거나 Cookie가 올바르지 않습니다.');
      error.status = 401;
      throw error;
    }
    if (!response.ok) {
      const error = new Error(`키즈노트 조회에 실패했습니다. (${response.status})`);
      error.status = 502;
      throw error;
    }
    const payload = await response.json();
    reports.push(...getKidsNoteReports(payload));
    if (typeof payload.next === 'string' && payload.next) {
      const nextValue = payload.next.trim();
      if (!nextValue.includes('/children/')) {
        const cursorSource = new URL(nextValue, reportsEndpoint);
        const cursor = cursorSource.pathname.replace(/^\/+/, '');
        if (!cursor) throw new Error('키즈노트 다음 페이지 커서가 올바르지 않습니다.');
        const cursorUrl = new URL(reportsEndpoint);
        cursorUrl.searchParams.set('cursor', cursor);
        nextUrl = cursorUrl.toString();
      } else {
        nextUrl = nextValue;
      }
    } else {
      nextUrl = null;
    }
  }
  return reports;
}

function chunkKidsNoteReports(reports, maxChars = 5000, maxChunks = 4) {
  const chunks = [];
  let current = '';
  for (const report of reports) {
    const candidate = current ? `${current}\n\n${report.text}` : report.text;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = report.text;
      if (chunks.length >= maxChunks) break;
    } else {
      current = candidate;
    }
  }
  if (current && chunks.length < maxChunks) chunks.push(current);
  return chunks;
}

function normalizeKidsNoteEvents(rawEvents, referenceDate) {
  return deduplicateKidsNoteEvents(rawEvents
    .map(event => {
      const normalized = normalizeExtractedEvent({
        ...event,
        status: 'active',
        evidence: `키즈노트 #${String(event.sourceId || '?')}: ${String(event.evidence || '')}`
      }, referenceDate);
      if (!normalized || normalized.allDay) return normalized;
      const startMs = new Date(normalized.startDate).getTime();
      const endMs = new Date(normalized.endDate).getTime();
      const endLooksLikeDayBoundary = /T23:59(?::59)?/.test(normalized.endDate);
      if (endLooksLikeDayBoundary && endMs - startMs > 60 * 60 * 1000) {
        normalized.endDate = formatEpochWithOffset(startMs + 60 * 60 * 1000, getBaseOffset(referenceDate));
      }
      return normalized;
    })
    .filter(Boolean));
}

const KIDSNOTE_ACTION_KEYWORD_REGEX = /(준비물|지참|제출|신청|마감|납부|입금|행사|견학|소풍|체험|방학|개학|휴원|휴관|수업|상담|검사|검진|예방접종|입학|졸업|발표회|운동회|오리엔테이션|설명회|참석|등원|하원|예약|방문|촬영|생일|파티|공연|관람|모임)/i;

function buildKidsNoteFallbackEvents(formattedReports, referenceDate) {
  const fallbackOffset = getBaseOffset(referenceDate);
  const events = [];
  for (const report of formattedReports) {
    const segments = `${report.title}\n${report.content}`
      .split(/\n+|(?<=[.!?。！？])\s+/)
      .map(segment => segment.trim())
      .filter(Boolean);

    for (const segment of segments) {
      if (!KIDSNOTE_ACTION_KEYWORD_REGEX.test(segment)) continue;
      const dateMatches = resolveKidsNoteDateExpressions(segment, report.writtenAt);
      if (!dateMatches.length) continue;

      for (const match of dateMatches.slice(0, 3)) {
        const compactSegment = segment.replace(/\s+/g, ' ').slice(0, 140);
        const titleSource = report.title && report.title !== '알림장' ? report.title : compactSegment;
        events.push({
          title: titleSource.slice(0, 60),
          content: compactSegment,
          startDate: `${match.date}T00:00:00${fallbackOffset}`,
          endDate: `${match.date}T23:59:59${fallbackOffset}`,
          allDay: true,

          priority: /(마감|까지|제출|신청|납부|입금|준비물|지참)/.test(segment) ? 'high' : 'medium',
          category: /(수업|검사|검진|입학|졸업|발표회|운동회|오리엔테이션|설명회)/.test(segment) ? 'study' : 'general',
          dateReason: `키즈노트 본문의 "${match.expression}" 표현을 공지 작성일 ${report.writtenAt || 'unknown'} 기준 ${match.date}로 해석`,
          evidence: segment,
          sourceId: report.sourceId,
          confidence: 0.78
        });
      }
    }
  }
  return events;
}

async function parseKidsNoteReports(reports, referenceDate, options = {}) {
  const scheduleNoticePattern = /(오늘|내일|모레|이번\s*주|다음\s*주|다다음\s*주|월요일|화요일|수요일|목요일|금요일|토요일|일요일|\d{1,2}\s*월\s*\d{1,2}\s*일|\d{1,2}[./-]\d{1,2}|까지|마감|제출|신청|준비물|지참|행사|견학|소풍|방학|개학|휴원|수업|상담|검사|예방접종|입학|졸업|발표회|운동회)/i;
  const formatted = reports
    .map(formatKidsNoteReport)
    .filter(Boolean)
    .filter(report => scheduleNoticePattern.test(`${report.title}\n${report.content}`))
    .slice(0, 40);
  const chunks = chunkKidsNoteReports(formatted);
  if (!chunks.length) return { events: [], reportCount: reports.length, analyzedCount: 0 };
  const reportsById = new Map(formatted.map(report => [String(report.sourceId), report]));
  const fallbackEvents = buildKidsNoteFallbackEvents(formatted, referenceDate);
  const analyzedCount = chunks.reduce((count, chunk) => count + (chunk.match(/\[KIDSNOTE_REPORT\b/g) || []).length, 0);

  const schema = {
    type: 'object',
    properties: {
      events: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' }, content: { type: 'string' }, startDate: { type: 'string' },
            endDate: { type: 'string' }, allDay: { type: 'boolean' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            category: { type: 'string', enum: ['work', 'personal', 'study', 'general'] },
            dateReason: { type: 'string' }, evidence: { type: 'string' }, sourceId: { type: 'string' }, confidence: { type: 'number' }
          },
          required: ['title', 'content', 'startDate', 'endDate', 'allDay', 'priority', 'category', 'dateReason', 'evidence', 'sourceId', 'confidence'],
          additionalProperties: false
        }
      }
    },
    required: ['events'],
    additionalProperties: false
  };
  const prompt = `You extract actionable family calendar events from Korean KidsNote notices.
Current reference time: ${referenceDate}

RULES:
1. Extract every explicit event date, attendance date, submission deadline, payment deadline, reservation, class, trip, school vacation, school reopening (개학), holiday, or preparation deadline.
2. The report's written_at is the publication date, not the event date. Never create an event on written_at unless the content explicitly says 오늘 and written_at is available.
3. Resolve relative Korean dates from that report's written_at. Infer a missing year from written_at using the nearest future occurrence that fits the notice context.
4. If a date is clear but no time is stated, create an all-day event with 00:00:00 through 23:59:59. Never invent a time. If a start time is stated but no end time or duration is stated, set endDate exactly one hour after startDate.
5. A date range is one continuous event, not separate daily events.
6. Split distinct obligations: for example, a consent-form deadline and a later field trip are two events.
7. Omit past activity summaries, photo descriptions, menus without a date, vague announcements, and anything whose date cannot be resolved confidently.
8. Preserve concrete preparation items, place, fee, and audience in content. Use a concise event title.
9. startDate/endDate must be ISO 8601 with timezone offset ${getBaseOffset(referenceDate)}.
10. category is study for school/class/assignment, personal for health/family, otherwise general. Deadlines are normally high priority.
11. dateReason must explain in Korean which notice expression produced the date. evidence must quote a short relevant Korean excerpt. Copy the enclosing KIDSNOTE_REPORT id into sourceId.
12. confidence is 0 to 1; use below 0.65 when ambiguous.
13. DATE_HINT is calculated deterministically from that report's written_at and is authoritative. Copy its resolved date exactly for the matching relative expression.
14. Before returning JSON, perform a duplicate pass across every event you plan to emit. One real-world occurrence must be one event only: consolidate repeated notices, paraphrases, and a title plus its explanatory notice into a single candidate.
15. Never emit two candidates for the same date range unless they are clearly different activities or obligations. Use a short canonical title that names the event itself, excluding notice words such as 안내, 공지, 일정, 기간, 운영, or 실시.
16. When a generic exam notice heading names the same exam title in its body on the same date, merge them. Keep the canonical exam name as title and preserve the notice heading, evaluation scope, preparation items, and other details in content.

Return JSON only.`;

  const rawEvents = [];
  let failedChunks = 0;
  let processedReports = 0;
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    processedReports += (chunk.match(/\[KIDSNOTE_REPORT\b/g) || []).length;
    try {
      const response = await fetch(`${LLM_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: [{ role: 'system', content: prompt }, { role: 'user', content: chunk }],
          temperature: 0,
          max_tokens: 4096,
          response_format: { type: 'json_schema', json_schema: { name: 'kidsnote_schedule_events', strict: true, schema } }
        })
      });
      if (!response.ok) throw new Error(`AI 응답 오류 ${response.status}`);
      const data = await response.json();
      const content = String(data.choices?.[0]?.message?.content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(content);
      rawEvents.push(...(parsed.events || []).map(event => correctKidsNoteRelativeDate(event, reportsById)));
    } catch (error) {
      failedChunks++;
      console.warn(`KidsNote AI chunk failed (${failedChunks}/${chunks.length}):`, error.message);
    }
    if (typeof options.onProgress === 'function') {
      const progressEvents = rawEvents.length
        ? normalizeKidsNoteEvents(rawEvents, referenceDate)
        : normalizeKidsNoteEvents(fallbackEvents, referenceDate);
      options.onProgress({
        events: progressEvents,
        reportCount: reports.length,
        analyzedCount: processedReports,
        totalAnalyzedCount: analyzedCount,
        completedChunks: chunkIndex + 1,
        totalChunks: chunks.length
      });
    }
  }

  if (failedChunks === chunks.length && !fallbackEvents.length) throw new Error('AI가 키즈노트 일정 결과를 완성하지 못했습니다. 다시 시도해 주세요.');

  const events = normalizeKidsNoteEvents([...rawEvents, ...fallbackEvents], referenceDate);
  return { events, reportCount: reports.length, analyzedCount };
}

function normalizeKidsNoteImportStartDate(value) {
  const date = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function filterKidsNoteEventsByImportStartDate(result, importStartDate) {
  if (!importStartDate || !result || !Array.isArray(result.events)) return result;
  return {
    ...result,
    events: result.events.filter(event => String(event?.startDate || '').slice(0, 10) >= importStartDate)
  };
}

app.post('/api/kidsnote/import', async (req, res) => {
  try {
    const { mode = 'json', childId, cookie, data, baseDate, importStartDate: rawImportStartDate } = req.body || {};
    const importStartDate = normalizeKidsNoteImportStartDate(rawImportStartDate);
    if (rawImportStartDate && !importStartDate) return res.status(400).json({ error: '가져오기 시작일 형식이 올바르지 않습니다.' });
    let reports;
    if (mode === 'saved_session') {
      const session = getSavedKidsNoteSession(req);
      if (!session) return res.status(401).json({ error: '저장된 키즈노트 로그인이 없거나 만료되었습니다.' });
      reports = await fetchKidsNoteReports(session.childId, session.cookie, { enrollment: session.enrollment, maxPages: 1 });
    } else if (mode === 'session') {
      reports = await fetchKidsNoteReports(childId, cookie);
    } else {
      reports = getKidsNoteReports(data);
    }
    if (!reports.length) return res.status(400).json({ error: '분석할 키즈노트 알림장 데이터가 없습니다.' });
    const result = await parseKidsNoteReports(reports, baseDate || new Date().toISOString());
    res.json(filterKidsNoteEventsByImportStartDate(result, importStartDate));
  } catch (err) {
    console.error('KidsNote import error:', err.message);
    res.status(err.status || 500).json({ error: err.message || '키즈노트 데이터를 처리하지 못했습니다.' });
  }
});

app.post('/api/kidsnote/import/start', (req, res) => {
  const session = getSavedKidsNoteSession(req);
  if (!session) return res.status(401).json({ error: '저장된 키즈노트 로그인이 없거나 만료되었습니다.' });
  const rawImportStartDate = req.body?.importStartDate;
  const importStartDate = normalizeKidsNoteImportStartDate(rawImportStartDate);
  if (rawImportStartDate && !importStartDate) return res.status(400).json({ error: '가져오기 시작일 형식이 올바르지 않습니다.' });

  const jobId = crypto.randomBytes(24).toString('base64url');
  const job = {
    ownerToken: session.token,
    status: 'processing',
    createdAt: Date.now(),
    result: null,
    progress: { completedChunks: 0, totalChunks: 0 },
    importStartDate,
    error: ''
  };
  kidsNoteAnalysisJobs.set(jobId, job);

  setImmediate(async () => {
    try {
      const reports = await fetchKidsNoteReports(session.childId, session.cookie, {
        enrollment: session.enrollment,
        maxPages: 1
      });
      if (!reports.length) throw new Error('분석할 키즈노트 알림장 데이터가 없습니다.');
      job.result = await parseKidsNoteReports(reports, req.body?.baseDate || new Date().toISOString(), {
        onProgress: partialResult => {
          job.result = filterKidsNoteEventsByImportStartDate(partialResult, importStartDate);
          job.progress = {
            completedChunks: partialResult.completedChunks,
            totalChunks: partialResult.totalChunks
          };
        }
      });
      job.result = filterKidsNoteEventsByImportStartDate(job.result, importStartDate);
      job.status = 'completed';
    } catch (error) {
      console.error('KidsNote background analysis error:', error.message);
      job.error = error.message || '키즈노트 데이터를 분석하지 못했습니다.';
      job.status = 'failed';
    }
  });

  res.status(202).json({ jobId, status: job.status });
});

app.get('/api/kidsnote/import/jobs/:jobId', (req, res) => {
  const session = getSavedKidsNoteSession(req);
  const job = kidsNoteAnalysisJobs.get(req.params.jobId);
  if (!session || !job || job.ownerToken !== session.token) {
    return res.status(404).json({ error: '분석 작업을 찾을 수 없습니다.' });
  }
  if (job.status === 'completed') {
    kidsNoteAnalysisJobs.delete(req.params.jobId);
    return res.json({ status: 'completed', result: job.result });
  }
  if (job.status === 'failed') {
    kidsNoteAnalysisJobs.delete(req.params.jobId);
    return res.status(500).json({ status: 'failed', error: job.error });
  }
  res.json({ status: 'processing', result: job.result, progress: job.progress });
});

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [jobId, job] of kidsNoteAnalysisJobs) {
    if (job.createdAt < cutoff) kidsNoteAnalysisJobs.delete(jobId);
  }
}, 5 * 60 * 1000).unref();

function readTimeTreeStore() {
  try { return JSON.parse(fs.readFileSync(TIMETREE_SESSION_FILE, 'utf8')); }
  catch (error) { return { sessions: {}, syncedTodos: {} }; }
}

function writeTimeTreeStore(store) {
  fs.mkdirSync(path.dirname(TIMETREE_SESSION_FILE), { recursive: true });
  const temporaryPath = `${TIMETREE_SESSION_FILE}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(store, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporaryPath, TIMETREE_SESSION_FILE);
}

function getTimeTreeSession(req) {
  const token = parseRequestCookies(req)[TIMETREE_SESSION_COOKIE];
  const store = readTimeTreeStore();
  const saved = store.sessions?.[token];
  if (!saved || saved.expiresAt <= Date.now()) return null;
  try { return { token, cookies: JSON.parse(decryptKidsNoteCookie(saved.encryptedCookies)), expiresAt: saved.expiresAt }; }
  catch { return null; }
}

async function launchTimeTreeBrowser() {
  const puppeteer = require('puppeteer-core');
  return puppeteer.launch({ executablePath: CHROMIUM_EXECUTABLE, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
}

async function loginToTimeTree(email, password) {
  const browser = await launchTimeTreeBrowser();
  try {
    const page = await browser.newPage();
    await page.goto('https://timetreeapp.com/signin', { waitUntil: 'networkidle2', timeout: 45000 });
    const emailInput = await page.$('input[type="email"], input[autocomplete="username"], input[name="email"]');
    const passwordInput = await page.$('input[type="password"], input[autocomplete="current-password"], input[name="password"]');
    if (!emailInput || !passwordInput) throw new Error('타임트리 로그인 입력란을 찾지 못했습니다.');
    await emailInput.click({ clickCount: 3 });
    await emailInput.type(email);
    await passwordInput.click({ clickCount: 3 });
    await passwordInput.type(password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(() => null),
      page.click('button[type="submit"]')
    ]);
    if (/\/signin(?:\?|$)/.test(page.url())) throw new Error('타임트리 로그인에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.');
    return page.cookies('https://timetreeapp.com');
  } finally { await browser.close(); }
}

async function setTimeTreeAllDay(page, allDay) {
  const knownControl = await page.$('[data-test-id="allday-checkbox"]');
  if (knownControl) {
    const checked = await knownControl.evaluate(el => el.getAttribute('aria-checked') === 'true' || el.checked === true);
    if (checked !== allDay) {
      const nestedCheckbox = await knownControl.$('input[type="checkbox"]');
      if (nestedCheckbox) await nestedCheckbox.click();
      else await knownControl.click();
      await page.waitForFunction(expected => {
        const control = document.querySelector('[data-test-id="allday-checkbox"]');
        return control && (control.getAttribute('aria-checked') === String(expected));
      }, { timeout: 5000 }, allDay).catch(() => null);
    }
  }
  const controls = await page.$$('input[type="checkbox"], [role="switch"], button[aria-checked]');
  const candidates = await Promise.all(controls.map(async control => ({
    control,
    data: await control.evaluate(el => {
      const labelledBy = el.getAttribute('aria-labelledby');
      const labelledText = labelledBy
        ? labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ')
        : '';
      const nearby = el.closest('label, [role="switch"], [class*="switch"], [class*="checkbox"]') || el.parentElement;
      return {
        checked: el.checked === true || el.getAttribute('aria-checked') === 'true',
        label: [
          el.name,
          el.id,
          el.getAttribute('aria-label'),
          labelledText,
          nearby?.textContent
        ].filter(Boolean).join(' ').trim()
      };
    })
  })));
  const allDayControl = candidates
    .map(entry => ({ ...entry, score: /all.?day|종일|終日/i.test(entry.data.label) ? 100 : 0 }))
    .sort((left, right) => right.score - left.score)[0];

  if (!knownControl && allDayControl?.score > 0 && allDayControl.data.checked !== allDay) {
    await allDayControl.control.click();
  }

  if (!allDay) {
    await page.waitForFunction(
      () => Boolean(document.querySelector('input[name="dateTime.startTime"], [data-test-id="start-time-picker"]')) &&
        Boolean(document.querySelector('input[name="dateTime.endTime"], [data-test-id="end-time-picker"]')),
      { timeout: 10000 }
    ).catch(() => null);
    const hasTimeInputs = await page.evaluate(() =>
      Boolean(document.querySelector('input[name="dateTime.startTime"], [data-test-id="start-time-picker"]')) &&
      Boolean(document.querySelector('input[name="dateTime.endTime"], [data-test-id="end-time-picker"]'))
    );
    if (!hasTimeInputs) {
      throw new Error('타임트리의 종일 설정을 해제하거나 시간 입력란을 찾지 못했습니다.');
    }
  }
}

async function setTimeTreeInputValue(entry, value, valueKind = 'plain') {
  if (!entry) return;
  const formattedValue = await entry.input.evaluate((el, { rawValue, kind }) => {
    let next = rawValue;
    if (kind === 'date') {
      const [year, month, day] = rawValue.split('-').map(Number);
      next = new Intl.DateTimeFormat(navigator.language, {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
      }).format(new Date(year, month - 1, day));
    } else if (kind === 'time') {
      const [hour, minute] = rawValue.split(':').map(Number);
      next = new Intl.DateTimeFormat(navigator.language, {
        hour: 'numeric', minute: '2-digit'
      }).format(new Date(2000, 0, 1, hour, minute));
    }
    if (kind === 'time' && el.type === 'text') return next;
    const prototype = el instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(el, next);
    else el.value = next;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }, { rawValue: value, kind: valueKind });
  if (valueKind === 'time' && entry.data?.type === 'text') {
    await entry.input.click({ clickCount: 3 });
    await entry.input.press('Backspace');
    await entry.input.type(formattedValue);
    await entry.input.press('Enter').catch(() => {});
    await entry.input.press('Tab').catch(() => {});
  }
}

function getTimeTreeSeoulParts(value) {
  const raw = String(value || '');
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(parsed).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
  }
  return { date: raw.slice(0, 10), time: raw.slice(11, 16) };
}

async function syncTodoToTimeTree(todo, cookies) {
  const browser = await launchTimeTreeBrowser();
  try {
    const page = await browser.newPage();
    await page.setCookie(...cookies);
    const startParts = getTimeTreeSeoulParts(todo.startDate);
    const endParts = getTimeTreeSeoulParts(todo.endDate);
    const date = startParts.date;
    const url = `https://timetreeapp.com/calendars/${encodeURIComponent(TIMETREE_CALENDAR_ID)}/events/new?date=${date}&referer=menu`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (/\/signin(?:\?|$)/.test(page.url())) throw new Error('타임트리 로그인이 만료되었습니다. 다시 연결해 주세요.');
    try {
      await page.waitForFunction(
      () => Boolean(document.querySelector('input, textarea, [contenteditable="true"], [role="textbox"]')),
        { timeout: 45000 }
      );
    } catch (error) {
      const pageTitle = await page.title().catch(() => '');
      throw new Error(`타임트리 일정 입력 화면을 불러오지 못했습니다. (${page.url()} ${pageTitle})`);
    }

    const fields = await page.$$('input, textarea, [contenteditable="true"], [role="textbox"]');
    const metadata = await Promise.all(fields.map(async input => ({ input, data: await input.evaluate(el => ({
      type: el.type || el.tagName.toLowerCase(),
      role: el.getAttribute('role') || '',
      name: el.name || '',
      id: el.id || '',
      className: typeof el.className === 'string' ? el.className : '',
      placeholder: el.placeholder || '',
      ariaLabel: el.getAttribute('aria-label') || ''
    })) })));
    const titleField = metadata
      .filter(({ data }) => !['date', 'time', 'hidden', 'checkbox', 'radio'].includes(data.type))
      .map(entry => {
        const label = `${entry.data.name} ${entry.data.id} ${entry.data.className} ${entry.data.placeholder} ${entry.data.ariaLabel}`.toLowerCase();
        let score = 0;
      if (/title|event.?name|event.?title|제목|일정명/.test(label)) score += 100;
      if (entry.data.role === 'textbox' && !/date|time|location|url|내용|설명|메모/i.test(label)) score += 80;
        if (/content|description|memo|note|내용|설명|메모|备注/.test(label)) score -= 100;
        if (/required/.test(label)) score += 5;
        return { ...entry, score };
      })
      .filter(entry => entry.score >= 0)
      .sort((a, b) => b.score - a.score)[0];
    if (!titleField) throw new Error('타임트리 일정 제목 입력란을 찾지 못했습니다.');
    await titleField.input.click({ clickCount: 3 });
    await titleField.input.type(todo.title);

    if (todo.content) {
      const contentFields = await page.$$('textarea, input[type="text"], [contenteditable="true"], [role="textbox"]');
      const contentMetadata = await Promise.all(contentFields.map(async input => ({ input, data: await input.evaluate(el => ({
        tag: el.tagName.toLowerCase(),
        name: el.getAttribute('name') || '',
        id: el.id || '',
        className: typeof el.className === 'string' ? el.className : '',
        placeholder: el.getAttribute('placeholder') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        contentEditable: el.getAttribute('contenteditable') || ''
      })) })));
      const contentField = contentMetadata
        .map(entry => {
          const label = `${entry.data.name} ${entry.data.id} ${entry.data.className} ${entry.data.placeholder} ${entry.data.ariaLabel}`.toLowerCase();
          let score = 0;
          if (entry.data.tag === 'textarea' || entry.data.contentEditable === 'true') score += 20;
          if (/content|description|memo|note|notes|내용|설명|메모|비고/.test(label)) score += 100;
          if (/title|event.?name|제목/.test(label)) score -= 100;
          return { ...entry, score };
        })
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score)[0];
      if (contentField) {
        await contentField.input.click({ clickCount: 3 });
        await contentField.input.type(todo.content);
      }
    }
    await setTimeTreeAllDay(page, todo.allDay === true);
    const currentFields = await page.$$('input, textarea, [contenteditable="true"], [role="textbox"]');
    const currentMetadata = await Promise.all(currentFields.map(async input => ({ input, data: await input.evaluate(el => ({
      type: el.type || el.tagName.toLowerCase(),
      name: el.getAttribute('name') || '',
      testId: el.getAttribute('data-test-id') || ''
    })) })));
    const findField = (name, testId, nativeType) => currentMetadata.find(({ data }) =>
      data.name === name || data.testId === testId || data.type === nativeType
    );
    const startDateInput = findField('dateTime.startDate', 'start-date-picker', 'date');
    const endDateInput = findField('dateTime.endDate', 'end-date-picker', 'date');
    const startTimeInput = findField('dateTime.startTime', 'start-time-picker', 'time');
    const endTimeInput = findField('dateTime.endTime', 'end-time-picker', 'time');
    if (!startDateInput || !endDateInput) throw new Error('타임트리 날짜 입력란을 찾지 못했습니다.');
    await setTimeTreeInputValue(startDateInput, startParts.date, startDateInput.data.type === 'text' ? 'date' : 'plain');
    await setTimeTreeInputValue(endDateInput, endParts.date, endDateInput.data.type === 'text' ? 'date' : 'plain');
    if (!todo.allDay) {
      await setTimeTreeInputValue(startTimeInput, startParts.time, startTimeInput.data.type === 'text' ? 'time' : 'plain');
      await setTimeTreeInputValue(endTimeInput, endParts.time, endTimeInput.data.type === 'text' ? 'time' : 'plain');
    }
    const saveButton = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(button => /^(저장|Save|등록)$/.test(button.textContent.trim())));
    const saveElement = saveButton.asElement();
    if (!saveElement) throw new Error('타임트리 저장 버튼을 찾지 못했습니다.');
    const saveResponses = [];
    const onSaveResponse = response => {
      const request = response.request();
      if (['POST', 'PUT', 'PATCH'].includes(request.method())) {
        saveResponses.push({ url: response.url(), status: response.status() });
      }
    };
    page.on('response', onSaveResponse);
    await saveElement.click();
    await new Promise(resolve => setTimeout(resolve, 3000));
    page.off('response', onSaveResponse);
    const saveState = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      return {
        text,
        explicitFailure: /저장할 수 없|저장에 실패|오류가 발생|실패했습니다|unable to save|failed to save/i.test(text)
      };
    });
    if (saveState.explicitFailure) throw new Error('타임트리에서 일정 저장에 실패했습니다.');
    const successfulSaveResponse = saveResponses.find(item =>
      item.status >= 200 && item.status < 300 && /event|calendar/i.test(item.url)
    );
    if (!successfulSaveResponse) {
      throw new Error('타임트리 일정 저장 요청의 성공 응답을 확인하지 못했습니다. 다시 시도해 주세요.');
    }
    return { url: page.url(), syncedAt: new Date().toISOString() };
  } finally { await browser.close(); }
}

app.get('/api/google-calendar/status', async (req, res) => {
  let store = readGoogleCalendarTokenStore();
  let connected = false;
  let reconnectRequired = false;
  if (store?.refreshToken) {
    try {
      const tokenResult = await getGoogleCalendarAccessToken();
      store = tokenResult.store;
      connected = true;
      if (!store.user) {
        store.user = await fetchGoogleUser(tokenResult.accessToken);
        writeGoogleCalendarTokenStore(store);
      }
    } catch (error) {
      reconnectRequired = true;
      console.warn('Google Calendar connection needs authorization:', error.message);
    }
  }
  res.json({
    configured: isGoogleCalendarConfigured(), connected, reconnectRequired,
    sharingReady: Boolean(connected && hasGoogleCalendarSharingScope(store)),
    calendarId: store?.calendarId || null,
    calendarName: store?.calendarName || GOOGLE_CALENDAR_FALLBACK_NAME,
    calendarColor: store?.calendarColor || '#4285f4',
    account: connected ? (store?.user || null) : null,
    lastSyncedAt: store?.lastSyncedAt || null,
    syncedTodoIds: connected ? Object.keys(store?.eventIds || {}) : []
  });
});

app.get('/api/google-calendar/android-config', (req, res) => {
  const config = getGoogleCalendarConfig();
  res.json({ configured: isGoogleCalendarConfigured(), serverClientId: config.clientId || null });
});

app.post('/api/google-calendar/android-auth', async (req, res) => {
  if (!isGoogleCalendarConfigured()) return res.status(503).json({ error: 'Google Calendar is not configured.' });
  const code = String(req.body?.code || '').trim();
  if (!code || code.length > 4096) return res.status(400).json({ error: 'Google authorization code is required.' });
  try {
    const config = getGoogleCalendarConfig();
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: config.clientId, client_secret: config.clientSecret, grant_type: 'authorization_code'
      })
    });
    const token = await response.json();
    if (!response.ok || !token.refresh_token) throw new Error(token.error_description || 'Google refresh token was not returned.');
    const user = await fetchGoogleUser(token.access_token);
    writeGoogleCalendarTokenStore({
      refreshToken: token.refresh_token,
      accessToken: token.access_token,
      expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
      scope: token.scope || getGoogleOAuthScopes().join(' '),
      user,
      calendarId: '',
      calendarName: '',
      calendarColor: '#4285f4',
      eventIds: {}
    });
    res.json({ connected: true, account: user });
  } catch (error) {
    console.error('Android Google authorization failed:', error.message);
    res.status(502).json({ error: error.message });
  }
});

app.get('/api/google-calendar/connect', (req, res) => {
  if (!isGoogleCalendarConfigured()) return res.redirect('/?googleCalendar=not-configured');
  const config = getGoogleCalendarConfig();
  const state = crypto.randomBytes(32).toString('base64url');
  const returnPath = req.query.mobile === '1' || /^\/m(?:obile)?(?:\/|$)/.test(req.get('referer') || '') ? '/m' : '/';
  res.setHeader('Set-Cookie', [
    `${GOOGLE_CALENDAR_STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    `${GOOGLE_CALENDAR_RETURN_COOKIE}=${encodeURIComponent(returnPath)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
  ]);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: getGoogleOAuthScopes().join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

app.get('/api/google-calendar/callback', async (req, res) => {
  const cookies = parseRequestCookies(req);
  let returnPath = cookies[GOOGLE_CALENDAR_RETURN_COOKIE] || '/';
  if (!/^\/(?:m|mobile)?$/.test(returnPath)) returnPath = '/';
  const finish = result => {
    clearGoogleCalendarStateCookie(res);
    res.redirect(`${returnPath}?googleCalendar=${encodeURIComponent(result)}`);
  };
  if (!isGoogleCalendarConfigured() || !req.query.code || !req.query.state || req.query.state !== cookies[GOOGLE_CALENDAR_STATE_COOKIE]) {
    return finish('failed');
  }
  try {
    const config = getGoogleCalendarConfig();
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(req.query.code), client_id: config.clientId, client_secret: config.clientSecret,
        redirect_uri: config.redirectUri, grant_type: 'authorization_code'
      })
    });
    const token = await response.json();
    if (!response.ok || !token.refresh_token) throw new Error(token.error_description || 'Google refresh token was not returned.');
    const user = await fetchGoogleUser(token.access_token);
    writeGoogleCalendarTokenStore({
      refreshToken: token.refresh_token,
      accessToken: token.access_token,
      expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
      scope: token.scope || getGoogleOAuthScopes().join(' '),
      user,
      calendarId: '',
      calendarName: '',
      calendarColor: '#4285f4',
      eventIds: {}
    });
    return finish('connected');
  } catch (error) {
    console.error('Google OAuth callback failed:', error.message);
    return finish('failed');
  }
});

app.post('/api/google-calendar/sync', async (req, res) => {
  res.status(410).json({ error: '전체 동기화는 사용하지 않습니다. 일정 상세에서 필요한 일정만 동기화해 주세요.' });
});

app.post('/api/google-calendar/sync/:todoId', async (req, res) => {
  try {
    const result = await (googleCalendarSyncQueue = googleCalendarSyncQueue
      .catch(() => undefined)
      .then(() => syncTodoToGoogleCalendar(req.params.todoId)));
    res.json(result);
  } catch (error) { res.status(error.status || 502).json({ error: error.message }); }
});

app.get('/api/google-calendar/calendars', async (req, res) => {
  try {
    const { store } = await getGoogleCalendarAccessToken();
    const result = await googleCalendarRequest('https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer');
    const calendars = (result.items || [])
      .filter(calendar => ['owner', 'writer'].includes(calendar.accessRole))
      .map(calendar => ({ id: calendar.id, name: calendar.summaryOverride || calendar.summary || GOOGLE_CALENDAR_FALLBACK_NAME, primary: Boolean(calendar.primary), color: calendar.backgroundColor || '#4285f4' }));
    res.json({ calendars, selectedCalendarId: store.calendarId || null });
  } catch (error) { res.status(error.status || 502).json({ error: error.message }); }
});

app.post('/api/google-calendar/calendar', async (req, res) => {
  try {
    const calendarId = String(req.body?.calendarId || '').trim();
    if (!calendarId) return res.status(400).json({ error: '동기화할 캘린더를 선택해 주세요.' });
    const { store } = await getGoogleCalendarAccessToken();
    const result = await googleCalendarRequest('https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer');
    const calendar = (result.items || []).find(item => item.id === calendarId && ['owner', 'writer'].includes(item.accessRole));
    if (!calendar) return res.status(400).json({ error: '일정을 쓸 수 있는 캘린더가 아닙니다.' });
    if (store.calendarId !== calendar.id) store.eventIds = {};
    store.calendarId = calendar.id;
    store.calendarName = calendar.summaryOverride || calendar.summary || GOOGLE_CALENDAR_FALLBACK_NAME;
    store.calendarColor = calendar.backgroundColor || '#4285f4';
    writeGoogleCalendarTokenStore(store);
    res.json({ calendarId: store.calendarId, calendarName: store.calendarName, calendarColor: store.calendarColor });
  } catch (error) { res.status(error.status || 502).json({ error: error.message }); }
});

app.post('/api/google-calendar/disconnect', async (req, res) => {
  const store = readGoogleCalendarTokenStore();
  if (store?.refreshToken) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(store.refreshToken)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }).catch(() => undefined);
  }
  fs.rmSync(GOOGLE_CALENDAR_TOKEN_FILE, { force: true });
  res.json({ connected: false });
});

app.get('/api/timetree/status', (req, res) => {
  const session = getTimeTreeSession(req);
  const store = readTimeTreeStore();
  res.json({ connected: Boolean(session), syncedTodoIds: Object.keys(store.syncedTodos || {}) });
});

app.post('/api/timetree/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: '이메일과 비밀번호를 입력해 주세요.' });
    const cookies = await loginToTimeTree(String(email).trim(), String(password));
    const store = readTimeTreeStore();
    const token = crypto.randomBytes(32).toString('base64url');
    store.sessions ||= {};
    store.sessions[token] = { encryptedCookies: encryptKidsNoteCookie(JSON.stringify(cookies)), expiresAt: Date.now() + TIMETREE_SESSION_TTL_MS };
    writeTimeTreeStore(store);
    res.setHeader('Set-Cookie', `${TIMETREE_SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${TIMETREE_SESSION_TTL_MS / 1000}`);
    res.json({ connected: true });
  } catch (error) { res.status(error.status || 401).json({ error: error.message }); }
});

app.post('/api/timetree/sync/:id', async (req, res) => {
  const session = getTimeTreeSession(req);
  if (!session) return res.status(401).json({ error: '메뉴에서 타임트리를 먼저 연결해 주세요.' });
  const force = req.query.force === '1';
  const todo = await db.getTodoById(req.params.id);
  if (!todo) return res.status(404).json({ error: '일정을 찾지 못했습니다.' });
  const store = readTimeTreeStore();
  if (store.syncedTodos?.[todo.id] && !force) return res.json({ alreadySynced: true, ...store.syncedTodos[todo.id] });
  try {
    const result = await (timeTreeSyncQueue = timeTreeSyncQueue.catch(() => {}).then(() => Promise.race([
      syncTodoToTimeTree(todo, session.cookies),
      new Promise((_, reject) => setTimeout(() => reject(new Error('타임트리 동기화가 30초 안에 끝나지 않았습니다.')), 30000))
    ])));
    const latest = readTimeTreeStore();
    latest.syncedTodos ||= {};
    latest.syncedTodos[todo.id] = result;
    writeTimeTreeStore(latest);
    res.json({ synced: true, ...result });
  } catch (error) { res.status(502).json({ error: error.message }); }
});

app.delete('/api/timetree/session', (req, res) => {
  const token = parseRequestCookies(req)[TIMETREE_SESSION_COOKIE];
  const store = readTimeTreeStore();
  if (token && store.sessions) delete store.sessions[token];
  writeTimeTreeStore(store);
  res.setHeader('Set-Cookie', `${TIMETREE_SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.json({ connected: false });
});

app.get('/api/kidsnote/session', (req, res) => {
  const session = getSavedKidsNoteSession(req);
  res.json(session
    ? { connected: true, childId: session.childId, expiresAt: new Date(session.expiresAt).toISOString() }
    : { connected: false });
});

app.post('/api/kidsnote/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || typeof username !== 'string' || username.length > 100 ||
      !password || typeof password !== 'string' || password.length > 200) {
    return res.status(400).json({ error: '키즈노트 아이디와 비밀번호를 확인해 주세요.' });
  }
  try {
    const login = await loginToKidsNoteBrowser(username.trim(), password);
    await fetchKidsNoteReports(login.childId, login.cookie, { maxPages: 1, enrollment: login.enrollment });
    const token = saveKidsNoteSession(login.childId, login.cookie, login.enrollment);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Set-Cookie', `${KIDSNOTE_SESSION_COOKIE}=${encodeURIComponent(token)}; ${getKidsNoteSessionCookieAttributes(req)}; Max-Age=${Math.floor(KIDSNOTE_SESSION_TTL_MS / 1000)}`);
    res.json({ connected: true, childId: login.childId, expiresAt: new Date(Date.now() + KIDSNOTE_SESSION_TTL_MS).toISOString() });
  } catch (error) {
    console.error('KidsNote login error:', error.message);
    res.status(error.status || 502).json({ error: error.message || '키즈노트 로그인에 실패했습니다.' });
  }
});

app.delete('/api/kidsnote/session', (req, res) => {
  clearSavedKidsNoteSession(req, res);
  res.json({ connected: false });
});

function collectKidsNoteGalleryImages(value, date, output, depth = 0, keyHint = '') {
  if (value == null || depth > 6) return;
  if (Array.isArray(value)) {
    value.forEach(item => collectKidsNoteGalleryImages(item, date, output, depth + 1, keyHint));
    return;
  }
  if (typeof value !== 'object') return;

  const imageKeyPattern = /(image|photo|picture|attachment|original|large|url)/i;
  const preferredKeys = ['original_url', 'original', 'large_url', 'url_big', 'image_url', 'file_url', 'url'];
  for (const key of preferredKeys) {
    const candidate = value[key];
    if (typeof candidate !== 'string' || !/^https:\/\//i.test(candidate)) continue;
    if (!imageKeyPattern.test(`${keyHint} ${key}`)) continue;
    const normalized = candidate.replace(/&amp;/g, '&');
    if (!output.has(normalized)) output.set(normalized, { url: normalized, date });
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (typeof nested === 'string' && /^https:\/\//i.test(nested) && imageKeyPattern.test(key)) {
      const normalized = nested.replace(/&amp;/g, '&');
      if (!output.has(normalized)) output.set(normalized, { url: normalized, date });
    } else if (nested && typeof nested === 'object') {
      collectKidsNoteGalleryImages(nested, date, output, depth + 1, key);
    }
  }
}

app.get('/api/kidsnote/gallery', async (req, res) => {
  const session = getSavedKidsNoteSession(req);
  if (!session) return res.status(401).json({ error: '키즈노트 로그인이 필요합니다.' });
  const year = String(req.query.year || '');
  if (!/^20\d{2}$/.test(year)) return res.status(400).json({ error: '조회할 연도를 확인해 주세요.' });
  try {
    const reports = await fetchKidsNoteReports(session.childId, session.cookie, {
      enrollment: session.enrollment,
      maxPages: 20
    });
    const images = new Map();
    for (const report of reports) {
      const date = String(report?.date_written || report?.created || report?.created_at || '').slice(0, 10);
      if (!date.startsWith(year)) continue;
      collectKidsNoteGalleryImages(report, date, images);
    }
    const photos = [...images.values()].sort((a, b) => b.date.localeCompare(a.date));
    res.setHeader('Cache-Control', 'no-store');
    res.json({ year, count: photos.length, photos });
  } catch (error) {
    console.error('KidsNote gallery error:', error.message);
    res.status(error.status || 502).json({ error: error.message || '사진 목록을 불러오지 못했습니다.' });
  }
});

// Parse a user's direct natural-language schedule request into reviewable events.
app.post('/api/todos/parse-natural-language', async (req, res) => {
  const { text, baseDate } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Schedule text is required' });
  }
  if (text.length > 4000) {
    return res.status(400).json({ error: 'Schedule text is too long' });
  }

  const referenceDate = baseDate || new Date().toISOString();
  const dateHints = buildNaturalDateHints(text, referenceDate);
  const naturalSchedulePrompt = `You convert a user's Korean natural-language request into calendar events for review.
Current reference time: ${referenceDate}

RULES:
1. The user is directly asking to create schedules, so no conversational confirmation is required.
2. Extract every independent event when the input contains multiple schedules.
3. Resolve 오늘, 내일, 모레, 이번 주, 다음 주 from the current reference time.
4. DATE_HINT is calculated by the application and is authoritative. Copy its date exactly and never recalculate it.
5. Convert 오전/오후 correctly. Noon is 12:00 and midnight is 00:00.
6. If the date is not specified, default to the date of the current reference time.
7. If an event has no explicit schedule time, it is an all-day event. Set allDay to true, startDate to 00:00:00, and endDate to 23:59:59 on that date.
8. If an event has an explicit schedule time, set allDay to false. If duration or end time is absent, set endDate to one hour after startDate.
9. startDate and endDate must be ISO 8601 with the same timezone offset as the reference time.
10. category: work for company/business, study for classes/exams/assignments, personal for health/family/friends/leisure, otherwise general.
11. priority is medium unless urgency, a hard deadline, or explicit importance supports high. Casual plans may be low.
12. dateReason must be a short Korean explanation of how the date and time were resolved, or that the event was classified as all-day because no time was stated.
13. confidence is 0 to 1. Use below 0.65 for ambiguity and omit that event.
14. A date range such as "월요일부터 금요일까지", "7월 20일~24일", or "3일 동안" is one period event. Return one event whose startDate is the first day and endDate is the last day. Never split it into one event per day.
15. title must contain the actual activity from the user's text. Never return placeholders such as "미정", "일정", "없음", or "Untitled" when an activity like PT, 회의, 축구, 치료, or 약속 is present.

Return one JSON object containing events and clarification. Return no prose or markdown.`;

  const naturalScheduleSchema = {
    type: 'object',
    properties: {
      events: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            allDay: { type: 'boolean' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            category: { type: 'string', enum: ['work', 'personal', 'study', 'general'] },
            dateReason: { type: 'string' },
            confidence: { type: 'number' }
          },
          required: ['title', 'content', 'startDate', 'endDate', 'allDay', 'priority', 'category', 'dateReason', 'confidence'],
          additionalProperties: false
        }
      },
      clarification: { type: 'string' }
    },
    required: ['events', 'clarification'],
    additionalProperties: false
  };

  try {
    const response = await fetch(`${LLM_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: naturalSchedulePrompt },
          { role: 'user', content: `${text.trim()}${dateHints ? `\n${dateHints}` : ''}` }
        ],
        temperature: 0,
        max_tokens: 1200,
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'natural_schedule_events', strict: true, schema: naturalScheduleSchema }
        }
      })
    });

    if (!response.ok) {
      const details = await response.text();
      console.error(`Natural language LLM error ${response.status}: ${details}`);
      return res.status(502).json({ error: 'Failed to analyze schedule text' });
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content.trim());
    const fallbackTitle = deriveNaturalScheduleTitle(text.trim());
    const hasTimeExpression = hasNaturalTimeExpression(text);
    const normalizedEvents = (parsed.events || [])
      .map((event, index) => normalizeExtractedEvent({
        ...event,
        title: isNaturalSchedulePlaceholder(event.title) ? fallbackTitle : event.title,
        content: isNaturalSchedulePlaceholder(event.content) ? '' : event.content,
        status: 'active',
        candidateId: index + 1,
        evidence: text.trim()
      }, referenceDate, { forceAllDay: !hasTimeExpression }))
      .filter(Boolean);

    res.json({
      events: deduplicateEvents(normalizedEvents),
      clarification: String(parsed.clarification || '').trim()
    });
  } catch (err) {
    console.error('Natural language schedule parse error:', err);
    res.status(500).json({ error: 'Failed to parse natural-language schedule', details: err.message });
  }
});


app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Serve frontend SPA index.html for all other routes
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize DB and start server
async function startServer() {
  try {
    await db.initDb();
    console.log('Database initialized successfully.');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) startServer();

module.exports = {
  app,
  areSameKidsNoteCandidate,
  deduplicateKidsNoteEvents
};
