/* OC_BEGIN:appjs:top:v1 */

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

function nowMs() {
  return Date.now();
}

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem('mf_progress') || '{}');
  } catch {
    return {};
  }
}

function saveProgress(p) {
  localStorage.setItem('mf_progress', JSON.stringify(p));
}

function loadCustomCards() {
  try {
    const raw = localStorage.getItem('mf_custom_cards');
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveCustomCards(cards) {
  localStorage.setItem('mf_custom_cards', JSON.stringify(cards));
}

function addCustomCard(card) {
  const cards = loadCustomCards();
  cards.push(card);
  saveCustomCards(cards);
}

function getCardId(card) {
  return card.id || (card.hanzi + '|' + card.pinyin) || '';
}

function applyToneToSyllable(syl, tone) {
  const t = Number(tone);
  if (![1, 2, 3, 4, 5].includes(t)) return syl;

  let s = syl || '';

  // Strip any existing tone marks so we can re-apply a different tone
  s = s
    .replace(/[āáǎà]/g, 'a')
    .replace(/[ēéěè]/g, 'e')
    .replace(/[īíǐì]/g, 'i')
    .replace(/[ōóǒò]/g, 'o')
    .replace(/[ūúǔù]/g, 'u')
    .replace(/[ǖǘǚǜ]/g, 'ü');

  s = s.replace(/u:/g, 'ü').replace(/v/g, 'ü');

  if (t === 5) {
    return s;
  }

  const mark = {
    a: ['ā', 'á', 'ǎ', 'à'],
    e: ['ē', 'é', 'ě', 'è'],
    i: ['ī', 'í', 'ǐ', 'ì'],
    o: ['ō', 'ó', 'ǒ', 'ò'],
    u: ['ū', 'ú', 'ǔ', 'ù'],
    ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ']
  };

  let lower = s.toLowerCase();

  function replaceFirst(vowel) {
    const idx = lower.indexOf(vowel);
    if (idx === -1) return false;

    const actual = s[idx];
    const base = actual === 'Ü' ? 'ü' : actual.toLowerCase();
    const m = mark[base][t - 1];

    s = s.slice(0, idx) + m + s.slice(idx + 1);
    return true;
  }

  if (lower.includes('a')) return replaceFirst('a') ? s : s;
  if (lower.includes('e')) return replaceFirst('e') ? s : s;
  if (lower.includes('ou')) return replaceFirst('o') ? s : s;

  for (const v of ['i', 'u', 'ü', 'o']) {
    if (lower.includes(v)) {
      const idx = lower.lastIndexOf(v);
      const actual = s[idx];
      const base = actual === 'Ü' ? 'ü' : actual.toLowerCase();
      const m = mark[base][t - 1];
      s = s.slice(0, idx) + m + s.slice(idx + 1);
      return s;
    }
  }

  return s;
}

function applyToneToLastSyllable(text, tone) {
  const s = (text || '').trim();
  if (!s) return s;

  const parts = s.split(/\s+/);
  const last = parts[parts.length - 1];
  parts[parts.length - 1] = applyToneToSyllable(last, tone);
  return parts.join(' ');
}

function toneColorForNumber(tone) {
  const t = Number(tone);
  if (t === 1) return '#e74c3c';
  if (t === 2) return '#f39c12';
  if (t === 3) return '#27ae60';
  if (t === 4) return '#2980b9';
  return '#95a5a6';
}

function renderPinyinWithTones(pinyin, toneNumbers) {
  const text = String(pinyin || '').trim();
  if (!text) return null;

  const tones = Array.isArray(toneNumbers) ? toneNumbers : [];
  const parts = text.split(/\s+/);

  const wrap = document.createElement('span');
  wrap.className = 'pinyin-tones';

  for (let i = 0; i < parts.length; i++) {
    const syl = parts[i];
    const tone = tones[i];
    const span = document.createElement('span');
    span.textContent = syl + (i < parts.length - 1 ? ' ' : '');
    span.style.color = toneColorForNumber(tone);
    wrap.appendChild(span);
  }

  return wrap;
}

function computeDueMs(state) {
  return typeof state?.dueMs === 'number' ? state.dueMs : 0;
}

function isDue(state, t) {
  const due = computeDueMs(state);
  return due === 0 || due <= t;
}

function scheduleNext(state, grade) {
  const t = nowMs();
  const s = { ...state };

  const intervalDays = typeof s.intervalDays === 'number' ? s.intervalDays : 0;
  const streak = typeof s.streak === 'number' ? s.streak : 0;
  const fails = typeof s.fails === 'number' ? s.fails : 0;

  if (grade === 'fail') {
    s.streak = 0;
    s.fails = fails + 1;
    s.intervalDays = 0;
    s.dueMs = t + 10 * 60 * 1000;
    return s;
  }

  const newStreak = streak + 1;
  s.streak = newStreak;

  let nextDays = intervalDays;
  if (newStreak === 1) nextDays = 1;
  else if (newStreak === 2) nextDays = 3;
  else if (newStreak === 3) nextDays = 7;
  else nextDays = Math.min(60, Math.round(nextDays * 2));

  s.intervalDays = nextDays;
  s.dueMs = t + nextDays * 24 * 60 * 60 * 1000;
  return s;
}

function buildQueue(cards, progress) {
  const t = nowMs();

  const due = [];
  const newCards = [];

  for (const c of cards) {
    const id = getCardId(c);
    const st = progress[id];

    if (!st) {
      newCards.push(c);
      continue;
    }

    if (isDue(st, t)) due.push(c);
  }

  due.sort((a, b) => {
    const da = computeDueMs(progress[getCardId(a)]);
    const db = computeDueMs(progress[getCardId(b)]);
    return da - db;
  });

  return due.concat(newCards);
}

async function loadHSK1() {
const res = await fetch('./data/hsk1.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load HSK1 JSON: ' + res.status);
  return await res.json();
}

async function loadDeckJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return await res.json();
}

async function loadActiveDeckCards() {
  const mode = localStorage.getItem('deckMode') || 'HSK1';

  if (mode === 'HSK2') {
    const raw = await loadDeckJson('./data/hsk2.json');
    return normalizeHSK(raw);
  }

  if (mode === 'BOTH') {
    const raw1 = await loadDeckJson('./data/hsk1.json');
    const raw2 = await loadDeckJson('./data/hsk2.json');
    return normalizeHSK(raw1).concat(normalizeHSK(raw2));
  }

  const raw = await loadHSK1();
  return normalizeHSK(raw);
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

function renderStudyCard(card, onGrade) {
  const root = qs('#study-root');
  if (!root) return;

  root.innerHTML = '';

  if (!card) {
    const p = document.createElement('p');
    p.textContent = 'No cards available.';
    root.appendChild(p);
    return;
  }

  const hanzi = card.hanzi || card.simplified || card.traditional || '';
  const pinyin = card.pinyin || '';
  const english = card.english || card.meaning || card.translation || '';
  const deck = card.deck || card.hskLevel || 'HSK';
  const exPinyin = card.examplePinyin || '';
  const exEn = card.exampleEn || '';

  const cardWrap = document.createElement('div');
  cardWrap.className = 'study-card';

  const front = document.createElement('div');
  front.id = 'card-front';

  const deckEl = document.createElement('div');
  deckEl.className = 'study-deck';  
  deckEl.textContent = deck;

  const hanziEl = document.createElement('div');
  hanziEl.className = 'study-hanzi';
  hanziEl.textContent = hanzi;

  const pinyinEl = document.createElement('div');
  pinyinEl.className = 'study-pinyin';
  const toneNode = renderPinyinWithTones(pinyin, card.toneNumbers);
  if (toneNode) {
    pinyinEl.textContent = '';
    pinyinEl.appendChild(toneNode);
  } else {
    pinyinEl.textContent = pinyin;
  }

  front.appendChild(deckEl);
  front.appendChild(hanziEl);
  front.appendChild(pinyinEl);

  const back = document.createElement('div');
  back.id = 'card-back';
  back.style.display = 'none';

  const enEl = document.createElement('div');
  enEl.className = 'study-english';
  enEl.textContent = english;

  back.appendChild(enEl);

if (exPinyin || exEn) {
  const exWrap = document.createElement('div');
  exWrap.className = 'study-example';

  const exPyEl = document.createElement('div');
  exPyEl.className = 'ex-py';
  exPyEl.textContent = exPinyin;
  
  const exEnEl = document.createElement('div');
  exEnEl.className = 'ex-en';
  exEnEl.textContent = exEn;

  exWrap.appendChild(exPyEl);
  exWrap.appendChild(exEnEl);
  back.appendChild(exWrap); 
}

  const frontBtnRow = document.createElement('div');
  frontBtnRow.className = 'study-front-actions';

  const flipBtn = document.createElement('button');
  flipBtn.id = 'btn-flip';
  flipBtn.type = 'button';
  flipBtn.textContent = 'Flip';

  frontBtnRow.appendChild(flipBtn);
  front.appendChild(frontBtnRow);


  const backBtnRow = document.createElement('div');
  backBtnRow.className = 'study-back-actions';

  const flipBackBtn = document.createElement('button');
  flipBackBtn.id = 'btn-flip-back';
  flipBackBtn.type = 'button';
  flipBackBtn.textContent = 'Flip Back';

  const failBtn = document.createElement('button');
  failBtn.id = 'btn-fail';
  failBtn.type = 'button';
  failBtn.textContent = 'Fail';

  const passBtn = document.createElement('button');
  passBtn.id = 'btn-pass';
  passBtn.type = 'button';
  passBtn.textContent = 'Pass';

  backBtnRow.appendChild(flipBackBtn);
  backBtnRow.appendChild(failBtn);
  backBtnRow.appendChild(passBtn);
  back.appendChild(backBtnRow);

  let isBack = false;
  let graded = false;

  function updateView() {
    if (isBack) {
      front.style.display = 'none';
      back.style.display = 'block';
    } else {
      front.style.display = 'block';
      back.style.display = 'none';
    }
  }

function lockAndGrade(grade) {
  if (graded) return;
  graded = true;
  flipBtn.disabled = true;
  flipBackBtn.disabled = true;
  passBtn.disabled = true;
  failBtn.disabled = true;
  onGrade(grade);
}

  flipBtn.addEventListener('click', () => {
    if (graded) return;
    isBack = true;
    updateView();
  });

  flipBackBtn.addEventListener('click', () => {
    if (graded) return;
    isBack = false;
    updateView();
  });

  passBtn.addEventListener('click', () => {
    if (!isBack) return;
    lockAndGrade('pass');
  });
  failBtn.addEventListener('click', () => {
    if (!isBack) return;
    lockAndGrade('fail');
  });

  cardWrap.appendChild(front);
  cardWrap.appendChild(back);

  root.appendChild(cardWrap);

  updateView();
}

function probGetWeight(progress, id) {
  const rec = progress[id] || {};
  const w = Number(rec.w || 1);
  return Number.isFinite(w) && w > 0 ? w : 1;
}

function probUpdateAfterGrade(progress, id, grade) {
  const rec = progress[id] || {};
  const prevW = probGetWeight(progress, id);

  let w = prevW;

  if (grade === 'fail') {
    w = Math.min(PROB_CFG.failMax, (prevW * PROB_CFG.failMult) + PROB_CFG.failAdd);
    rec.failCount = Number(rec.failCount || 0) + 1;
    rec.passStreak = 0;
    rec.failStreak = Number(rec.failStreak || 0) + 1;
  } else {
    w = 1 + (prevW - 1) * PROB_CFG.passDecay;
    w = Math.max(1, w);
    rec.passCount = Number(rec.passCount || 0) + 1;
    rec.passStreak = Number(rec.passStreak || 0) + 1;
    rec.failStreak = 0;
  }

  rec.w = w;
  rec.lastGrade = grade;
  rec.lastSeenAt = Date.now();

  progress[id] = rec;
}

const PROB_CFG = {
  failMult: 1.8,
  failAdd: 1,
  failMax: 12,
  passDecay: 0.55,
  coverageBoost: 2.5,
  sameCardPenalty: 0.05,
  ageBoostPerMinMax: 2.0
};

function probPickNextCard(allCards, progress, cycleSeen, lastId) {
  const now = Date.now();

  const weights = [];
  let total = 0;

  for (const card of allCards) {
    const id = getCardId(card);
    let w = probGetWeight(progress, id);

    if (!cycleSeen.has(id)) w = w * PROB_CFG.coverageBoost;

    if (lastId && id === lastId) w = w * PROB_CFG.sameCardPenalty;

    const rec = progress[id] || {};
    const lastSeenAt = Number(rec.lastSeenAt || 0);
    const ageMs = Math.max(0, now - lastSeenAt);
    const ageBoost = Math.min(PROB_CFG.ageBoostPerMinMax, ageMs / 60000);
    w = w * (1 + ageBoost);

    weights.push([card, id, w]);
    total += w;
  }

  if (total <= 0) return allCards[0] || null;

  let r = Math.random() * total;
  for (const [card, id, w] of weights) {
    r -= w;
    if (r <= 0) return card;
  }

  return weights[weights.length - 1][0] || null;
}

async function initStudy() {
  setStatus('Loading…');
  const cards = await loadActiveDeckCards();
  const custom = loadCustomCards();
  const allCards = cards.concat(custom);


  if (allCards.length === 0) {
    setStatus('No cards found');
    renderStudyCard(null, () => {});
    return;
  }

  let progress = loadProgress();

  let cycle = 1;
  let cycleSeen = new Set();
  let totalReviewed = 0;
  let lastId = null;

  function updateCounters() {
    const countEl = document.getElementById('card-count');
    if (countEl) {
      countEl.textContent = `Cycle ${cycle} — Seen ${cycleSeen.size}/${allCards.length} — Reviewed ${totalReviewed}`;
    }
  }

  function showNext() {
    if (allCards.length === 0) {
      setStatus('No cards found');
      renderStudyCard(null, () => {});
      return;
    }

    const card = probPickNextCard(allCards, progress, cycleSeen, lastId);
    if (!card) {
      setStatus('No cards available');
      renderStudyCard(null, () => {});
      return;
    }

    const id = getCardId(card);
    lastId = id;

    cycleSeen.add(id);
    if (cycleSeen.size >= allCards.length) {
      cycle += 1;
      cycleSeen = new Set();
    }

    setStatus('Ready');
    updateCounters();

    renderStudyCard(card, (grade) => {
      probUpdateAfterGrade(progress, id, grade);
      saveProgress(progress);

      totalReviewed += 1;
      updateCounters();
      showNext();
    });
  }

  updateCounters();
  showNext();

}

function initAdd() {
  const form = document.getElementById('card-form');
  const statusEl = document.getElementById('status');

  const prevHanzi = document.getElementById('preview-hanzi');
  const prevPinyin = document.getElementById('preview-pinyin');
  const prevEnglish = document.getElementById('preview-english');

  function setMsg(m) {
    if (statusEl) statusEl.textContent = m;
  }

  function getVal(name) {
    const el = form?.elements?.namedItem?.(name);
    if (!el) return '';
    const v = el.value;
    return typeof v === 'string' ? v.trim() : '';
  }
 
  document.addEventListener('click', (e) => {
    if (document.body?.dataset?.page !== 'add') return;

  const target = e.target;
  const el =
    target instanceof Element
      ? target
      : (target && target.parentElement ? target.parentElement : null);
  if (!el) return;

  const btn = el.closest('.tone-buttons button[data-tone]');
    if (!btn) return;

    const tone = Number(btn.getAttribute('data-tone'));
    setMsg('Tone ' + tone);
    if (![1, 2, 3, 4, 5].includes(tone)) return;

    const pinyinEl = document.getElementById('pinyin-field');
    if (!pinyinEl) return;

    pinyinEl.value = applyToneToLastSyllable(pinyinEl.value || '', tone);
    pinyinEl.dispatchEvent(new Event('input', { bubbles: true }));
    pinyinEl.focus();
  });

  function updatePreview() {
    const hanzi = getVal('hanzi') || '—';
    const pinyin = getVal('pinyin') || '—';
    const english = getVal('english') || '—';

    if (prevHanzi) prevHanzi.textContent = hanzi;
    if (prevPinyin) prevPinyin.textContent = pinyin;
    if (prevEnglish) prevEnglish.textContent = english;
  }

  if (!form) return;

  form.addEventListener('input', updatePreview);

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const hanzi = getVal('hanzi');
    const pinyin = getVal('pinyin');
    const english = getVal('english');
    const deck = getVal('deck') || 'Custom';
    const tagsRaw = getVal('tags');

    const examplePinyin = getVal('examplePinyin');
    const exampleEn = getVal('exampleEn');

    if (!hanzi || !pinyin || !english) {
      setMsg('Please fill Hanzi, Pinyin, and English.');
      return;
    }

    const tags = tagsRaw
      ? tagsRaw.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const card = {
      id: `custom-${nowMs()}`,
      hanzi,
      pinyin,
      english,
      deck,
      tags,
      examplePinyin,
      exampleEn
    };

    addCustomCard(card);
    setMsg('Saved.');

    form.reset();
    updatePreview();
  });

  updatePreview();
}

async function initHome() {
  const dueEl = document.getElementById('due-count');
  const totalEl = document.getElementById('total-count');
  const startBtn = document.getElementById('start-btn');

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      window.location.href = './study.html';
    });
  }

  setStatus('Loading…');

  const cards = await loadActiveDeckCards();
  const custom = loadCustomCards();
  const allCards = cards.concat(custom);

  const progress = loadProgress();

  if (totalEl) totalEl.textContent = String(allCards.length);

  let dueNow = 0;
  for (const card of allCards) {
    const id = getCardId(card);
    const rec = progress[id] || {};
    const w = Number(rec.w || 1);
    const seen = Number(rec.lastSeenAt || 0);

    if (!seen) {
      dueNow += 1;
      continue;
    }

    if (w > 1.2) {
      dueNow += 1;
      continue;
    }
  }

  if (dueEl) dueEl.textContent = String(dueNow);

  setStatus('Ready');
}

function initSettings() {
  const radios = Array.from(document.querySelectorAll('input[name="deckMode"]'));
  if (radios.length === 0) return;

  const current = localStorage.getItem('deckMode') || 'HSK1';
  for (const r of radios) r.checked = (r.value === current);

  for (const r of radios) {
    r.addEventListener('change', () => {
      if (!r.checked) return;
      localStorage.setItem('deckMode', r.value);
    });
  }
}

async function init() {
  setStatus('Loading…');

  // Home page
  if (document.getElementById('start-btn')) {
    await initHome();
    return;
  }

  if (document.querySelector('input[name="deckMode"]')) {
    initSettings();
    setStatus('Ready');
    return;
  }

  // Study page
  if (document.getElementById('study-root')) {
    await initStudy();
    return;
  }

  // Add page
  if (document.querySelector('form')) {
    initAdd();
    setStatus('Ready');
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

/* OC_END:appjs:top:v1 */
