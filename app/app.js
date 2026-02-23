function qs(sel) {
  return document.querySelector(sel);
}

function setStatus(text) {
  const el = qs('[data-status]');
  if (el) el.textContent = text;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function loadHSK1() {
const res = await fetch('./data/hsk1.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load HSK1 JSON: ' + res.status);
  return await res.json();
}

function normalizeHSK(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.cards)) return data.cards;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

function pickFirstCard(cards) {
  return cards[0] || null;
}

function renderStudyCard(card) {
  const root = qs('#study-root');
  if (!root) return;

  if (!card) {
    root.innerHTML = '<p>No cards found.</p>';
    return;
  }

  const hanzi = card.hanzi || card.simplified || card.traditional || '';
  const pinyin = card.pinyin || '';
  const english = card.english || card.meaning || card.translation || '';

  root.innerHTML = `
    <div class="card">
      <div id="card-front">
        <div style="font-size: 40px; margin-bottom: 12px;">${escapeHtml(hanzi)}</div>
        <div style="font-size: 20px; margin-bottom: 12px;">${escapeHtml(pinyin)}</div>
      </div>

      <div id="card-back" style="display:none;">
        <div style="font-size: 18px; margin-bottom: 18px;">${escapeHtml(english)}</div>
      </div>

      <div style="display:flex; gap:12px; align-items:center; margin-top: 12px;">
        <button id="btn-flip" type="button">Flip</button>
        <button id="btn-fail" type="button" disabled>Fail</button>
        <button id="btn-pass" type="button" disabled>Pass</button>
      </div>
    </div>
  `;

  const front = qs('#card-front');
  const back = qs('#card-back');
  const flipBtn = qs('#btn-flip');
  const passBtn = qs('#btn-pass');
  const failBtn = qs('#btn-fail');

  let isBack = false;

  function updateView() {
    if (!front || !back || !flipBtn || !passBtn || !failBtn) return;

    if (isBack) {
      front.style.display = 'none';
      back.style.display = 'block';
      flipBtn.textContent = 'Flip Back';
      passBtn.disabled = false;
      failBtn.disabled = false;
    } else {
      front.style.display = 'block';
      back.style.display = 'none';
      flipBtn.textContent = 'Flip';
      passBtn.disabled = true;
      failBtn.disabled = true;
    }
  }

  if (flipBtn) {
    flipBtn.addEventListener('click', () => {
      isBack = !isBack;
      updateView();
    });
  }

  if (passBtn) {
    passBtn.addEventListener('click', () => alert('Pass recorded (next step: weighting + scheduling)'));
  }

  if (failBtn) {
    failBtn.addEventListener('click', () => alert('Fail recorded (next step: weighting + scheduling)'));
  }

  updateView();
}

async function initStudy() {
  setStatus('Loading HSK1…');
  const raw = await loadHSK1();
  const cards = normalizeHSK(raw);

  if (cards.length === 0) {
    setStatus('No cards found in HSK1 file');
    renderStudyCard(null);
    return;
  }

  const card = pickFirstCard(cards);
  setStatus('Ready');
  renderStudyCard(card);
}

async function init() {
  const page = document.body?.dataset?.page || '';

  if (page === 'study') {
    await initStudy();
    return;
  }

  setStatus('Ready');
}

window.addEventListener('DOMContentLoaded', () => {
  init().catch((e) => {
    console.error(e);
    setStatus('Error: ' + e.message);
  });
});
