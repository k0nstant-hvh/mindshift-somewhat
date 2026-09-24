/**
 * MindShift: Student EQ & Reflection Dashboard
 * ------------------------------------------------------------
 * 100% client-side. All data lives in localStorage on this device.
 *
 * Module layout (top to bottom):
 *   1. Config & content      – moods, triggers, coping strategies
 *   2. Utilities             – DOM helpers, escaping, dates, ids
 *   3. Storage               – safe localStorage wrapper + entry sanitising
 *   4. State                 – single in-memory source of truth
 *   5. UI primitives         – toast, modal (bottom sheet), clipboard
 *   6. Check-in view         – mood/trigger chips, coping card, reflection form
 *   7. History view          – insights, search/filter, entry cards
 *   8. Data view             – theme, export/import, clear all
 *   9. Navigation & init
 */
(() => {
  'use strict';

  /* ==========================================================================
     1. CONFIG & CONTENT
     ========================================================================== */

  const APP_VERSION = '1.0.0';

  // NOTE: the theme key is also read by the inline script in index.html.
  const STORAGE_KEYS = {
    entries: 'mindshift.entries.v1',
    draft: 'mindshift.draft.v1',
    theme: 'mindshift.theme.v1',
  };

  const MAX_TEXT_LENGTH = 4000;
  const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
  const TEXT_FIELDS = ['awareness', 'inControl', 'outControl', 'action'];

  /** `heavy` moods feed the burnout check in the insights panel. */
  const MOODS = [
    { id: 'stressed',    label: 'Stressed',    emoji: '😣', color: '#f43f5e', heavy: true },
    { id: 'overwhelmed', label: 'Overwhelmed', emoji: '🌊', color: '#f97316', heavy: true },
    { id: 'anxious',     label: 'Anxious',     emoji: '😰', color: '#eab308', heavy: true },
    { id: 'frustrated',  label: 'Frustrated',  emoji: '😤', color: '#d946ef', heavy: true },
    { id: 'tired',       label: 'Tired',       emoji: '😴', color: '#6366f1', heavy: true },
    { id: 'calm',        label: 'Calm',        emoji: '😌', color: '#14b8a6', heavy: false },
    { id: 'focused',     label: 'Focused',     emoji: '🎯', color: '#0ea5e9', heavy: false },
    { id: 'motivated',   label: 'Motivated',   emoji: '🚀', color: '#22c55e', heavy: false },
  ];

  const TRIGGERS = [
    { id: 'exams',     label: 'Upcoming Exams',       emoji: '📝' },
    { id: 'deadlines', label: 'Deadlines (IA/EE/TOK)', emoji: '⏰' },
    { id: 'workload',  label: 'Homework Load',        emoji: '📚' },
    { id: 'cas',       label: 'CAS Commitments',      emoji: '🤝' },
    { id: 'peer',      label: 'Peer Pressure',        emoji: '👥' },
    { id: 'sleep',     label: 'Lack of Sleep',        emoji: '🌙' },
    { id: 'uni',       label: 'University Apps',      emoji: '🎓' },
    { id: 'family',    label: 'Family',               emoji: '🏠' },
    { id: 'social',    label: 'Social Media',         emoji: '📱' },
    { id: 'health',    label: 'Health',               emoji: '🩺' },
    { id: 'personal',  label: 'Personal',             emoji: '💭' },
  ];

  const INTENSITY_LABELS = ['', 'Mild', 'Noticeable', 'Moderate', 'Strong', 'Intense'];

  // Shared strategies that fit more than one mood.
  const GROUNDING_54321 = {
    id: 'grounding-54321',
    title: '5-4-3-2-1 Grounding',
    time: '3 min',
    summary: 'Pulls your attention out of the spiral and back into the present moment through your senses.',
    steps: [
      'Name 5 things you can see around you.',
      'Notice 4 things you can physically feel (chair, feet on the floor, sleeves…).',
      'Listen for 3 distinct sounds.',
      'Find 2 things you can smell and 1 thing you can taste.',
    ],
  };

  /** Evidence-informed EQ / mindfulness micro-strategies, grouped by mood. */
  const TIPS = {
    stressed: [
      {
        id: 's-478', title: '4-7-8 Breathing', time: '2 min',
        summary: 'A long, slow exhale activates your "rest and digest" nervous system and lowers your heart rate.',
        steps: [
          'Sit upright and rest the tip of your tongue just behind your top front teeth.',
          'Breathe in quietly through your nose for a count of 4.',
          'Hold your breath for a count of 7.',
          'Exhale fully through your mouth for a count of 8. Repeat for 4 cycles.',
        ],
      },
      {
        id: 's-box', title: 'Box Breathing', time: '2 min',
        summary: 'Used by athletes and pilots to stay steady under pressure — ideal right before an exam or presentation.',
        steps: [
          'Breathe in for 4 counts while tracing the first side of an imaginary square.',
          'Hold for 4 counts along the second side.',
          'Breathe out for 4 counts along the third side.',
          'Hold for 4 counts to close the box. Repeat 4 rounds.',
        ],
      },
      {
        id: 's-dump', title: '3-Minute Brain Dump', time: '3 min',
        summary: 'Stress feels bigger when it only lives in your head. Getting it onto paper frees up working memory.',
        steps: [
          'Set a 3-minute timer.',
          'Write every task, worry and thought down — no order, no editing.',
          'Circle the ONE item that would make tomorrow noticeably easier.',
          'Leave the rest on the page. It is safe there; you can come back to it.',
        ],
      },
      {
        id: 's-pmr', title: 'Quick Muscle Release', time: '4 min',
        summary: 'Progressive muscle relaxation teaches your body the difference between tension and ease.',
        steps: [
          'Clench both fists tightly for 5 seconds, then release for 10.',
          'Shrug your shoulders up to your ears for 5 seconds, then drop them.',
          'Scrunch your face and jaw for 5 seconds, then soften completely.',
          'Finish with three slow breaths and notice the warmth of released muscles.',
        ],
      },
    ],
    overwhelmed: [
      {
        id: 'o-shrink', title: 'Shrink the Next Step', time: '5 min',
        summary: 'Overwhelm comes from looking at the whole mountain. Only look at the next foothold.',
        steps: [
          'Pick the task causing you the most dread.',
          'Break it down until the first step takes under 10 minutes (e.g. "open the IA doc and write one heading").',
          'Do only that step — right now.',
          'Tick it off. Momentum beats motivation.',
        ],
      },
      {
        id: 'o-matrix', title: '5-Minute Priority Matrix', time: '5 min',
        summary: 'Sorting tasks by urgent vs. important stops you from trying to do everything at once.',
        steps: [
          'Draw a 2×2 grid: Urgent / Not urgent across the top, Important / Not important down the side.',
          'Drop every task into one of the four boxes.',
          'Do "Urgent + Important" first; schedule "Important + Not urgent" in your calendar.',
          'Delegate, postpone or drop what lands in "Not important".',
        ],
      },
      GROUNDING_54321,
      {
        id: 'o-ask', title: 'Ask for Help Early', time: '5 min',
        summary: 'Asking for support is an EQ strength, not a weakness. Teachers would rather hear from you now than later.',
        steps: [
          'Pick one person who could help: a subject teacher, your DP coordinator, a counsellor or a friend.',
          'Write a two-line message: what you are working on + what you need.',
          'Send it today.',
          'Remind yourself that clarifications and support exist for exactly this reason.',
        ],
      },
    ],
    anxious: [
      {
        id: 'a-sigh', title: 'Physiological Sigh', time: '1 min',
        summary: 'Two inhales followed by a long exhale is one of the fastest ways to calm your body in real time.',
        steps: [
          'Breathe in deeply through your nose.',
          'Without exhaling, take a second short "top-up" breath in.',
          'Let out a long, slow exhale through your mouth.',
          'Repeat 3–5 times and notice your shoulders drop.',
        ],
      },
      {
        id: 'a-evidence', title: 'Check the Evidence', time: '5 min',
        summary: 'Cognitive reframing: anxious thoughts are predictions, not facts. Test them like a scientist.',
        steps: [
          'Write down the anxious thought, e.g. "I\'m going to fail Paper 2."',
          'List the evidence for it and the evidence against it.',
          'Write a balanced version: "Paper 2 is hard, and my past-paper scores are improving."',
          'Read the balanced thought out loud once.',
        ],
      },
      {
        id: 'a-window', title: 'Worry Window', time: '10 min',
        summary: 'Give worries a scheduled appointment so they stop interrupting your study time.',
        steps: [
          'Choose a 10-minute slot later today — your "worry window".',
          'When a worry pops up before then, jot it down and tell yourself "not now, later".',
          'During the window, review the list and act on anything you can control.',
          'When the time is up, close the notebook and move on.',
        ],
      },
      GROUNDING_54321,
    ],
    frustrated: [
      {
        id: 'f-name', title: 'Name It to Tame It', time: '2 min',
        summary: 'Putting a precise label on an emotion measurably reduces its intensity (affect labelling).',
        steps: [
          'Complete the sentence: "I feel ___ because ___."',
          'Get more specific: annoyed? disappointed? embarrassed? treated unfairly?',
          'Rate the feeling from 1–10.',
          'Take three slow breaths and rate it again. Notice any shift.',
        ],
      },
      {
        id: 'f-yet', title: 'The Power of "Yet"', time: '3 min',
        summary: 'A growth mindset turns a setback into useful data instead of a verdict on your ability.',
        steps: [
          'Write down: "I can\'t do ___."',
          'Add one word at the end: "yet".',
          'Note one thing this attempt taught you.',
          'Pick one resource to try next: a past paper, a textbook section, or a teacher.',
        ],
      },
      {
        id: 'f-reset', title: 'Step Away, Then Return', time: '10 min',
        summary: 'Frustration narrows your thinking. A short change of scene restores problem-solving ability.',
        steps: [
          'Stop and bookmark exactly where you were.',
          'Change your environment for 10 minutes — a walk, fresh air, or one song.',
          'Come back with ONE specific question to answer.',
          'Still stuck after 15 minutes? Ask someone — that\'s efficient, not weak.',
        ],
      },
    ],
    tired: [
      {
        id: 't-nap', title: 'Power Nap (10–20 min)', time: '20 min',
        summary: 'A short nap restores alertness without the grogginess of falling into deep sleep.',
        steps: [
          'Set an alarm for 20 minutes — no longer.',
          'Lie down, close your eyes. Resting still counts even if you don\'t fall asleep.',
          'When the alarm rings, get up straight away.',
          'Splash water on your face and get some daylight to wake up fully.',
        ],
      },
      {
        id: 't-move', title: '5-Minute Movement Reset', time: '5 min',
        summary: 'Light movement boosts blood flow and alertness faster than another caffeine hit.',
        steps: [
          'Stand up and stretch your arms overhead for 30 seconds.',
          'Walk around, or take the stairs, for 2 minutes.',
          'Roll your shoulders and neck slowly in both directions.',
          'Drink a full glass of water before sitting back down.',
        ],
      },
      {
        id: 't-sleep', title: 'Protect Tonight\'s Sleep', time: '2 min',
        summary: 'Sleep is when your brain consolidates what you studied. Cutting it usually costs more than it gains.',
        steps: [
          'Set a "screens off" alarm 30–45 minutes before bed.',
          'Write tomorrow\'s top 3 tasks so your brain can let go of them.',
          'Charge your phone out of arm\'s reach.',
          'Aim for 8–10 hours — the recommended range for teenagers.',
        ],
      },
      {
        id: 't-pomodoro', title: 'Gentle Pomodoro', time: '30 min',
        summary: 'Short, bounded work blocks feel doable even when your energy is low.',
        steps: [
          'Pick one small task and work on it for 25 minutes.',
          'Take a real 5-minute break away from screens.',
          'After two rounds, check in honestly with your energy.',
          'If you\'re still exhausted, rest is the productive choice.',
        ],
      },
    ],
    calm: [
      {
        id: 'c-three', title: 'Three Good Things', time: '3 min',
        summary: 'Noticing what went well builds resilience you can draw on during harder weeks.',
        steps: [
          'Write down three things that went well today — big or small.',
          'For each one, note why it happened.',
          'Notice the part you played in it.',
        ],
      },
      {
        id: 'c-plan', title: 'Plan From Calm', time: '5 min',
        summary: 'Calm moments are the best time to prepare for stressful ones.',
        steps: [
          'Look at your next 7 days.',
          'Block time for your biggest upcoming deadline.',
          'Add at least one rest or fun block — and protect it.',
          'Write one if–then plan: "If I start to feel overwhelmed, then I will ___."',
        ],
      },
      {
        id: 'c-savour', title: 'Savour the Moment', time: '2 min',
        summary: 'Deliberately noticing calm helps your brain find its way back to it later.',
        steps: [
          'Pause and notice where you feel calm in your body.',
          'Take three slow, easy breaths.',
          'Name what helped you get here so you can repeat it.',
        ],
      },
    ],
    focused: [
      {
        id: 'fo-flow', title: 'Protect Your Flow', time: '1 min',
        summary: 'Focus is precious — remove the easiest ways for it to be interrupted.',
        steps: [
          'Put your phone in another room or switch on Do Not Disturb.',
          'Close every tab unrelated to the current task.',
          'Keep a "distraction list" on paper: write stray thoughts down and keep going.',
          'Decide your stop time now.',
        ],
      },
      {
        id: 'fo-sprint', title: 'Deep Work Sprint', time: '50 min',
        summary: 'Channel focus into one clearly-defined outcome instead of scattered busy-work.',
        steps: [
          'Define one concrete outcome, e.g. "draft the IA evaluation section".',
          'Work on only that for 45–50 minutes.',
          'Take a 10-minute break away from your desk.',
          'Log what you finished — it builds momentum for next time.',
        ],
      },
      {
        id: 'fo-recall', title: 'Active Recall Boost', time: '15 min',
        summary: 'Testing yourself strengthens memory far more than re-reading notes.',
        steps: [
          'Close your notes.',
          'Write or say out loud everything you remember about the topic.',
          'Open your notes and mark the gaps.',
          'Turn each gap into a flashcard or exam-style question.',
        ],
      },
    ],
    motivated: [
      {
        id: 'm-frog', title: 'Eat the Frog', time: '25 min',
        summary: 'Use this energy on the task you\'ve been avoiding — everything after it feels easier.',
        steps: [
          'Identify your hardest, most important task.',
          'Start it before anything else, for just 25 minutes.',
          'Ride the momentum or stop guilt-free when the timer ends.',
        ],
      },
      {
        id: 'm-ifthen', title: 'If–Then Plan', time: '3 min',
        summary: 'Implementation intentions ("if X, then I will Y") make follow-through far more likely.',
        steps: [
          'Pick one goal for this week.',
          'Write: "If it\'s [time/place], then I will [specific action]."',
          'Add it to your calendar.',
          'Tell a friend for extra accountability.',
        ],
      },
      {
        id: 'm-pace', title: 'Bank Energy for Later', time: '2 min',
        summary: 'Motivation is a great wave — ride it without burning out.',
        steps: [
          'Set a finish time before you start.',
          'Schedule something restful or fun afterwards.',
          'Note what made you motivated today so you can recreate it.',
        ],
      },
    ],
  };

  const MOOD_BY_ID = Object.fromEntries(MOODS.map((m) => [m.id, m]));
  const TRIGGER_BY_ID = Object.fromEntries(TRIGGERS.map((t) => [t.id, t]));
  const TIP_BY_ID = Object.fromEntries(Object.values(TIPS).flat().map((t) => [t.id, t]));

  const ICONS = {
    shuffle: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99',
    copy: 'M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184',
    edit: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125',
    trash: 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0',
    chevron: 'M19.5 8.25l-7.5 7.5-7.5-7.5',
  };

  /* ==========================================================================
     2. UTILITIES
     ========================================================================== */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  /** Escape any user-supplied text before inserting it into HTML templates. */
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

  const icon = (name, cls = 'w-4 h-4') =>
    `<svg class="${cls}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="${ICONS[name]}"/></svg>`;

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const uid = () =>
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  const debounce = (fn, wait) => {
    let t;
    const debounced = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
    debounced.flush = () => { clearTimeout(t); fn(); };
    return debounced;
  };

  const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];

  /** Local-time YYYY-MM-DD key (avoids UTC off-by-one around midnight). */
  const dateKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const daysAgo = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d; };

  // The UI is in English, so dates use the browser's English variant (en-US, en-GB…)
  // or fall back to en-GB, keeping copied journal text in a single language.
  const LOCALE = (navigator.languages || [navigator.language]).find((l) => /^en\b/i.test(l || '')) || 'en-GB';

  const fmt = {
    time: new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' }),
    day: new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }),
    dayShort: new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' }),
    dayYear: new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }),
    weekdayLetter: new Intl.DateTimeFormat(LOCALE, { weekday: 'narrow' }),
    full: new Intl.DateTimeFormat(LOCALE, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
  };

  /** "Today", "Yesterday", or a formatted day name. */
  function dayLabel(date) {
    const key = dateKey(date);
    if (key === dateKey(daysAgo(0))) return 'Today';
    if (key === dateKey(daysAgo(1))) return 'Yesterday';
    return date.getFullYear() === new Date().getFullYear() ? fmt.day.format(date) : fmt.dayYear.format(date);
  }

  const relativeDateTime = (iso) => { const d = new Date(iso); return `${dayLabel(d)} · ${fmt.time.format(d)}`; };

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  /* ==========================================================================
     3. STORAGE
     ========================================================================== */

  const Store = {
    available: (() => {
      try {
        const k = '__mindshift_test__';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return true;
      } catch {
        return false;
      }
    })(),

    read(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },

    write(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (err) {
        console.error('[MindShift] Failed to write to localStorage', err);
        return false;
      }
    },

    remove(key) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    },
  };

  const emptyForm = () => ({
    mood: null,
    intensity: 3,
    triggers: [],
    awareness: '',
    inControl: '',
    outControl: '',
    action: '',
    tipId: null,
  });

  const cleanText = (v) => (typeof v === 'string' ? v.slice(0, MAX_TEXT_LENGTH) : '');

  /**
   * Validate & normalise one entry (from storage or an imported file).
   * Returns null when the record is unusable. Never trust stored/imported data.
   */
  function sanitizeEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!MOOD_BY_ID[raw.mood]) return null;

    const created = new Date(raw.createdAt);
    if (Number.isNaN(created.getTime())) return null;

    const updated = raw.updatedAt ? new Date(raw.updatedAt) : null;

    return {
      id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 64) : uid(),
      createdAt: created.toISOString(),
      updatedAt: updated && !Number.isNaN(updated.getTime()) ? updated.toISOString() : null,
      mood: raw.mood,
      intensity: clamp(parseInt(raw.intensity, 10) || 3, 1, 5),
      triggers: Array.isArray(raw.triggers) ? [...new Set(raw.triggers.filter((t) => TRIGGER_BY_ID[t]))] : [],
      awareness: cleanText(raw.awareness),
      inControl: cleanText(raw.inControl),
      outControl: cleanText(raw.outControl),
      action: cleanText(raw.action),
      tipId: TIP_BY_ID[raw.tipId] ? raw.tipId : null,
    };
  }

  function loadEntries() {
    const raw = Store.read(STORAGE_KEYS.entries, []);
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    return raw.map(sanitizeEntry).filter((e) => e && !seen.has(e.id) && seen.add(e.id));
  }

  function persistEntries() {
    const ok = Store.write(STORAGE_KEYS.entries, state.entries);
    if (!ok) toast('Could not save. Storage may be full or disabled.', { type: 'error', duration: 5000 });
    return ok;
  }

  /** Draft = the unsaved new-entry form. Not used while editing an old entry. */
  function loadDraft() {
    const d = Store.read(STORAGE_KEYS.draft, null);
    if (!d || typeof d !== 'object') return null;
    const form = emptyForm();
    form.mood = MOOD_BY_ID[d.mood] ? d.mood : null;
    form.intensity = clamp(parseInt(d.intensity, 10) || 3, 1, 5);
    form.triggers = Array.isArray(d.triggers) ? d.triggers.filter((t) => TRIGGER_BY_ID[t]) : [];
    TEXT_FIELDS.forEach((f) => { form[f] = cleanText(d[f]); });
    form.tipId = TIP_BY_ID[d.tipId] ? d.tipId : null;
    return formHasContent(form) ? form : null;
  }

  const saveDraft = debounce(() => {
    if (state.editingId) return;
    if (formHasContent(state.form)) Store.write(STORAGE_KEYS.draft, state.form);
    else Store.remove(STORAGE_KEYS.draft);
  }, 400);

  /* ==========================================================================
     4. STATE
     ========================================================================== */

  const state = {
    entries: [],
    form: emptyForm(),
    editingId: null,
    view: 'checkin',
    historyQuery: '',
    historyMood: 'all',
    expandedId: null,
    highlightId: null,
  };

  const formHasContent = (f) => Boolean(f.mood || f.triggers.length || TEXT_FIELDS.some((k) => f[k].trim()));
  const formHasReflection = (f) => TEXT_FIELDS.some((k) => f[k].trim());
  const sortedEntries = () => [...state.entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const findEntry = (id) => state.entries.find((e) => e.id === id);

  /* ==========================================================================
     5. UI PRIMITIVES — toast, modal, clipboard
     ========================================================================== */

  const els = {};

  let toastTimer = null;

  /**
   * Show a transient message. Optional action button (e.g. "Undo").
   * @param {string} message
   * @param {{type?: 'info'|'error', actionLabel?: string, onAction?: Function, duration?: number}} [opts]
   */
  function toast(message, { type = 'info', actionLabel, onAction, duration = 2800 } = {}) {
    clearTimeout(toastTimer);
    els.toastRegion.innerHTML = '';

    const el = document.createElement('div');
    el.className = `toast${type === 'error' ? ' toast-error' : ''}`;

    const text = document.createElement('span');
    text.textContent = message;
    el.append(text);

    const dismiss = () => {
      clearTimeout(toastTimer);
      el.classList.add('toast-out');
      setTimeout(() => el.remove(), 200);
    };

    if (actionLabel && onAction) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toast-action';
      btn.textContent = actionLabel;
      btn.addEventListener('click', () => { dismiss(); onAction(); });
      el.append(btn);
    }

    els.toastRegion.append(el);
    toastTimer = setTimeout(dismiss, duration);
  }

  let modalResolve = null;
  let modalReturnFocus = null;

  /**
   * Bottom-sheet dialog. Resolves true (confirm) or false (cancel/dismiss).
   * `body` may be a string (rendered as text) or a DOM node.
   */
  function openModal({ title, body, confirmText = 'OK', cancelText = 'Cancel', danger = false, hideCancel = false }) {
    closeModal(false);
    modalReturnFocus = document.activeElement;

    els.modalTitle.textContent = title;
    els.modalBody.replaceChildren();
    if (typeof body === 'string') {
      const p = document.createElement('p');
      p.textContent = body;
      els.modalBody.append(p);
    } else if (body) {
      els.modalBody.append(body);
    }

    els.modalConfirm.textContent = confirmText;
    els.modalConfirm.className = `btn ${danger ? 'btn-danger-solid' : 'btn-primary'}`;
    els.modalConfirm.parentElement.classList.toggle('grid-cols-2', !hideCancel);
    els.modalCancel.hidden = hideCancel;
    els.modalCancel.textContent = cancelText;

    els.modal.hidden = false;
    requestAnimationFrame(() => (danger ? els.modalCancel : els.modalConfirm).focus());

    return new Promise((resolve) => { modalResolve = resolve; });
  }

  function closeModal(result) {
    if (els.modal.hidden) return;
    els.modal.hidden = true;
    const resolve = modalResolve;
    modalResolve = null;
    if (resolve) resolve(result);
    if (modalReturnFocus && typeof modalReturnFocus.focus === 'function') modalReturnFocus.focus();
  }

  /** Keep keyboard focus inside the open modal. */
  function trapModalFocus(e) {
    if (els.modal.hidden || e.key !== 'Tab') return;
    const focusables = $$('button:not([hidden]), textarea, [tabindex]:not([tabindex="-1"])', els.modal)
      .filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /** Copy text; falls back to execCommand, then to a manual-copy sheet. */
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* fall through */ }

    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }

  async function copyReflection(entryLike) {
    const text = formatForJournal(entryLike);
    if (await copyText(text)) {
      toast('Copied! Paste it into your CAS journal or Toddle 📋');
      return;
    }
    // Clipboard blocked: show the text so the student can copy it manually.
    const ta = document.createElement('textarea');
    ta.className = 'field modal-textarea';
    ta.readOnly = true;
    ta.value = text;
    const hint = document.createElement('p');
    hint.textContent = 'Your browser blocked automatic copying. Select the text below and copy it manually.';
    const wrap = document.createElement('div');
    wrap.append(hint, ta);
    const opened = openModal({ title: 'Copy your reflection', body: wrap, confirmText: 'Done', hideCancel: true });
    requestAnimationFrame(() => { ta.focus(); ta.select(); });
    await opened;
  }

  /** Format an entry as a clean, plain-text snippet for CAS / Toddle journals. */
  function formatForJournal(e) {
    const mood = MOOD_BY_ID[e.mood];
    const tip = e.tipId ? TIP_BY_ID[e.tipId] : null;
    const or = (s) => (s && s.trim()) || '—';
    const lines = [`Reflection — ${fmt.full.format(new Date(e.createdAt))}`, ''];

    if (mood) lines.push(`Emotion: ${mood.label} (intensity ${e.intensity}/5 · ${INTENSITY_LABELS[e.intensity]})`);
    if (e.triggers.length) lines.push(`Triggers: ${e.triggers.map((t) => TRIGGER_BY_ID[t].label).join(', ')}`);
    if (mood || e.triggers.length) lines.push('');

    lines.push(
      '1. Awareness — What am I feeling right now and why?',
      or(e.awareness),
      '',
      '2. Analysis — What is within my control, and what is outside of it?',
      `• Within my control: ${or(e.inControl)}`,
      `• Outside my control: ${or(e.outControl)}`,
      '',
      '3. Action Plan — One constructive micro-action I can take today:',
      or(e.action),
    );

    if (tip) lines.push('', `Coping strategy: ${tip.title} — ${tip.summary}`);
    return lines.join('\n');
  }

  /* ==========================================================================
     6. CHECK-IN VIEW
     ========================================================================== */

  function buildMoodGrid() {
    els.moodGrid.innerHTML = MOODS.map((m) => `
      <button type="button" class="mood-chip" data-mood="${m.id}" style="--mood:${m.color}" aria-pressed="false">
        <span class="emoji" aria-hidden="true">${m.emoji}</span>
        <span>${m.label}</span>
        <span class="dot" aria-hidden="true"></span>
      </button>`).join('');
  }

  function buildTriggerList() {
    els.triggerList.innerHTML = TRIGGERS.map((t) => `
      <button type="button" class="trigger-chip" data-trigger="${t.id}" aria-pressed="false">
        <span aria-hidden="true">${t.emoji}</span>${escapeHtml(t.label)}
      </button>`).join('');
  }

  function renderMoodSelection() {
    const { mood } = state.form;
    $$('.mood-chip', els.moodGrid).forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.mood === mood)));
    // Tints the intensity slider with the chosen mood colour.
    if (mood) els.checkinView.style.setProperty('--mood', MOOD_BY_ID[mood].color);
    else els.checkinView.style.removeProperty('--mood');
  }

  function renderTriggerSelection() {
    const selected = new Set(state.form.triggers);
    $$('.trigger-chip', els.triggerList).forEach((btn) => btn.setAttribute('aria-pressed', String(selected.has(btn.dataset.trigger))));
  }

  function renderIntensity() {
    const n = state.form.intensity;
    els.intensity.value = String(n);
    els.intensityValue.textContent = `${n} / 5 · ${INTENSITY_LABELS[n]}`;
    els.intensity.setAttribute('aria-valuetext', `${n} of 5, ${INTENSITY_LABELS[n]}`);
  }

  /** Pick a random tip for a mood, avoiding the one currently shown. */
  function pickTip(moodId, excludeId = null) {
    const list = TIPS[moodId] || [];
    const options = list.length > 1 ? list.filter((t) => t.id !== excludeId) : list;
    return options.length ? pickRandom(options) : null;
  }

  function renderCopingCard() {
    const { mood, tipId } = state.form;
    const tip = tipId && TIP_BY_ID[tipId];
    if (!mood || !tip) {
      els.copingCard.hidden = true;
      els.copingCard.innerHTML = '';
      return;
    }
    const m = MOOD_BY_ID[mood];
    els.copingCard.style.setProperty('--mood', m.color);
    els.copingCard.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <span class="coping-badge"><span aria-hidden="true">✨</span> Try this now · ${escapeHtml(tip.time)}</span>
        <button type="button" class="btn btn-secondary btn-sm !px-2.5" data-action="shuffle-tip" aria-label="Show another strategy">
          ${icon('shuffle')}<span>Another</span>
        </button>
      </div>
      <h3 class="text-lg font-bold mt-3 leading-snug">${escapeHtml(tip.title)}</h3>
      <p class="text-sm muted-strong mt-1">${escapeHtml(tip.summary)}</p>
      <ol class="coping-steps">${tip.steps.map((s) => `<li><span>${escapeHtml(s)}</span></li>`).join('')}</ol>
    `;
    // Only animate when the card first appears, not on every re-render.
    if (els.copingCard.hidden) els.copingCard.hidden = false;
  }

  function renderEditBanner() {
    const entry = state.editingId && findEntry(state.editingId);
    els.editBanner.hidden = !entry;
    els.saveBtnLabel.textContent = entry ? 'Update Reflection' : 'Save Reflection';
    if (entry) els.editBannerDate.textContent = `From ${relativeDateTime(entry.createdAt)}`;
  }

  function autoGrow(ta) {
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight + 2}px`;
  }

  function renderGreeting() {
    const h = new Date().getHours();
    const greeting =
      h < 5 ? 'Late night check-in 🌙' :
      h < 12 ? 'Good morning ☀️' :
      h < 17 ? 'Good afternoon 🌤️' :
      h < 22 ? 'Good evening 🌆' : 'Late night check-in 🌙';
    els.greeting.textContent = greeting;
    els.todayDate.textContent = fmt.day.format(new Date());
  }

  /** Sync every form control from state.form. */
  function renderForm() {
    renderMoodSelection();
    renderTriggerSelection();
    renderIntensity();
    els.textareas.forEach((ta) => {
      ta.value = state.form[ta.dataset.field];
      autoGrow(ta);
    });
    renderCopingCard();
    renderEditBanner();
  }

  function selectMood(moodId) {
    const f = state.form;
    if (f.mood === moodId) {
      // Tapping the selected mood again clears it.
      f.mood = null;
      f.tipId = null;
    } else {
      f.mood = moodId;
      f.tipId = pickTip(moodId)?.id ?? null;
    }
    renderMoodSelection();
    renderCopingCard();
    saveDraft();
  }

  function toggleTrigger(triggerId) {
    const set = new Set(state.form.triggers);
    if (set.has(triggerId)) set.delete(triggerId); else set.add(triggerId);
    // Keep the canonical order from TRIGGERS.
    state.form.triggers = TRIGGERS.map((t) => t.id).filter((id) => set.has(id));
    renderTriggerSelection();
    saveDraft();
  }

  function shuffleTip() {
    const { mood, tipId } = state.form;
    if (!mood) return;
    state.form.tipId = pickTip(mood, tipId)?.id ?? null;
    renderCopingCard();
    saveDraft();
  }

  function saveEntry() {
    const f = state.form;
    if (!f.mood) {
      toast('Pick how you\'re feeling first 🙂');
      els.moodGrid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('.mood-chip', els.moodGrid)?.focus({ preventScroll: true });
      return;
    }
    if (!formHasReflection(f)) {
      toast('Add a few words to at least one reflection step.');
      els.textareas[0].focus();
      return;
    }

    const now = new Date().toISOString();
    const fields = {
      mood: f.mood,
      intensity: f.intensity,
      triggers: [...f.triggers],
      awareness: f.awareness.trim(),
      inControl: f.inControl.trim(),
      outControl: f.outControl.trim(),
      action: f.action.trim(),
      tipId: f.tipId,
    };

    let savedId;
    const wasEditing = Boolean(state.editingId);
    if (wasEditing) {
      const entry = findEntry(state.editingId);
      if (!entry) { endEdit(); toast('That reflection no longer exists.', { type: 'error' }); return; }
      Object.assign(entry, fields, { updatedAt: now });
      savedId = entry.id;
    } else {
      savedId = uid();
      state.entries.push({ id: savedId, createdAt: now, updatedAt: null, ...fields });
    }

    if (!persistEntries()) return;

    if (wasEditing) {
      state.editingId = null;
      state.form = loadDraft() || emptyForm(); // restore any in-progress new draft
    } else {
      Store.remove(STORAGE_KEYS.draft);
      state.form = emptyForm();
    }

    renderForm();
    state.expandedId = savedId;
    state.highlightId = savedId;
    switchView('history');
    updateStreakPill();
    toast(wasEditing ? 'Reflection updated ✅' : 'Reflection saved. Nice work 💜');
  }

  function startEdit(id) {
    const entry = findEntry(id);
    if (!entry) return;
    if (!state.editingId) saveDraft.flush(); // make sure the new-entry draft is stored first
    state.editingId = id;
    state.form = {
      mood: entry.mood,
      intensity: entry.intensity,
      triggers: [...entry.triggers],
      awareness: entry.awareness,
      inControl: entry.inControl,
      outControl: entry.outControl,
      action: entry.action,
      tipId: entry.tipId || pickTip(entry.mood)?.id || null,
    };
    renderForm();
    switchView('checkin');
  }

  function endEdit() {
    state.editingId = null;
    state.form = loadDraft() || emptyForm();
    renderForm();
  }

  function clearForm() {
    if (!formHasContent(state.form)) return;
    const previous = cloneForm(state.form);
    state.form = emptyForm();
    renderForm();
    saveDraft();
    toast('Form cleared', {
      actionLabel: 'Undo',
      duration: 5000,
      onAction: () => { state.form = previous; renderForm(); saveDraft(); },
    });
  }

  const cloneForm = (form) => ({ ...form, triggers: [...form.triggers] });

  /** Copy the entry currently in the form (new or being edited). */
  function copyCurrent() {
    const f = state.form;
    if (!formHasContent(f)) {
      toast('Nothing to copy yet. Start with your mood 🙂');
      return;
    }
    const editing = state.editingId && findEntry(state.editingId);
    copyReflection({ ...f, createdAt: editing ? editing.createdAt : new Date().toISOString() });
  }

  /* ==========================================================================
     7. HISTORY VIEW
     ========================================================================== */

  function computeInsights() {
    const entries = state.entries;
    const byDay = new Map();
    entries.forEach((e) => {
      const key = dateKey(new Date(e.createdAt));
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(e);
    });

    // Streak: consecutive days with ≥1 entry, ending today (or yesterday if today is still open).
    let streak = 0;
    let offset = byDay.has(dateKey(daysAgo(0))) ? 0 : 1;
    while (byDay.has(dateKey(daysAgo(offset)))) { streak += 1; offset += 1; }

    // Last 7 days strip: show the latest mood logged each day.
    const week = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = daysAgo(i);
      const dayEntries = (byDay.get(dateKey(d)) || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      week.push({ date: d, isToday: i === 0, latest: dayEntries[0] || null, count: dayEntries.length });
    }

    const weekStart = daysAgo(6).getTime();
    const monthStart = daysAgo(29).getTime();
    const recent = entries.filter((e) => new Date(e.createdAt).getTime() >= weekStart);
    const month = entries.filter((e) => new Date(e.createdAt).getTime() >= monthStart);

    const countBy = (list, pick) => {
      const counts = new Map();
      list.forEach((item) => [].concat(pick(item)).forEach((k) => counts.set(k, (counts.get(k) || 0) + 1)));
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || null;
    };

    const topMood = countBy(recent, (e) => e.mood);
    const topTrigger = countBy(month, (e) => e.triggers);

    // Burnout early-warning: several intense, heavy check-ins this week.
    const heavyIntense = recent.filter((e) => MOOD_BY_ID[e.mood].heavy && e.intensity >= 4).length;

    return { total: entries.length, streak, week, topMood, topTrigger, heavyIntense };
  }

  function renderInsights() {
    const ins = computeInsights();
    const topMood = ins.topMood && MOOD_BY_ID[ins.topMood[0]];
    const topTrigger = ins.topTrigger && TRIGGER_BY_ID[ins.topTrigger[0]];

    const weekHtml = ins.week.map((d) => {
      const m = d.latest && MOOD_BY_ID[d.latest.mood];
      const label = `${fmt.dayShort.format(d.date)}: ${m ? `${m.label}${d.count > 1 ? ` (+${d.count - 1} more)` : ''}` : 'no check-in'}`;
      return `
        <div>
          <div class="week-day${m ? ' has-entry' : ''}${d.isToday ? ' is-today' : ''}" ${m ? `style="--mood:${m.color}"` : ''} title="${escapeHtml(label)}" role="img" aria-label="${escapeHtml(label)}">${m ? m.emoji : ''}</div>
          <div class="week-label" aria-hidden="true">${escapeHtml(fmt.weekdayLetter.format(d.date))}</div>
        </div>`;
    }).join('');

    els.insights.innerHTML = `
      <div class="grid grid-cols-3 gap-2">
        <div class="stat"><div class="stat-value">${ins.total}</div><div class="stat-label">Reflections</div></div>
        <div class="stat"><div class="stat-value">${ins.streak}${ins.streak ? ' 🔥' : ''}</div><div class="stat-label">Day streak</div></div>
        <div class="stat"><div class="stat-value">${topMood ? topMood.emoji : '—'}</div><div class="stat-label truncate">${topMood ? `${escapeHtml(topMood.label)} · top 7d` : 'Top mood · 7d'}</div></div>
      </div>
      <div class="mt-4">
        <p class="text-xs font-semibold muted mb-2">Last 7 days</p>
        <div class="week-strip">${weekHtml}</div>
      </div>
      ${topTrigger ? `<p class="text-[13px] muted-strong mt-4">Most common trigger this month: <strong>${topTrigger.emoji} ${escapeHtml(topTrigger.label)}</strong> (${ins.topTrigger[1]}×)</p>` : ''}
      ${ins.heavyIntense >= 3 ? `
        <div class="care-note" role="note">
          <span aria-hidden="true">🫶</span>
          <span>You've logged <strong>${ins.heavyIntense} intense, heavy check-ins</strong> this week. That's a signal worth listening to. Protect your sleep, lighten one commitment if you can, and consider talking to your counsellor or DP coordinator.</span>
        </div>` : ''}
    `;
  }

  function buildHistoryFilter() {
    els.historyFilter.innerHTML = `<option value="all">All moods</option>${MOODS.map((m) => `<option value="${m.id}">${m.emoji} ${m.label}</option>`).join('')}`;
  }

  function entryMatches(e, query) {
    if (state.historyMood !== 'all' && e.mood !== state.historyMood) return false;
    if (!query) return true;
    const haystack = [
      MOOD_BY_ID[e.mood].label,
      ...e.triggers.map((t) => TRIGGER_BY_ID[t].label),
      ...TEXT_FIELDS.map((k) => e[k]),
    ].join(' ').toLowerCase();
    return haystack.includes(query);
  }

  function entryCardHtml(e) {
    const m = MOOD_BY_ID[e.mood];
    const tip = e.tipId && TIP_BY_ID[e.tipId];
    const expanded = state.expandedId === e.id;
    const preview = e.action ? `→ ${e.action}` : (e.awareness || e.inControl || e.outControl);
    const dots = [1, 2, 3, 4, 5].map((i) => `<i class="${i <= e.intensity ? 'on' : ''}"></i>`).join('');
    const section = (title, text) => (text ? `<div class="entry-section"><h4>${title}</h4><p>${escapeHtml(text)}</p></div>` : '');
    const bodyId = `entry-body-${escapeHtml(e.id)}`;

    return `
      <article class="entry-card${state.highlightId === e.id ? ' is-highlighted' : ''}" style="--mood:${m.color}" data-id="${escapeHtml(e.id)}" data-expanded="${expanded}">
        <button type="button" class="entry-summary" data-action="toggle" aria-expanded="${expanded}" aria-controls="${bodyId}">
          <span class="entry-emoji" aria-hidden="true">${m.emoji}</span>
          <span class="flex-1 min-w-0 block">
            <span class="flex items-center justify-between gap-2">
              <span class="font-semibold">${m.label}</span>
              <span class="text-xs muted whitespace-nowrap">${fmt.time.format(new Date(e.createdAt))}${e.updatedAt ? ' · edited' : ''}</span>
            </span>
            <span class="intensity-dots" role="img" aria-label="Intensity ${e.intensity} of 5">${dots}</span>
            ${preview ? `<span class="entry-preview">${escapeHtml(preview)}</span>` : ''}
          </span>
          ${icon('chevron', 'entry-chevron')}
        </button>
        <div class="entry-body" id="${bodyId}" ${expanded ? '' : 'hidden'}>
          ${e.triggers.length ? `<div class="flex flex-wrap gap-1.5 pb-3">${e.triggers.map((t) => `<span class="tag">${TRIGGER_BY_ID[t].emoji} ${escapeHtml(TRIGGER_BY_ID[t].label)}</span>`).join('')}</div>` : ''}
          ${section('1 · Awareness', e.awareness)}
          ${section('2 · Within my control', e.inControl)}
          ${section('2 · Outside my control', e.outControl)}
          ${section('3 · Micro-action', e.action)}
          ${tip ? `<div class="entry-section"><h4>Coping strategy</h4><p>✨ ${escapeHtml(tip.title)}</p></div>` : ''}
          <div class="grid grid-cols-[1fr_auto_auto] gap-2 pt-2">
            <button type="button" class="btn btn-secondary btn-sm" data-action="copy">${icon('copy')}<span>Copy for CAS</span></button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="edit" aria-label="Edit reflection">${icon('edit')}<span class="max-[360px]:hidden">Edit</span></button>
            <button type="button" class="btn btn-danger btn-sm" data-action="delete" aria-label="Delete reflection">${icon('trash')}</button>
          </div>
        </div>
      </article>`;
  }

  function renderHistory() {
    renderInsights();

    if (!state.entries.length) {
      els.historyList.innerHTML = `
        <div class="empty-state">
          <div class="text-4xl mb-2" aria-hidden="true">🌱</div>
          <p class="font-semibold">No reflections yet</p>
          <p class="text-sm muted mt-1 mb-4">Your first check-in takes about 3 minutes.</p>
          <button type="button" class="btn btn-primary btn-sm" data-action="go-checkin">Start a check-in</button>
        </div>`;
      return;
    }

    const query = state.historyQuery.trim().toLowerCase();
    const list = sortedEntries().filter((e) => entryMatches(e, query));

    if (!list.length) {
      els.historyList.innerHTML = `
        <div class="empty-state">
          <div class="text-3xl mb-2" aria-hidden="true">🔎</div>
          <p class="font-semibold">No matching reflections</p>
          <p class="text-sm muted mt-1">Try a different search or mood filter.</p>
        </div>`;
      return;
    }

    // Group by local calendar day.
    const groups = [];
    list.forEach((e) => {
      const d = new Date(e.createdAt);
      const key = dateKey(d);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(e);
      else groups.push({ key, label: dayLabel(d), items: [e] });
    });

    els.historyList.innerHTML = groups.map((g) => `
      <div>
        <h3 class="day-heading">${escapeHtml(g.label)}</h3>
        <div class="space-y-2.5">${g.items.map(entryCardHtml).join('')}</div>
      </div>`).join('');

    if (state.highlightId) {
      const card = els.historyList.querySelector(`[data-id="${CSS.escape(state.highlightId)}"]`);
      state.highlightId = null;
      if (card) requestAnimationFrame(() => card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    }
  }

  function toggleEntry(card) {
    const id = card.dataset.id;
    const expand = card.dataset.expanded !== 'true';

    // Collapse any other open card (accordion behaviour).
    $$('.entry-card[data-expanded="true"]', els.historyList).forEach((other) => {
      if (other !== card) setCardExpanded(other, false);
    });
    setCardExpanded(card, expand);
    state.expandedId = expand ? id : null;
  }

  function setCardExpanded(card, expanded) {
    card.dataset.expanded = String(expanded);
    $('.entry-summary', card).setAttribute('aria-expanded', String(expanded));
    $('.entry-body', card).hidden = !expanded;
  }

  function deleteEntry(id) {
    const index = state.entries.findIndex((e) => e.id === id);
    if (index < 0) return;
    const [removed] = state.entries.splice(index, 1);
    persistEntries();
    if (state.editingId === id) endEdit();
    renderHistory();
    updateStreakPill();

    toast('Reflection deleted', {
      actionLabel: 'Undo',
      duration: 6000,
      onAction: () => {
        if (findEntry(removed.id)) return;
        state.entries.push(removed);
        persistEntries();
        state.expandedId = removed.id;
        renderHistory();
        updateStreakPill();
        toast('Reflection restored');
      },
    });
  }

  function handleHistoryClick(e) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === 'go-checkin') { switchView('checkin'); return; }

    const card = actionEl.closest('.entry-card');
    if (!card) return;
    const entry = findEntry(card.dataset.id);
    if (!entry) return;

    switch (action) {
      case 'toggle': toggleEntry(card); break;
      case 'copy': copyReflection(entry); break;
      case 'edit': startEdit(entry.id); break;
      case 'delete': deleteEntry(entry.id); break;
      default: break;
    }
  }

  function updateStreakPill() {
    const { streak } = computeInsights();
    els.streakPill.hidden = streak < 1;
    els.streakPill.textContent = `🔥 ${streak}`;
    els.streakPill.title = `${plural(streak, 'day')} in a row with a reflection`;
  }

  /* ==========================================================================
     8. DATA VIEW — theme, export, import, clear
     ========================================================================== */

  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function getThemePref() {
    const pref = Store.read(STORAGE_KEYS.theme, 'system');
    return ['system', 'light', 'dark'].includes(pref) ? pref : 'system';
  }

  function applyTheme(pref = getThemePref()) {
    const dark = pref === 'dark' || (pref === 'system' && darkQuery.matches);
    document.documentElement.classList.toggle('dark', dark);
    els.metaTheme.setAttribute('content', dark ? '#0b0d14' : '#f6f7fb');
    $$('[data-theme-option]').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.themeOption === pref)));
  }

  function setTheme(pref) {
    Store.write(STORAGE_KEYS.theme, pref);
    applyTheme(pref);
  }

  function renderDataStats() {
    const n = state.entries.length;
    const bytes = new Blob([JSON.stringify(state.entries)]).size;
    const size = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
    els.dataStats.textContent = Store.available
      ? `${plural(n, 'reflection')} · ${size} stored on this device.`
      : 'Browser storage is disabled, so reflections will be lost when you close this tab.';
  }

  function exportData() {
    if (!state.entries.length) {
      toast('Nothing to export yet.');
      return;
    }
    const payload = {
      app: 'MindShift',
      version: 1,
      exportedAt: new Date().toISOString(),
      entryCount: state.entries.length,
      entries: sortedEntries(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindshift-export-${dateKey(new Date())}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Exported ${plural(state.entries.length, 'reflection')} 📦`);
  }

  async function importData(file) {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      toast('That file is too large to be a MindShift backup.', { type: 'error' });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      toast('That file isn\'t valid JSON.', { type: 'error' });
      return;
    }

    const raw = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.entries) ? parsed.entries : null);
    if (!raw) {
      toast('No reflections found in that file.', { type: 'error' });
      return;
    }

    const existing = new Set(state.entries.map((e) => e.id));
    let added = 0;
    let skipped = 0;
    raw.forEach((r) => {
      const entry = sanitizeEntry(r);
      if (!entry || existing.has(entry.id)) { skipped += 1; return; }
      existing.add(entry.id);
      state.entries.push(entry);
      added += 1;
    });

    if (added && !persistEntries()) return;
    renderDataStats();
    updateStreakPill();
    toast(added
      ? `Imported ${plural(added, 'reflection')}${skipped ? ` (${skipped} skipped)` : ''} ✅`
      : `Nothing new to import${skipped ? ` (${skipped} duplicate or invalid)` : ''}.`);
  }

  async function clearAllData() {
    const n = state.entries.length;
    const hasDraft = Boolean(loadDraft());
    if (!n && !hasDraft) {
      toast('There\'s no data to clear.');
      return;
    }
    const confirmed = await openModal({
      title: 'Delete all data?',
      body: `This permanently removes ${plural(n, 'reflection')}${hasDraft ? ' and your unsaved draft' : ''} from this device. Export a backup first if you might want them later. This can't be undone.`,
      confirmText: 'Delete everything',
      cancelText: 'Keep my data',
      danger: true,
    });
    if (!confirmed) return;

    state.entries = [];
    state.editingId = null;
    state.expandedId = null;
    state.form = emptyForm();
    Store.remove(STORAGE_KEYS.entries);
    Store.remove(STORAGE_KEYS.draft);
    renderForm();
    renderDataStats();
    updateStreakPill();
    toast('All data cleared.');
  }

  /* ==========================================================================
     9. NAVIGATION & INIT
     ========================================================================== */

  const VIEWS = ['checkin', 'history', 'data'];

  function switchView(name) {
    if (!VIEWS.includes(name)) name = 'checkin';
    state.view = name;

    els.views.forEach((v) => { v.hidden = v.dataset.view !== name; });
    els.tabs.forEach((t) => {
      if (t.dataset.tab === name) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });

    if (name === 'history') renderHistory();
    if (name === 'data') renderDataStats();
    if (name === 'checkin') renderGreeting();

    els.main.scrollTop = 0;
    els.header.classList.remove('is-scrolled');

    const hash = `#${name}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }

  function cacheElements() {
    Object.assign(els, {
      header: $('.app-header'),
      main: $('#main'),
      views: $$('.view'),
      tabs: $$('.tab'),
      checkinView: $('.view-checkin'),
      metaTheme: $('#meta-theme-color'),
      themeToggle: $('#theme-toggle'),
      streakPill: $('#streak-pill'),
      greeting: $('#greeting'),
      todayDate: $('#today-date'),
      editBanner: $('#edit-banner'),
      editBannerDate: $('#edit-banner-date'),
      cancelEditBtn: $('#cancel-edit-btn'),
      moodGrid: $('#mood-grid'),
      intensity: $('#intensity'),
      intensityValue: $('#intensity-value'),
      copingCard: $('#coping-card'),
      triggerList: $('#trigger-list'),
      textareas: $$('textarea[data-field]'),
      saveBtn: $('#save-btn'),
      saveBtnLabel: $('#save-btn-label'),
      copyCurrentBtn: $('#copy-current-btn'),
      clearFormBtn: $('#clear-form-btn'),
      insights: $('#insights'),
      historySearch: $('#history-search'),
      historyFilter: $('#history-filter'),
      historyList: $('#history-list'),
      dataStats: $('#data-stats'),
      exportBtn: $('#export-btn'),
      importInput: $('#import-input'),
      clearAllBtn: $('#clear-all-btn'),
      appVersion: $('#app-version'),
      toastRegion: $('#toast-region'),
      modal: $('#modal'),
      modalTitle: $('#modal-title'),
      modalBody: $('#modal-body'),
      modalConfirm: $('#modal-confirm'),
      modalCancel: $('#modal-cancel'),
    });
  }

  function bindEvents() {
    // Navigation
    els.tabs.forEach((t) => t.addEventListener('click', () => switchView(t.dataset.tab)));
    window.addEventListener('hashchange', () => switchView(location.hash.slice(1)));
    els.main.addEventListener('scroll', () => {
      els.header.classList.toggle('is-scrolled', els.main.scrollTop > 4);
    }, { passive: true });

    // Theme
    els.themeToggle.addEventListener('click', () => {
      setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
    });
    $$('[data-theme-option]').forEach((btn) => btn.addEventListener('click', () => setTheme(btn.dataset.themeOption)));
    const onSystemThemeChange = () => { if (getThemePref() === 'system') applyTheme('system'); };
    if (darkQuery.addEventListener) darkQuery.addEventListener('change', onSystemThemeChange);
    else if (darkQuery.addListener) darkQuery.addListener(onSystemThemeChange);

    // Check-in form
    els.moodGrid.addEventListener('click', (e) => {
      const chip = e.target.closest('.mood-chip');
      if (chip) selectMood(chip.dataset.mood);
    });
    els.triggerList.addEventListener('click', (e) => {
      const chip = e.target.closest('.trigger-chip');
      if (chip) toggleTrigger(chip.dataset.trigger);
    });
    els.intensity.addEventListener('input', () => {
      state.form.intensity = clamp(parseInt(els.intensity.value, 10) || 3, 1, 5);
      renderIntensity();
      saveDraft();
    });
    els.copingCard.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="shuffle-tip"]')) shuffleTip();
    });
    els.textareas.forEach((ta) => {
      ta.addEventListener('input', () => {
        state.form[ta.dataset.field] = ta.value.slice(0, MAX_TEXT_LENGTH);
        autoGrow(ta);
        saveDraft();
      });
    });
    els.saveBtn.addEventListener('click', saveEntry);
    els.copyCurrentBtn.addEventListener('click', copyCurrent);
    els.clearFormBtn.addEventListener('click', clearForm);
    els.cancelEditBtn.addEventListener('click', () => { endEdit(); switchView('history'); });

    // History
    els.historyList.addEventListener('click', handleHistoryClick);
    const onSearch = debounce(() => {
      state.historyQuery = els.historySearch.value;
      renderHistory();
    }, 150);
    els.historySearch.addEventListener('input', onSearch);
    els.historyFilter.addEventListener('change', () => {
      state.historyMood = els.historyFilter.value;
      renderHistory();
    });

    // Data
    els.exportBtn.addEventListener('click', exportData);
    els.importInput.addEventListener('change', async () => {
      await importData(els.importInput.files[0]);
      els.importInput.value = ''; // allow re-importing the same file
    });
    els.clearAllBtn.addEventListener('click', clearAllData);

    // Modal
    els.modalConfirm.addEventListener('click', () => closeModal(true));
    els.modalCancel.addEventListener('click', () => closeModal(false));
    els.modal.addEventListener('click', (e) => { if (e.target.hasAttribute('data-modal-dismiss')) closeModal(false); });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      trapModalFocus(e);
      if (e.key === 'Escape' && !els.modal.hidden) closeModal(false);
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && state.view === 'checkin' && els.modal.hidden) {
        e.preventDefault();
        saveEntry();
      }
    });

    // Persist any pending draft if the tab is closed or backgrounded (important on mobile).
    const flushDraft = () => saveDraft.flush();
    window.addEventListener('pagehide', flushDraft);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flushDraft(); });
  }

  function init() {
    cacheElements();
    els.appVersion.textContent = `v${APP_VERSION}`;

    buildMoodGrid();
    buildTriggerList();
    buildHistoryFilter();
    applyTheme();

    state.entries = loadEntries();
    const draft = loadDraft();
    if (draft) state.form = draft;

    renderForm();
    updateStreakPill();
    bindEvents();

    const initialView = location.hash.slice(1);
    switchView(VIEWS.includes(initialView) ? initialView : 'checkin');

    if (!Store.available) {
      toast('Browser storage is disabled, so reflections won\'t be saved after you close this tab.', { type: 'error', duration: 7000 });
    } else if (draft) {
      toast('Welcome back! Your unsaved draft was restored ✍️');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
