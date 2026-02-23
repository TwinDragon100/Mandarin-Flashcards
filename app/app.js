function qs(sel) {
  return document.querySelector(sel);
}

function setStatus(text) {
  const el = qs('[data-status]');
  if (el) el.textContent = text;
}

async function init() {
  setStatus('Loading…');

  const page = document.body?.dataset?.page || '';

  setStatus('Ready');

  if (page) {
    console.log('Mandarin Flashcards page:', page);
  } else {
    console.log('Mandarin Flashcards loaded');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  init().catch((e) => {
    console.error(e);
    setStatus('Error loading app');
  });
});
