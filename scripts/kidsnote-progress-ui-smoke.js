const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const baseUrl = (process.env.PLANNER_SMOKE_BASE_URL || 'http://127.0.0.1:19000').replace(/\/$/, '');
const executablePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outputDir = path.join(__dirname, '..', 'test-artifacts');

async function verifyPage(browser, name, route, viewport) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport(viewport);
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    kidsNoteModal.classList.add('open');
    kidsNoteInputPanel.classList.add('hidden');
    kidsNotePreview.classList.add('hidden');
    kidsNoteLoading.classList.remove('hidden');
    updateKidsNoteLoadingStatus({
      progress: {
        phase: 'analyzing',
        message: 'AI 분석 2/4단계를 완료했습니다.',
        completedChunks: 2,
        totalChunks: 4
      },
      elapsedSeconds: 27
    });
  });

  const state = await page.evaluate(() => {
    const modalRect = kidsNoteModal.querySelector('.kidsnote-modal-content').getBoundingClientRect();
    const progressRect = kidsNoteProgress.getBoundingClientRect();
    const barRect = kidsNoteProgressBar.getBoundingClientRect();
    return {
      title: kidsNoteLoadingTitle.textContent,
      status: kidsNoteLoadingStatus.textContent,
      meta: kidsNoteLoadingMeta.textContent,
      ariaNow: kidsNoteProgress.getAttribute('aria-valuenow'),
      modalWithinViewport: modalRect.left >= 0 && modalRect.right <= innerWidth && modalRect.top >= 0 && modalRect.bottom <= innerHeight,
      progressRatio: progressRect.width ? Number((barRect.width / progressRect.width).toFixed(2)) : 0,
      progressWidth: progressRect.width,
      barWidth: barRect.width,
      barStyleWidth: kidsNoteProgressBar.style.width,
      barDisplay: getComputedStyle(kidsNoteProgressBar).display,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth
    };
  });

  state.delayedMeta = await page.evaluate(() => {
    updateKidsNoteLoadingStatus({
      progress: {
        phase: 'analyzing',
        message: 'AI 분석 결과를 기다리고 있습니다.',
        completedChunks: 2,
        totalChunks: 4
      },
      elapsedSeconds: 122,
      stageAgeSeconds: 95
    });
    return kidsNoteLoadingMeta.textContent;
  });

  fs.mkdirSync(outputDir, { recursive: true });
  await page.screenshot({ path: path.join(outputDir, `kidsnote-progress-${name}.png`), fullPage: true });
  await page.close();

  const passed = state.title.includes('AI가 일정 후보') &&
    state.status.includes('2/4') &&
    state.meta.includes('27초 경과') &&
    state.meta.includes('서버 응답 정상') &&
    state.ariaNow === '50' &&
    state.progressRatio >= 0.49 && state.progressRatio <= 0.51 &&
    state.delayedMeta.includes('1분 35초째 단계 변화 없음') &&
    state.modalWithinViewport && !state.horizontalOverflow && errors.length === 0;
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify({ ...state, errors })}`);
  return passed;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  try {
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
