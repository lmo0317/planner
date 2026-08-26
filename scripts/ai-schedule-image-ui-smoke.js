const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const baseUrl = (process.env.PLANNER_SMOKE_BASE_URL || 'http://127.0.0.1:19000').replace(/\/$/, '');
const executablePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outputDir = path.join(__dirname, '..', 'test-artifacts');
const sourceImage = path.join(outputDir, 'ai-schedule-source.png');

async function createSourceImage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 560, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:55px;background:#f7faf8;font-family:"Malgun Gothic",sans-serif;color:#173b2d}
    article{padding:42px;border:3px solid #45a77e;border-radius:24px;background:white}
    h1{margin:0 0 28px;font-size:42px}p{margin:14px 0;font-size:30px;line-height:1.5}
  </style><article><h1>학부모 공개수업 안내</h1><p>일시: 2026년 9월 3일 목요일 오전 10시</p><p>장소: 별관 2층 강당</p><p>준비물: 실내화</p></article>`);
  await page.screenshot({ path: sourceImage });
  await page.close();
}

async function verifyPage(browser, name, route, viewport) {
  const page = await browser.newPage();
  let imagePayload = null;
  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.url().endsWith('/api/todos/parse-schedule-image') && request.method() === 'POST') {
      imagePayload = JSON.parse(request.postData());
      request.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          events: [{
            title: '학부모 공개수업', content: '장소: 별관 2층 강당 / 준비물: 실내화',
            startDate: '2026-09-03T10:00:00+09:00', endDate: '2026-09-03T11:00:00+09:00',
            allDay: false, priority: 'medium', category: 'study', confidence: 0.98,
            dateReason: '이미지의 2026년 9월 3일 오전 10시를 사용'
          }],
          recognizedText: '학부모 공개수업 안내 2026년 9월 3일 목요일 오전 10시',
          clarification: ''
        })
      });
      return;
    }
    request.continue();
  });

  await page.setViewport(viewport);
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    if (typeof openAiScheduleModal === 'function') openAiScheduleModal();
    else openAiSchedule();
  });
  await page.screenshot({ path: path.join(outputDir, `ai-schedule-text-${name}.png`), fullPage: true });
  await page.click('[data-ai-input-mode="image"]');
  const input = await page.$('#ai-schedule-image');
  await input.uploadFile(sourceImage);
  try {
    await page.waitForSelector('#ai-schedule-image-preview:not(.hidden)');
  } catch (error) {
    const uploadState = await page.evaluate(() => ({
      fileCount: document.getElementById('ai-schedule-image')?.files?.length || 0,
      previewClass: document.getElementById('ai-schedule-image-preview')?.className || '',
      thumbnailLength: document.getElementById('ai-schedule-image-thumbnail')?.src?.length || 0
    }));
    throw new Error(`Image preview did not appear: ${JSON.stringify({ uploadState, errors, cause: error.message })}`);
  }
  await page.screenshot({ path: path.join(outputDir, `ai-schedule-image-${name}.png`), fullPage: true });
  await page.click('#btn-analyze-ai-schedule');
  await page.waitForSelector('#ai-schedule-preview:not(.hidden)');

  const state = await page.evaluate(() => ({
    imageModeSelected: document.querySelector('[data-ai-input-mode="image"]').getAttribute('aria-selected'),
    imagePanelVisible: !document.getElementById('ai-schedule-image-panel').classList.contains('hidden'),
    recommendationsRemoved: !document.querySelector('.ai-example-list') && !document.body.textContent.includes('추천 예시'),
    title: document.querySelector('#ai-schedule-list .event-card-title')?.textContent || '',
    selectedCount: document.getElementById('ai-selected-count')?.textContent || '',
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    modalRect: (() => {
      const rect = document.querySelector('.ai-schedule-modal-content').getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    })()
  }));
  await page.screenshot({ path: path.join(outputDir, `ai-schedule-image-${name}-preview.png`), fullPage: true });
  await page.close();

  const withinViewport = state.modalRect.left >= 0 && state.modalRect.right <= viewport.width &&
    state.modalRect.top >= 0 && state.modalRect.bottom <= viewport.height;
  const passed = state.imageModeSelected === 'true' && state.recommendationsRemoved && state.title.includes('학부모 공개수업') &&
    state.selectedCount === '1' && imagePayload?.imageDataUrl?.startsWith('data:image/jpeg;base64,') &&
    Boolean(imagePayload?.baseDate) && !state.horizontalOverflow && withinViewport && errors.length === 0;
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify({ ...state, payload: Boolean(imagePayload), withinViewport, errors })}`);
  return passed;
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  try {
    await createSourceImage(browser);
    const desktop = await verifyPage(browser, 'desktop', '/', { width: 1440, height: 1000, deviceScaleFactor: 1 });
    const mobile = await verifyPage(browser, 'mobile', '/mobile.html', { width: 390, height: 844, deviceScaleFactor: 1 });
    if (!desktop || !mobile) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
