# Mandarin Flashcard PWA Specification

## Overview
- Goal: Local-first, offline-first Progressive Web App that helps learners study Mandarin tones and vocabulary via spaced flashcards.
- Platform: Installable PWA built with standard web tech (HTML, CSS, JS) and service workers for caching, no server dependency.
- Devices: Must work seamlessly on phone, tablet, and desktop browsers even without connectivity.
- Principles: All study data stays on the user’s device. Syncing is optional and out of scope.

## Offline-first Architecture
- Service worker pre-caches shell assets (`index.html`, JS bundle, CSS, icons, audio sprites if any) during first load.
- Runtime caching strategy: `CacheFirst` for static assets, `NetworkFirst` fallback for optional remote resources (none required).
- App shell loads even when offline, then reads data directly from IndexedDB.
- All write operations go to IndexedDB immediately; no network or cloud storage assumptions.
- Background sync not required; if added later, it must respect the same local-first pattern.

## Data Model (fields and types)
Each flashcard record stores the following fields:
- `id` (string, UUID or slug) – unique key.
- `hanzi` (string) – Chinese characters.
- `pinyin` (string) – tone-marked pinyin (e.g., "mā").
- `toneNumbers` (array of integers) – tone per syllable (1-4, 5 for neutral).
- `english` (string) – learner-friendly meaning.
- `tags` (array of strings) – e.g., ["HSK1", "greeting"].
- `deck` (string) – grouping name.
- `interval` (number, hours) – current review interval.
- `stability` (number, unitless) – ease factor (default 1.0).
- `due` (ISO date string) – next review timestamp.
- `lastReviewed` (ISO date string) – previous review time.
- `successStreak` (integer) – consecutive passes.
- `createdAt` / `updatedAt` (ISO date strings).

## IndexedDB Schema
- Database name: `mandarinFlashcards`.
- Version: start at 1.
- Object stores:
  1. `cards`
     - keyPath: `id`.
     - indexes: `deck`, `due`, `tags`, `createdAt`.
  2. `settings`
     - keyPath: `key` (e.g., "preferences", "toneColors").
  3. `migrations`
     - keyPath: `version` (int), stores applied migration metadata.
- All stores use `autoIncrement: false`.

## Weighting / Frequency Algorithm
Use a simplified SM-2 style formula tuned for local-only use.
- Given `quality` ∈ {0, 1} for fail/pass, update as follows:
  - `stabilityNew = max(0.8, stability + (0.1 - (1 - quality) * 0.2))`
  - `intervalNew =
      if quality == 0 then 12 (hours)
      else interval * (1 + stabilityNew)`
  - `successStreak = quality == 1 ? successStreak + 1 : 0`
  - `due = now + intervalNew hours`
- Clamp `intervalNew` to [12 hours, 720 hours (30 days)].
- Pseudocode:
```
function updateCard(card, quality) {
  const now = Date.now();
  const stabilityNew = Math.max(0.8, card.stability + (0.1 - (1 - quality) * 0.2));
  const intervalNew = quality === 0 ? 12 : card.interval * (1 + stabilityNew);
  const intervalClamped = clamp(intervalNew, 12, 720);
  return {
    ...card,
    stability: stabilityNew,
    interval: intervalClamped,
    successStreak: quality === 1 ? card.successStreak + 1 : 0,
    lastReviewed: now,
    due: now + hoursToMs(intervalClamped)
  };
}
```

## Card Selection Algorithm (Weighted Random, No Repeat)
1. Build `candidateCards = cards where due <= now`.
2. If empty, include the 5 soonest-due cards.
3. Compute weight for each card: `weight = 1 + max(0, now - due) / hoursToMs(1)` (every overdue hour adds weight).
4. Perform weighted random selection without replacement for the study session:
   - Use cumulative weights, draw random number in [0, totalWeight), pick card, remove it, repeat until session size reached.
5. Maintain a `sessionSeen` set to avoid repeats until session resets.

## Tone Handling and Tone Mark UI Behavior
- Display pinyin with tone marks using provided `pinyin` field.
- Highlight tones with consistent colors (e.g., T1=red, T2=orange, T3=green, T4=blue, T5=gray) configurable via settings.
- Tone Mark UI: when user holds or taps the tone selector, show radial or horizontal buttons for each tone number plus neutral. Selecting a tone inserts the correct diacritic into the current syllable.
- Provide quick toggle to reveal tone numbers for accessibility.

## Authoring UX (Add Card and Tone Selection UI)
- Add Card form fields: Hanzi (text), Pinyin (with tone helper), English meaning (text area), Deck (dropdown), Tags (chips), Notes (optional).
- Tone Selection UI: while typing Pinyin, user types base letters then taps tone buttons (1-4, neutral) to apply marks. Input auto-converts the latest vowel to the appropriate diacritic.
- Preview panel shows final card as learner will see it, including tone colors.
- Validation: require Hanzi, Pinyin, English. Warn if tones missing for multi-syllable words.

## Persistence and Migration
- All changes write through IndexedDB. After each successful write, update `updatedAt`.
- Migrations handled by bumping DB version; `upgrade` callback inspects `migrations` store to run idempotent scripts (e.g., add new fields, backfill defaults).
- Provide `export`/`import` via JSON for manual backups.

## Preload Data Format and Location
- File: `/Users/stevenwright/.openclaw/workspace/Mandarin/data/hsk1.json`.
- Format: JSON array of card objects matching the data model fields (minimum required fields: `id`, `hanzi`, `pinyin`, `toneNumbers`, `english`, `tags`, `deck`).
- On first run, if `cards` store is empty, load this file (bundled via build step) and insert entries.

## Security and Privacy Notes
- Store all data locally; no analytics, trackers, or remote logging.
- Avoid storing personal identifiers; only study content.
- Use HTTPS when served online to ensure service worker registration.
- Guard against XSS by sanitizing user-entered notes/tags when rendered.
- Provide clear delete/export options so users control their data.

## Testing Checklist
- [ ] Install PWA and run entirely offline (airplane mode) without errors.
- [ ] Add, edit, delete cards; confirm persistence after reload.
- [ ] Verify weighting algorithm schedules cards as expected (fail resets interval, pass grows interval).
- [ ] Confirm weighted random selection does not repeat cards within a session.
- [ ] Test tone input helper on mobile and desktop keyboards.
- [ ] Validate indexed data loads correctly after upgrading schema version.
- [ ] Import preload file on first launch when no cards exist.
- [ ] Ensure service worker updates assets and handles offline cache busting.
- [ ] Run accessibility audit (keyboard navigation, screen reader labels, tone color contrast).
- [ ] Confirm data export/import round-trips without loss.
