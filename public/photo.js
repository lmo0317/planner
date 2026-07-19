const sessionState = document.getElementById('session-state');
const btnStartBackup = document.getElementById('btn-start-backup');
const btnRefresh = document.getElementById('btn-refresh');
const extraUrl = document.getElementById('extra-url');
const progressPanel = document.getElementById('progress-panel');
const progressTitle = document.getElementById('progress-title');
const progressCount = document.getElementById('progress-count');
const progressFill = document.getElementById('progress-fill');
const progressDetail = document.getElementById('progress-detail');
const gallery = document.getElementById('gallery');
const emptyState = document.getElementById('empty-state');
const photoCount = document.getElementById('photo-count');
const photoSize = document.getElementById('photo-size');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const toast = document.getElementById('toast');

let photos = [];
let isConnected = false;
let activeJobId = '';

document.addEventListener('DOMContentLoaded', () => {
  btnStartBackup.addEventListener('click', startKidsNoteBackup);
  btnRefresh.addEventListener('click', () => {
    refreshSession();
    loadPhotos();
  });
  searchInput.addEventListener('input', renderPhotos);
  sortSelect.addEventListener('change', loadPhotos);
  refreshSession();
  loadPhotos();
  lucide.createIcons();
});

async function refreshSession() {
  try {
    const response = await fetch('/api/kidsnote/session', { cache: 'no-store' });
    const session = await response.json().catch(() => ({}));
    isConnected = response.ok && session.connected === true;
    sessionState.classList.toggle('connected', isConnected);
    sessionState.classList.toggle('disconnected', !isConnected);
    sessionState.innerHTML = isConnected
      ? '<i data-lucide="link"></i><span>키즈노트 로그인 연결됨</span>'
      : '<i data-lucide="link-2-off"></i><span>Planner 메인에서 키즈노트 로그인이 필요합니다</span>';
    btnStartBackup.disabled = !isConnected || Boolean(activeJobId);
  } catch {
    isConnected = false;
    sessionState.classList.add('disconnected');
    sessionState.innerHTML = '<i data-lucide="link-2-off"></i><span>키즈노트 연결 상태를 확인하지 못했습니다</span>';
    btnStartBackup.disabled = true;
  }
  lucide.createIcons();
}

async function loadPhotos() {
  try {
    const response = await fetch(`/api/photos?sort=${encodeURIComponent(sortSelect.value)}`, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '사진 목록을 불러오지 못했습니다.');
    photos = Array.isArray(result.photos) ? result.photos : [];
    photoCount.textContent = String(result.totalCount || photos.length);
    photoSize.textContent = formatBytes(result.totalSize || photos.reduce((sum, photo) => sum + (photo.size || 0), 0));
    renderPhotos();
  } catch (error) {
    showToast(error.message);
  }
}

async function startKidsNoteBackup() {
  if (!isConnected) {
    showToast('먼저 Planner 메인에서 키즈노트에 로그인해 주세요.');
    return;
  }
  btnStartBackup.disabled = true;
  setProgress({ title: '백업 작업 시작 중', found: 0, processed: 0, saved: 0, skipped: 0, failed: 0 });
  progressPanel.classList.remove('hidden');

  try {
    const response = await fetch('/api/photos/kidsnote-backup/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extraUrl: extraUrl.value.trim() })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.jobId) throw new Error(result.error || '키즈노트 사진 백업을 시작하지 못했습니다.');
    activeJobId = result.jobId;
    await pollBackupJob(result.jobId);
  } catch (error) {
    activeJobId = '';
    btnStartBackup.disabled = !isConnected;
    setProgress({ title: '백업 실패', detail: error.message, failed: 1 });
    showToast(error.message);
  }
}

async function pollBackupJob(jobId) {
  for (let attempt = 0; attempt < 720; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const response = await fetch(`/api/photos/kidsnote-backup/jobs/${encodeURIComponent(jobId)}`, { cache: 'no-store' });
    const status = await response.json().catch(() => ({}));
    if (!response.ok || status.status === 'failed') {
      throw new Error(status.error || '키즈노트 사진 백업에 실패했습니다.');
    }
    setProgress({ title: '키즈노트 사진 백업 중', ...(status.progress || {}) });
    if (status.status === 'completed') {
      activeJobId = '';
      const result = status.result || {};
      setProgress({ title: '백업 완료', ...result, processed: result.found || 0 });
      showToast(`새 사진 ${result.saved || 0}개를 저장했습니다.`);
      btnStartBackup.disabled = !isConnected;
      await loadPhotos();
      return;
    }
  }
  throw new Error('키즈노트 사진 백업 시간이 초과되었습니다.');
}

function setProgress(progress) {
  const found = Number(progress.found) || 0;
  const processed = Number(progress.processed) || 0;
  const saved = Number(progress.saved) || 0;
  const skipped = Number(progress.skipped) || 0;
  const failed = Number(progress.failed) || 0;
  const pagesVisited = Number(progress.pagesVisited) || 0;
  const failedPages = Number(progress.failedPages) || 0;
  const ratio = found > 0 ? Math.min(100, Math.round((processed / found) * 100)) : 4;

  progressTitle.textContent = progress.title || '백업 진행 중';
  progressCount.textContent = found > 0 ? `${processed} / ${found}` : `${pagesVisited}개 페이지 확인`;
  progressFill.style.width = `${ratio}%`;

  const current = progress.currentPage || progress.currentImage || progress.detail || '';
  progressDetail.textContent = `페이지 ${pagesVisited}개 · 저장 ${saved}개 · 중복/제외 ${skipped}개 · 다운로드 실패 ${failed}개 · 페이지 스킵 ${failedPages}개${current ? ` · ${shorten(current, 80)}` : ''}`;
}

function renderPhotos() {
  const query = searchInput.value.trim().toLowerCase();
  const visible = photos.filter(photo => {
    const haystack = `${photo.originalName || ''} ${photo.sourceType || ''} ${photo.sourceUrl || ''}`.toLowerCase();
    return !query || haystack.includes(query);
  });
  gallery.innerHTML = '';
  emptyState.classList.toggle('hidden', visible.length > 0);

  for (const photo of visible) {
    const card = document.createElement('article');
    card.className = 'photo-card';

    const image = document.createElement('img');
    image.className = 'photo-thumb';
    image.loading = 'lazy';
    image.src = `/api/photos/${encodeURIComponent(photo.id)}/file`;
    image.alt = photo.originalName;

    const meta = document.createElement('div');
    meta.className = 'photo-meta';

    const name = document.createElement('p');
    name.className = 'photo-name';
    name.title = photo.originalName;
    name.textContent = photo.originalName;

    const detail = document.createElement('div');
    detail.className = 'photo-detail';
    const sourceDate = photo.takenAt ? formatDate(photo.takenAt) : '글 날짜 없음';
    detail.textContent = `${sourceDate}${photo.sourceTitle ? ` · ${photo.sourceTitle}` : ''} · ${formatBytes(photo.size)}`;

    const backupDate = document.createElement('div');
    backupDate.className = 'photo-detail';
    backupDate.textContent = `백업 ${formatDate(photo.uploadedAt)}`;

    const source = document.createElement('span');
    source.className = 'photo-source';
    source.textContent = photo.sourceType === 'album' ? '추억앨범' : '추억알림장';

    const actions = document.createElement('div');
    actions.className = 'photo-actions';

    const download = document.createElement('a');
    download.href = `/api/photos/${encodeURIComponent(photo.id)}/file?download=1`;
    download.innerHTML = '<i data-lucide="download"></i><span>다운로드</span>';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger';
    remove.title = '삭제';
    remove.innerHTML = '<i data-lucide="trash-2"></i>';
    remove.addEventListener('click', () => deletePhoto(photo));

    meta.appendChild(name);
    meta.appendChild(detail);
    meta.appendChild(backupDate);
    meta.appendChild(source);
    actions.appendChild(download);
    actions.appendChild(remove);
    card.appendChild(image);
    card.appendChild(meta);
    card.appendChild(actions);
    gallery.appendChild(card);
  }

  lucide.createIcons();
}

async function deletePhoto(photo) {
  if (!confirm(`"${photo.originalName}" 사진을 삭제할까요?`)) return;
  try {
    const response = await fetch(`/api/photos/${encodeURIComponent(photo.id)}`, { method: 'DELETE' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || '사진을 삭제하지 못했습니다.');
    showToast('사진을 삭제했습니다.');
    await loadPhotos();
  } catch (error) {
    showToast(error.message);
  }
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let unit = units.shift();
  while (size >= 1024 && units.length) {
    size /= 1024;
    unit = units.shift();
  }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${unit}`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function shorten(value, maxLength) {
  const text = String(value || '');
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}
