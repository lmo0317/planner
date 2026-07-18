require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const LLM_BASE_URL = (process.env.LLM_BASE_URL || 'http://localhost:8081').replace(/\/$/, '');
const LLM_MODEL = process.env.LLM_MODEL || 'gemma-4-e4b-it-q4km';

let koreanHolidayModulePromise;

function getKoreanHolidayModule() {
  if (!koreanHolidayModulePromise) {
    koreanHolidayModulePromise = import('@hyunbinseo/holidays-kr');
  }
  return koreanHolidayModulePromise;
}

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
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

const SCHEDULE_KEYWORD_REGEX = /(만나|보자|볼까|약속|회의|미팅|회식|식사|밥\s*먹|먹자|점심|저녁|예약|모임|가자|갈까|영화|공연|행사|결혼식|병원|치료|상담|수업|학원|시험|면접|출근|출발|방문|여행|마감|제출|발표|피티|pt|오픈클래스|하기로|하자|어때|될까|가능)/i;
const TEMPORAL_EXPRESSION_REGEX = /(오늘|내일|모레|글피|이번\s*주|다음\s*주|다다음\s*주|월요일|화요일|수요일|목요일|금요일|토요일|일요일|오전|오후|아침|점심|저녁|\d{1,2}\s*[:시]\s*\d{0,2}|\d{1,2}\s*월|\d{1,2}\s*[\/.-]\s*\d{1,2})/i;

// Keep schedule-related messages together with enough surrounding conversation
// to distinguish proposals, confirmations, changes, and cancellations.
function filterScheduleContext(rawText) {
  if (!rawText) return '';
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const matchedIndices = new Set();
  const messageBody = line => line.includes(' : ') ? line.split(' : ').slice(1).join(' : ') : line;

  for (let i = 0; i < lines.length; i++) {
    const nearby = lines
      .slice(Math.max(0, i - 2), Math.min(lines.length, i + 3))
      .map(messageBody)
      .join(' ');
    if (SCHEDULE_KEYWORD_REGEX.test(messageBody(lines[i])) && TEMPORAL_EXPRESSION_REGEX.test(nearby)) {
      const start = Math.max(0, i - 2);
      const end = Math.min(lines.length - 1, i + 3);
      for (let j = start; j <= end; j++) {
        matchedIndices.add(j);
      }
    }
  }

  const sortedIndices = Array.from(matchedIndices).sort((a, b) => a - b);
  const filteredLines = [];
  let previousIndex = -2;
  for (const idx of sortedIndices) {
    if (idx > previousIndex + 1) filteredLines.push('--- CONTEXT GAP ---');
    filteredLines.push(lines[idx]);
    previousIndex = idx;
  }
  return filteredLines.join('\n');
}

function splitScheduleContext(filteredText, maxChars = 4500) {
  if (!filteredText.trim()) return [];
  const groups = filteredText.split('\n--- CONTEXT GAP ---\n');
  const chunks = [];
  let current = '';

  for (const group of groups) {
    const candidate = current ? `${current}\n--- CONTEXT GAP ---\n${group}` : group;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = group;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

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

// LLMs can explain weekday math correctly while still emitting the wrong date.
// Resolve common relative Korean dates deterministically and provide authoritative hints.
function annotateRelativeDates(text) {
  const timestampRegex = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(?:오전|오후)\s*\d{1,2}:\d{2},/;
  let candidateNumber = 0;
  return text.split('\n').map(line => {
    const match = line.match(timestampRegex);
    if (!match) {
      return SCHEDULE_KEYWORD_REGEX.test(line) && TEMPORAL_EXPRESSION_REGEX.test(line)
        ? `${line} [EVENT_CANDIDATE:${++candidateNumber}]`
        : line;
    }

    const anchor = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    const hints = [];
    const addHint = (expression, date) => {
      const hint = `"${expression}"=${formatUtcCalendarDate(date)}`;
      if (!hints.includes(hint)) hints.push(hint);
    };

    const relativeDays = [
      ['오늘', 0],
      ['내일', 1],
      ['모레', 2],
      ['글피', 3]
    ];
    for (const [expression, days] of relativeDays) {
      if (line.includes(expression)) addHint(expression, addCalendarDays(anchor, days));
    }

    const mondayIndex = (anchor.getUTCDay() + 6) % 7;
    const monday = addCalendarDays(anchor, -mondayIndex);
    const qualifiedWeekdayRegex = /(이번\s*주|다음\s*주|다다음\s*주)\s*(월요일|화요일|수요일|목요일|금요일|토요일|일요일)/g;
    for (const weekdayMatch of line.matchAll(qualifiedWeekdayRegex)) {
      const weekOffset = weekdayMatch[1].replace(/\s/g, '') === '이번주' ? 0 :
        weekdayMatch[1].replace(/\s/g, '') === '다음주' ? 7 : 14;
      addHint(weekdayMatch[0], addCalendarDays(monday, weekOffset + KOREAN_WEEKDAYS[weekdayMatch[2]]));
    }

    // An unqualified weekday means the nearest occurrence on or after the message date.
    if (!qualifiedWeekdayRegex.test(line)) {
      for (const [weekday, targetIndex] of Object.entries(KOREAN_WEEKDAYS)) {
        if (!line.includes(weekday)) continue;
        const daysAhead = (targetIndex - mondayIndex + 7) % 7;
        addHint(weekday, addCalendarDays(anchor, daysAhead));
      }
    }

    const abbreviatedWeekdayRegex = /(?:^|[\s:])(월|화|수|목|금|토|일)(?=\s*(?:아침|오전|오후|저녁|\d))/g;
    const abbreviatedWeekdays = { 월: 0, 화: 1, 수: 2, 목: 3, 금: 4, 토: 5, 일: 6 };
    for (const abbreviatedMatch of line.matchAll(abbreviatedWeekdayRegex)) {
      const targetIndex = abbreviatedWeekdays[abbreviatedMatch[1]];
      const daysAhead = (targetIndex - mondayIndex + 7) % 7;
      addHint(abbreviatedMatch[1], addCalendarDays(anchor, daysAhead));
    }

    let annotated = hints.length ? `${line} [DATE_HINT: ${hints.join(', ')}]` : line;
    const messageBody = line.includes(' : ') ? line.split(' : ').slice(1).join(' : ') : line;
    if (SCHEDULE_KEYWORD_REGEX.test(messageBody) && TEMPORAL_EXPRESSION_REGEX.test(messageBody)) {
      annotated += ` [EVENT_CANDIDATE:${++candidateNumber}]`;
    }
    return annotated;
  }).join('\n');
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

function formatKidsNoteReport(report, index) {
  if (!report || typeof report !== 'object') return null;
  const content = stripHtml(report.content || report.body || report.text || report.description);
  if (!content) return null;
  const writtenAt = String(report.date_written || report.created_at || report.created || report.date || '').trim();
  const title = stripHtml(report.title || report.subject || report.name || '알림장');
  const sourceId = String(report.id || report.uuid || index + 1);
  return {
    sourceId,
    writtenAt,
    title,
    content: content.slice(0, 12000),
    text: `[KIDSNOTE_REPORT id=${sourceId} written_at=${writtenAt || 'unknown'}]\n제목: ${title}\n내용: ${content.slice(0, 12000)}`
  };
}

async function fetchKidsNoteReports(childId, cookie) {
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
  let nextUrl = `https://www.kidsnote.com/api/v1_2/children/${childId}/reports/?page_size=100`;
  for (let page = 0; nextUrl && page < 20; page++) {
    const url = new URL(nextUrl, 'https://www.kidsnote.com');
    if (url.protocol !== 'https:' || url.hostname !== 'www.kidsnote.com' || !url.pathname.startsWith('/api/v1_2/children/')) {
      throw new Error('키즈노트 응답의 다음 페이지 주소가 올바르지 않습니다.');
    }
    const response = await fetch(url, {
      headers: {
        Cookie: cookie.trim(),
        Accept: 'application/json',
        'User-Agent': 'NEO-Planner-KidsNote-Importer/1.0'
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(15000)
    });
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
    nextUrl = typeof payload.next === 'string' && payload.next ? payload.next : null;
  }
  return reports;
}

function chunkKidsNoteReports(reports, maxChars = 9000, maxChunks = 12) {
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

async function parseKidsNoteReports(reports, referenceDate) {
  const formatted = reports.map(formatKidsNoteReport).filter(Boolean);
  const chunks = chunkKidsNoteReports(formatted);
  if (!chunks.length) return { events: [], reportCount: reports.length, analyzedCount: 0 };

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
1. Extract every explicit event date, attendance date, submission deadline, payment deadline, reservation, class, trip, holiday, or preparation deadline.
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

Return JSON only.`;

  const rawEvents = [];
  for (const chunk of chunks) {
    const response = await fetch(`${LLM_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [{ role: 'system', content: prompt }, { role: 'user', content: chunk }],
        temperature: 0,
        max_tokens: 2200,
        response_format: { type: 'json_schema', json_schema: { name: 'kidsnote_schedule_events', strict: true, schema } }
      })
    });
    if (!response.ok) throw new Error(`AI 일정 분석에 실패했습니다. (${response.status})`);
    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content.trim());
    rawEvents.push(...(parsed.events || []));
  }

  const events = deduplicateEvents(rawEvents
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
  return { events, reportCount: reports.length, analyzedCount: formatted.length };
}

app.post('/api/kidsnote/import', async (req, res) => {
  try {
    const { mode = 'json', childId, cookie, data, baseDate } = req.body || {};
    const reports = mode === 'session'
      ? await fetchKidsNoteReports(childId, cookie)
      : getKidsNoteReports(data);
    if (!reports.length) return res.status(400).json({ error: '분석할 키즈노트 알림장 데이터가 없습니다.' });
    const result = await parseKidsNoteReports(reports, baseDate || new Date().toISOString());
    res.json(result);
  } catch (err) {
    console.error('KidsNote import error:', err.message);
    res.status(err.status || 500).json({ error: err.message || '키즈노트 데이터를 처리하지 못했습니다.' });
  }
});

// Chat Parsing Route using remote/local LLM Server (llama-server) with Smart Chunking
app.post('/api/todos/parse-chat', async (req, res) => {
  const { chatText, baseDate } = req.body;
  if (!chatText) {
    return res.status(400).json({ error: 'Chat text is required' });
  }

  // Pre-filter to reduce token size and bypass CPU limits
  console.log(`Original chat size: ${chatText.length} chars.`);
  const filteredText = filterScheduleContext(chatText);
  console.log(`Pre-filtered chat size: ${filteredText.length} chars.`);

  const chunks = splitScheduleContext(filteredText);

  console.log(`Split chat transcript into ${chunks.length} chunks for LLM processing.`);

  const referenceDate = baseDate || new Date().toISOString();
  const systemPrompt = `You extract calendar-worthy scheduled events from Korean KakaoTalk exports.
Current reference time: ${referenceDate}

DATE RESOLUTION (highest priority):
1. A KakaoTalk message normally begins with its own timestamp, for example "2026년 7월 17일 오전 10:00, 이름 : ...". Relative expressions in that message such as 오늘, 내일, 모레, 이번 주, 다음 주 MUST be resolved from that MESSAGE timestamp, never from the current reference time.
2. Use the current reference time only when the relevant message has no timestamp.
3. A week runs Monday through Sunday. "이번 주 토요일" means Saturday in the message timestamp's week. "다음 주 수요일" means Wednesday in the immediately following Monday-Sunday week.
4. Convert 오전/오후 correctly to 24-hour time. Noon is 12:00 and midnight is 00:00.
5. Never invent a date or time. If the date cannot be resolved confidently from an explicit date, a relative expression plus message timestamp, or unambiguous nearby context, omit the event.
6. When the scheduled date is clear but no schedule time is mentioned, create an all-day event: set allDay to true, startDate to 00:00:00, and endDate to 23:59:59 on that date. A KakaoTalk message header timestamp is not a schedule time. Never invent 09:00 or another arbitrary time.
7. When a schedule time is mentioned, set allDay to false. If its duration is absent, use one hour.
8. A time-only change inherits the already-resolved event date. For example, if "내일 3시에 회의" is confirmed and later "5시로 바뀌었어" appears, keep tomorrow's date and change only the time to 17:00. Never use the change message's posting date as the event date unless the message explicitly changes the date too.
9. DATE_HINT annotations are calculated deterministically by the application and are authoritative. Copy the hinted YYYY-MM-DD exactly into startDate/endDate. Never recalculate or override a DATE_HINT. Do not include DATE_HINT text in evidence.
10. EVENT_CANDIDATE annotations are coverage markers. When the context contains 1-3 markers, return exactly one decision object for every candidateId; rejected candidates use status cancelled or uncertain. When there are 4 or more markers, scan all of them but return only active events to keep the response compact. Multiple markers referring to the same event may produce duplicate decisions and the application will merge them. Do not include marker text in evidence.
11. A phrase such as "8시에 끝나" gives an end time, not a start time. If only the end time is known, use one hour before it as start time and explain this in dateReason. Do not reinterpret an evening context as 08:00.
12. A date range such as "월요일부터 금요일까지", "7월 20일~24일", or "3일 동안" is one period event. Return one event whose startDate is the first day and endDate is the last day. Never split it into one event per day.

EVENT DECISION:
- Include only a concrete, still-active commitment or clear personal intention.
- A proposal becomes an event only when accepted (좋아, 그래, 알겠어, 그렇게 하자, 응) or when the speaker clearly states a committed plan/reservation.
- Exclude unanswered questions, hypotheticals, casual mentions, events described as already happening/finished, and general discussion.
- Follow the conversation lifecycle. A later change replaces the earlier time. A cancellation (취소, 안 가, 못 가, 미룸 without a replacement date) removes the event.
- Historical chat exports are allowed. Extract a plan that was confirmed at the time of the conversation even when its resolved date is before the current reference time. The message timestamp determines what the speakers meant.
- Do not duplicate the same event.
- Extract every independent confirmed event in the context. Multiple different plans in the same messages must become separate event objects; never merge or silently omit the second plan.
- Exclude long-term living arrangements, goals, habits, and vague life plans. Calendar events must have a bounded duration of at most 31 days.
- status must describe the final conversation state: active, cancelled, or uncertain. Only active events are eligible for calendar output. When later text cancels an event without a replacement, set status to cancelled even if the earlier reservation was definite.
- category: work only for jobs, coworkers, company meetings, or business; study only for classes, study, exams, or assignments; personal for meals, friends, family, health, and leisure; otherwise general.
- priority: high only when the chat explicitly indicates urgency, a hard deadline, or major importance; otherwise medium. Casual plans may be low.

EXPLANATION:
- dateReason must briefly state the message timestamp used as the anchor and the calculation performed.
- Write dateReason in Korean.
- evidence must contain the shortest decisive chat excerpts supporting the original date, confirmation, and any later change. Do not omit the original date-bearing message when only the time is changed later.
- confidence is 0 to 1. Use below 0.65 when date or confirmation is uncertain.

Return one JSON object with an events array and no prose or markdown.`;

  const eventSchema = {
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
            evidence: { type: 'string' },
            confidence: { type: 'number' },
            status: { type: 'string', enum: ['active', 'cancelled', 'uncertain'] },
            candidateId: { type: 'integer' }
          },
          required: ['title', 'content', 'startDate', 'endDate', 'allDay', 'priority', 'category', 'dateReason', 'evidence', 'confidence', 'status', 'candidateId'],
          additionalProperties: false
        }
      }
    },
    required: ['events'],
    additionalProperties: false
  };

  const allEvents = [];
  const chunkErrors = [];

  try {
    // Process chunks sequentially to prevent server overload and GPU memory crashes
    for (let i = 0; i < chunks.length; i++) {
      let chunk = annotateRelativeDates(chunks[i]);
      let candidateIds = Array.from(chunk.matchAll(/\[EVENT_CANDIDATE:(\d+)\]/g), match => Number(match[1]));
      if (candidateIds.length > 3) {
        chunk = chunk.replace(/\s*\[EVENT_CANDIDATE:\d+\]/g, '');
        candidateIds = [];
      }
      const chunkSchema = JSON.parse(JSON.stringify(eventSchema));
      // Strict per-candidate coverage is valuable for ordinary short chats, but forcing
      // dozens of decision objects in a large export can overwhelm a local model.
      if (candidateIds.length > 0 && candidateIds.length <= 3) {
        chunkSchema.properties.events.minItems = candidateIds.length;
      }
      console.log(`Processing LLM chat parsing chunk ${i + 1}/${chunks.length}... (Size: ${chunk.length} chars)`);

      const response = await fetch(`${LLM_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: chunk }
          ],
          temperature: 0,
          max_tokens: 1800,
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'schedule_events', strict: true, schema: chunkSchema }
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Error in chunk ${i + 1}: Status ${response.status}. Msg: ${errText}`);
        chunkErrors.push(`chunk ${i + 1}: LLM status ${response.status}`);
        continue;
      }

      const data = await response.json();
      let reply = data.choices[0].message.content.trim();
      
      // Clean markdown wrappers
      if (reply.startsWith('```')) {
        reply = reply.replace(/^```json\s*/, '').replace(/```$/, '').trim();
      }

      try {
        const parsed = JSON.parse(reply);
        const parsedEvents = Array.isArray(parsed) ? parsed : parsed.events;
        if (Array.isArray(parsedEvents)) allEvents.push(...parsedEvents);
      } catch (parseErr) {
        console.error(`JSON Parse error in chunk ${i + 1} response:`, parseErr);
        console.error("Raw LLM reply was:", reply);
        chunkErrors.push(`chunk ${i + 1}: invalid JSON`);
      }
    }

    if (chunks.length > 0 && chunkErrors.length === chunks.length) {
      return res.status(502).json({ error: 'The LLM failed to return valid results', details: chunkErrors });
    }

    const normalizedEvents = allEvents
      .map(event => normalizeExtractedEvent(event, referenceDate))
      .filter(Boolean);
    const finalEvents = deduplicateEvents(normalizedEvents);
    if (chunkErrors.length) res.set('X-Parse-Warnings', String(chunkErrors.length));
    console.log(`Completed parsing all chunks. Raw: ${allEvents.length}, validated: ${finalEvents.length}, warnings: ${chunkErrors.length}`);
    res.json(finalEvents);

  } catch (err) {
    console.error('LLM Chunking process error:', err);
    res.status(500).json({ error: 'Failed to process chat log chunks', details: err.message });
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
  const hasDateExpression = /(오늘|내일|모레|글피|이번\s*주|다음\s*주|다다음\s*주|월요일|화요일|수요일|목요일|금요일|토요일|일요일|\d{1,2}\s*월\s*\d{1,2}\s*일|\d{4}[-./년]\s*\d{1,2}[-./월]\s*\d{1,2})/i.test(text);
  const hasTimeExpression = /((오전|오후|아침|저녁|밤|새벽)\s*\d{1,2}\s*시|\d{1,2}\s*시(\s*\d{1,2}\s*분)?|\d{1,2}:\d{2}|정오|자정)/i.test(text);
  if (!hasDateExpression) {
    return res.json({ events: [], clarification: '일정을 등록할 날짜를 알려주세요.' });
  }
  const dateHints = buildNaturalDateHints(text, referenceDate);
  const naturalSchedulePrompt = `You convert a user's Korean natural-language request into calendar events for review.
Current reference time: ${referenceDate}

RULES:
1. The user is directly asking to create schedules, so no conversational confirmation is required.
2. Extract every independent event when the input contains multiple schedules.
3. Resolve 오늘, 내일, 모레, 이번 주, 다음 주 from the current reference time.
4. DATE_HINT is calculated by the application and is authoritative. Copy its date exactly and never recalculate it.
5. Convert 오전/오후 correctly. Noon is 12:00 and midnight is 00:00.
6. A date is required. If the date is missing or ambiguous, return no event for that portion and ask one concise Korean question in clarification.
7. If an event has no explicit schedule time, it is an all-day event. Set allDay to true, startDate to 00:00:00, and endDate to 23:59:59 on that date. Never ask for a time and never invent 09:00 or another arbitrary time.
8. If an event has an explicit schedule time, set allDay to false. If duration or end time is absent, set endDate to one hour after startDate.
9. startDate and endDate must be ISO 8601 with the same timezone offset as the reference time.
10. category: work for company/business, study for classes/exams/assignments, personal for health/family/friends/leisure, otherwise general.
11. priority is medium unless urgency, a hard deadline, or explicit importance supports high. Casual plans may be low.
12. dateReason must be a short Korean explanation of how the date and time were resolved, or that the event was classified as all-day because no time was stated.
13. confidence is 0 to 1. Use below 0.65 for ambiguity and omit that event.
14. A date range such as "월요일부터 금요일까지", "7월 20일~24일", or "3일 동안" is one period event. Return one event whose startDate is the first day and endDate is the last day. Never split it into one event per day.

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
    const normalizedEvents = (parsed.events || [])
      .map((event, index) => normalizeExtractedEvent({
        ...event,
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


// Serve frontend SPA index.html for all other routes
app.get('*', (req, res) => {
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

startServer();
