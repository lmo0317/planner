const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function option(name) {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1] || '';
  const assigned = args.find(value => value.startsWith(`${name}=`));
  return assigned ? assigned.slice(name.length + 1) : '';
}

const positionalBaseUrl = args.find(value => /^https?:\/\//.test(value));
const baseUrl = (option('--base-url') || positionalBaseUrl || process.env.AI_SCHEDULE_BASE_URL || 'http://127.0.0.1:19000').replace(/\/$/, '');
const selectedCase = option('--case');
const serverFile = path.resolve(option('--server-file') || path.join(__dirname, '..', 'server.js'));
const fixturePath = path.join(__dirname, '..', 'evals', 'ai-schedule-cases.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const cases = selectedCase
  ? fixture.cases.filter(testCase => testCase.id === selectedCase)
  : fixture.cases;

if (!cases.length) {
  console.error(`No AI schedule case matched: ${selectedCase}`);
  process.exit(2);
}

function validate(testCase, result) {
  const errors = [];
  const events = Array.isArray(result.events) ? result.events : [];
  const expected = testCase.expected;
  if (events.length !== expected.eventCount) {
    errors.push(`eventCount expected ${expected.eventCount}, received ${events.length}`);
  }
  for (const field of ['reportCount', 'analyzedCount']) {
    if (Object.hasOwn(expected, field) && result[field] !== expected[field]) {
      errors.push(`${field} expected ${JSON.stringify(expected[field])}, received ${JSON.stringify(result[field])}`);
    }
  }
  for (const fragment of expected.titlesInclude || []) {
    if (!events.some(item => String(item.title || '').includes(fragment))) {
      errors.push(`titles expected one event to include ${JSON.stringify(fragment)}, received ${JSON.stringify(events.map(item => item.title || ''))}`);
    }
  }
  const event = events[0] || {};
  for (const field of ['title', 'startDate', 'endDate', 'allDay']) {
    if (Object.hasOwn(expected, field) && event[field] !== expected[field]) {
      errors.push(`${field} expected ${JSON.stringify(expected[field])}, received ${JSON.stringify(event[field])}`);
    }
  }
  for (const fragment of expected.contentIncludes || []) {
    if (!String(event.content || '').includes(fragment)) {
      errors.push(`content expected to include ${JSON.stringify(fragment)}, received ${JSON.stringify(event.content || '')}`);
    }
  }
  for (const fragment of expected.contentExcludes || []) {
    if (String(event.content || '').includes(fragment)) {
      errors.push(`content expected to exclude ${JSON.stringify(fragment)}, received ${JSON.stringify(event.content || '')}`);
    }
  }
  if (Object.hasOwn(expected, 'clarification') && String(result.clarification || '') !== expected.clarification) {
    errors.push(`clarification expected ${JSON.stringify(expected.clarification)}, received ${JSON.stringify(result.clarification || '')}`);
  }
  return errors;
}

(async () => {
  let failed = 0;
  for (const testCase of cases) {
    try {
      if (testCase.kind === 'kidsnote-dedup') {
        const { deduplicateKidsNoteEvents } = require(serverFile);
        const result = { events: deduplicateKidsNoteEvents(testCase.inputEvents || []) };
        const errors = validate(testCase, result);
        if (errors.length) {
          failed++;
          console.error(`FAIL ${testCase.id}`);
          errors.forEach(error => console.error(`  - ${error}`));
          console.error(`  actual: ${JSON.stringify(result)}`);
        } else {
          console.log(`PASS ${testCase.id}`);
        }
        continue;
      }
      if (testCase.kind === 'kidsnote-import') {
        const response = await fetch(`${baseUrl}/api/kidsnote/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'json',
            data: testCase.inputReports || [],
            baseDate: testCase.baseDate,
            importStartDate: testCase.importStartDate
          }),
          signal: AbortSignal.timeout(90000)
        });
        const body = await response.text();
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${body}`);
        const result = JSON.parse(body);
        const errors = validate(testCase, result);
        if (errors.length) {
          failed++;
          console.error(`FAIL ${testCase.id}`);
          errors.forEach(error => console.error(`  - ${error}`));
          console.error(`  actual: ${JSON.stringify(result)}`);
        } else {
          console.log(`PASS ${testCase.id}`);
        }
        continue;
      }
      const response = await fetch(`${baseUrl}/api/todos/parse-natural-language`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testCase.input, baseDate: testCase.baseDate }),
        signal: AbortSignal.timeout(90000)
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${body}`);
      const result = JSON.parse(body);
      const errors = validate(testCase, result);
      if (errors.length) {
        failed++;
        console.error(`FAIL ${testCase.id}`);
        errors.forEach(error => console.error(`  - ${error}`));
        console.error(`  actual: ${JSON.stringify(result)}`);
      } else {
        console.log(`PASS ${testCase.id}`);
      }
    } catch (error) {
      failed++;
      console.error(`FAIL ${testCase.id}`);
      console.error(`  - ${error.message}`);
    }
  }

  console.log(`AI schedule harness: ${cases.length - failed}/${cases.length} passed against ${baseUrl}`);
  process.exitCode = failed ? 1 : 0;
})();
