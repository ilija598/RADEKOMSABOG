import { submitSignup } from './signup-api.js';
import { validateChallenger } from './validation.js';
import { isPursuitLocked, pursuitRemainingMs, HERESY_WARNING_COUNT } from './challenger-gates.js';
import { createHeresyWarnings } from './heresy-warnings.js';

export const CHALLENGER_DRAFT_KEY = 'radekomsa-challenger-draft:v1';

const TOTAL_STEPS = 5;
const choice = value => value === 'yes' || value === 'no' ? value : '';

export function pickEvasivePosition({ arenaWidth, arenaHeight, buttonWidth, buttonHeight, pointerX, pointerY, random = Math.random }) {
  const padding = 14;
  const pointerBuffer = 20;
  const maxX = Math.max(padding, arenaWidth - buttonWidth - padding);
  const maxY = Math.max(padding, arenaHeight - buttonHeight - 86);
  const hasPointer = Number.isFinite(pointerX) && Number.isFinite(pointerY);
  const isClear = ({ x, y }) => !hasPointer || pointerX < x - pointerBuffer || pointerX > x + buttonWidth + pointerBuffer || pointerY < y - pointerBuffer || pointerY > y + buttonHeight + pointerBuffer;
  const randomPosition = () => ({
    x: padding + random() * Math.max(0, maxX - padding),
    y: padding + random() * Math.max(0, maxY - padding),
  });

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const position = randomPosition();
    if (isClear(position)) return position;
  }

  const corners = [
    { x: padding, y: padding },
    { x: maxX, y: padding },
    { x: padding, y: maxY },
    { x: maxX, y: maxY },
  ].filter(isClear);
  if (!corners.length) return null;
  return corners.sort((a, b) => {
    const distance = position => (position.x + buttonWidth / 2 - pointerX) ** 2 + (position.y + buttonHeight / 2 - pointerY) ** 2;
    return distance(b) - distance(a);
  })[0];
}

const blankDraft = () => ({
  step: 1,
  immortalWorthy: '',
  believesRadeMortal: '',
  betterThanRade: '',
  challengerName: '',
  mmr: '',
  description: '',
  lieYesAttempts: 0,
  superiorityEvades: 0,
  superiorityStartedAt: 0,
});

function loadDraft(storage) {
  const fallback = blankDraft();
  if (!storage) return fallback;
  try {
    const value = JSON.parse(storage.getItem(CHALLENGER_DRAFT_KEY));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
    const draft = {
      step: Math.min(TOTAL_STEPS, Math.max(1, Number.parseInt(value.step, 10) || 1)),
      immortalWorthy: choice(value.immortalWorthy),
      believesRadeMortal: choice(value.believesRadeMortal),
      betterThanRade: choice(value.betterThanRade),
      challengerName: typeof value.challengerName === 'string' ? value.challengerName.slice(0, 80) : '',
      mmr: typeof value.mmr === 'string' || typeof value.mmr === 'number' ? String(value.mmr).slice(0, 5) : '',
      description: typeof value.description === 'string' ? value.description.slice(0, 500) : '',
      lieYesAttempts: Math.min(HERESY_WARNING_COUNT, Math.max(0, Number.parseInt(value.lieYesAttempts, 10) || 0)),
      superiorityEvades: Math.min(100000, Math.max(0, Number.parseInt(value.superiorityEvades, 10) || 0)),
      superiorityStartedAt: Number.isFinite(value.superiorityStartedAt) && value.superiorityStartedAt > 0 && value.superiorityStartedAt <= Date.now() ? value.superiorityStartedAt : 0,
    };
    // An old saved YES cannot bypass the new timer when a draft is restored.
    if (draft.betterThanRade === 'yes' && isPursuitLocked(draft.superiorityStartedAt)) draft.betterThanRade = '';
    if (!draft.immortalWorthy) draft.step = 1;
    else if (!draft.believesRadeMortal) draft.step = Math.min(draft.step, 2);
    else if (!draft.betterThanRade) draft.step = Math.min(draft.step, 3);
    else if (!draft.challengerName.trim() || !draft.mmr.trim() || !draft.description.trim()) draft.step = Math.min(draft.step, 4);
    return draft;
  } catch {
    return fallback;
  }
}

export function createChallengerForm({ i18n, storage, isMotionPaused, onAnnounce }) {
  const $ = selector => document.querySelector(selector);
  const form = $('#signup-form');
  const processing = $('#processing');
  const success = $('#success');
  const errorBox = $('#form-error');
  const backButton = $('#back-button');
  const nextButton = $('#next-button');
  const submitButton = $('#submit-button');
  const lieYes = $('#lie-yes');
  const lieNo = $('#lie-no');
  const betterYes = $('#better-yes');
  const betterNo = $('#better-no');
  const arena = $('#evasive-arena');
  const detailFields = ['challengerName', 'mmr', 'description'];
  let draft = loadDraft(storage);
  let busy = false;
  let announced = false;
  let errorCode = null;
  let stageIndex = 0;
  let survival = null;
  let blockedAttempt = false;
  let transitionTimer;
  let judgmentTimer;
  const warnings = createHeresyWarnings({
    dialog: $('#heresy-dialog'),
    i18n,
    onConfirm(answer) {
      draft.lieYesAttempts = HERESY_WARNING_COUNT;
      selectAnswer('believesRadeMortal', answer);
    },
  });

  const protocolEvent = stage => document.dispatchEvent(new CustomEvent('rade:protocol', { detail: { stage, language: i18n.language } }));
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const announce = () => {
    if (announced) return;
    announced = true;
    onAnnounce();
  };
  const saveDraft = () => {
    try { storage?.setItem(CHALLENGER_DRAFT_KEY, JSON.stringify(draft)); } catch { /* The form remains usable when storage is blocked. */ }
  };
  const clearDraft = () => {
    try { storage?.removeItem(CHALLENGER_DRAFT_KEY); } catch { /* Nothing else to clear. */ }
  };
  const payload = () => ({
    immortalWorthy: draft.immortalWorthy,
    believesRadeMortal: draft.believesRadeMortal,
    betterThanRade: draft.betterThanRade,
    challengerName: draft.challengerName,
    mmr: draft.mmr.trim() ? Number(draft.mmr) : NaN,
    description: draft.description,
  });

  function syncControls() {
    for (const name of ['immortalWorthy', 'believesRadeMortal', 'betterThanRade']) form.elements[name].value = draft[name];
    for (const name of detailFields) if (form.elements[name].value !== draft[name]) form.elements[name].value = draft[name];
    form.elements.lieYesAttempts.value = String(draft.lieYesAttempts);
    form.elements.superiorityEvades.value = String(draft.superiorityEvades);
    form.elements.submissionLanguage.value = i18n.language;
  }

  function updatePursuit() {
    if (draft.step === 3 && !draft.superiorityStartedAt) {
      draft.superiorityStartedAt = Date.now();
      saveDraft();
    }
    const remaining = pursuitRemainingMs(draft.superiorityStartedAt);
    const locked = remaining > 0;
    betterYes.setAttribute('aria-disabled', String(locked));
    betterYes.classList.toggle('is-locked', locked);
    const status = i18n.t(locked ? 'signup.pursuit.locked' : 'signup.pursuit.unlocked');
    if ($('#pursuit-status').textContent !== status) $('#pursuit-status').textContent = status;
    const seconds = Math.ceil(remaining / 1000);
    $('#pursuit-clock').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    $('#pursuit-countdown').hidden = !locked;
    const feedback = blockedAttempt && locked ? i18n.t('signup.pursuit.denied') : '';
    if ($('#pursuit-feedback').textContent !== feedback) $('#pursuit-feedback').textContent = feedback;
    if (!locked) {
      // Stop evading and return to a predictable, reachable position.
      betterYes.style.removeProperty('left');
      betterYes.style.removeProperty('top');
    }
  }

  function updateReview() {
    const answer = value => i18n.t(`signup.${value || 'unanswered'}`);
    $('#review-immortal').textContent = answer(draft.immortalWorthy);
    $('#review-lies').textContent = answer(draft.believesRadeMortal);
    $('#review-better').textContent = answer(draft.betterThanRade);
    $('#review-name').textContent = draft.challengerName;
    $('#review-mmr').textContent = draft.mmr;
    $('#review-description').textContent = draft.description;
  }

  function render({ focus = false } = {}) {
    syncControls();
    document.querySelectorAll('.form-step').forEach(step => { step.hidden = Number(step.dataset.step) !== draft.step; });
    document.querySelectorAll('[data-progress-step]').forEach(item => {
      const step = Number(item.dataset.progressStep);
      item.classList.toggle('is-complete', step < draft.step);
      item.classList.toggle('is-current', step === draft.step);
      if (step === draft.step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    $('#step-counter').textContent = `${i18n.t('signup.stepCounter')} ${draft.step} / ${TOTAL_STEPS}`;
    backButton.hidden = draft.step === 1;
    nextButton.hidden = draft.step !== 4;
    submitButton.hidden = draft.step !== 5;
    document.querySelectorAll('[data-answer]').forEach(button => button.setAttribute('aria-pressed', String(draft[button.dataset.answer] === button.dataset.value)));
    $('#description-count').textContent = `${i18n.format(draft.description.length)} / 500`;
    updatePursuit();
    updateReview();
    if (errorCode && !errorBox.hidden) errorBox.textContent = i18n.t(`errors.${errorCode}`);
    if (survival !== null) $('#survival').textContent = `${i18n.format(survival, 1)}%`;
    if (focus) requestAnimationFrame(() => document.querySelector(`[data-step="${draft.step}"] h3`)?.focus({ preventScroll: true }));
  }

  function goToStep(step, focus = true) {
    clearTimeout(transitionTimer);
    errorCode = null;
    errorBox.hidden = true;
    draft.step = Math.min(TOTAL_STEPS, Math.max(1, step));
    saveDraft();
    render({ focus });
  }

  function selectAnswer(name, value) {
    // All activation paths (including keyboard and synthetic clicks) share the gate.
    if (name === 'betterThanRade' && value === 'yes' && isPursuitLocked(draft.superiorityStartedAt)) return;
    clearTimeout(transitionTimer);
    draft[name] = value;
    saveDraft();
    render();
    const nextStep = draft.step + 1;
    transitionTimer = setTimeout(() => goToStep(nextStep), isMotionPaused() ? 0 : 220);
  }

  function showError(code, field) {
    errorCode = code;
    errorBox.textContent = i18n.t(`errors.${code}`);
    errorBox.hidden = false;
    if (field) {
      field.setAttribute('aria-invalid', 'true');
      field.focus({ preventScroll: true });
    }
  }

  function validateDetails() {
    const checked = validateChallenger(payload());
    if (!checked.error) {
      draft.challengerName = checked.value.challengerName;
      draft.description = checked.value.description;
      draft.mmr = String(checked.value.mmr);
      return checked;
    }
    const field = form.elements[checked.errorCode];
    showError(checked.errorCode, field instanceof HTMLElement ? field : undefined);
    return checked;
  }

  function moveEvasiveChoice(event) {
    if (draft.step !== 3 || !isPursuitLocked(draft.superiorityStartedAt)) return false;
    // Keep the time lock, but remove chasing motion for reduced-motion users.
    if (isMotionPaused()) return true;
    const arenaRect = arena.getBoundingClientRect();
    const buttonRect = betterYes.getBoundingClientRect();
    const position = pickEvasivePosition({
      arenaWidth: arenaRect.width,
      arenaHeight: arenaRect.height,
      buttonWidth: buttonRect.width,
      buttonHeight: buttonRect.height,
      pointerX: event?.clientX - arenaRect.left,
      pointerY: event?.clientY - arenaRect.top,
    });
    if (!position) return true;
    betterYes.style.left = `${position.x}px`;
    betterYes.style.top = `${position.y}px`;
    draft.superiorityEvades += 1;
    saveDraft();
    return true;
  }

  async function processingSequence() {
    for (stageIndex = 0; stageIndex < i18n.t('signup.stages').length; stageIndex++) {
      $('#processing-text').textContent = i18n.t(`signup.stages.${stageIndex}`);
      protocolEvent(`processing:${stageIndex}`);
      await pause(380);
    }
    $('#processing-text').textContent = i18n.t('signup.awaiting');
  }

  async function saveSubmission() {
    const answers = Object.fromEntries(['immortalWorthy', 'believesRadeMortal', 'betterThanRade'].map(key => [key, draft[key] === 'yes' ? 'da' : draft[key] === 'no' ? 'ne' : '']));
    return submitSignup({ ...answers, steamNick: draft.challengerName.trim(), description: draft.description.trim(), mmr: draft.mmr.trim() ? Number(draft.mmr) : NaN }, { language: i18n.language });
  }

  form.addEventListener('focusin', announce, { once: true });
  form.addEventListener('input', event => {
    event.target.removeAttribute('aria-invalid');
    if (!detailFields.includes(event.target.name)) return;
    draft[event.target.name] = event.target.value;
    errorCode = null;
    errorBox.hidden = true;
    saveDraft();
    render();
  });
  form.querySelectorAll('[data-answer="immortalWorthy"]').forEach(button => button.addEventListener('click', () => selectAnswer('immortalWorthy', button.dataset.value)));
  lieNo.addEventListener('click', () => { if (draft.step === 2) warnings.show('no'); });
  lieYes.addEventListener('click', () => { if (draft.step === 2) warnings.show('yes'); });
  betterNo.addEventListener('click', () => selectAnswer('betterThanRade', 'no'));
  betterYes.addEventListener('mouseenter', moveEvasiveChoice);
  betterYes.addEventListener('pointerdown', event => {
    if (isPursuitLocked(draft.superiorityStartedAt)) {
      event.preventDefault();
      blockedAttempt = true;
      moveEvasiveChoice(event);
      updatePursuit();
    }
  });
  betterYes.addEventListener('click', event => {
    if (isPursuitLocked(draft.superiorityStartedAt)) {
      event.preventDefault();
      blockedAttempt = true;
      moveEvasiveChoice(event);
      updatePursuit();
      return;
    }
    selectAnswer('betterThanRade', 'yes');
  });
  // Enter/Space must not bypass the same five-minute wait as pointer activation.
  betterYes.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && isPursuitLocked(draft.superiorityStartedAt)) {
      event.preventDefault();
      blockedAttempt = true;
      updatePursuit();
    }
  });
  backButton.addEventListener('click', () => goToStep(draft.step - 1));
  nextButton.addEventListener('click', () => {
    form.querySelectorAll('[aria-invalid]').forEach(field => field.removeAttribute('aria-invalid'));
    if (!validateDetails().error) goToStep(5);
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || draft.step !== 5) return;
    announce();
    form.querySelectorAll('[aria-invalid]').forEach(field => field.removeAttribute('aria-invalid'));
    if (validateDetails().error) {
      goToStep(4, false);
      validateDetails();
      return;
    }
    busy = true;
    errorCode = null;
    errorBox.hidden = true;
    submitButton.disabled = true;
    form.hidden = true;
    processing.hidden = false;
    processing.focus({ preventScroll: true });
    const [result] = await Promise.all([saveSubmission(), processingSequence()]);
    processing.hidden = true;
    submitButton.disabled = false;
    if (result.ok) {
      survival = Math.round((.1 + Math.random() * 6.9) * 10) / 10;
      $('#survival').textContent = `${i18n.format(survival, 1)}%`;
      success.hidden = false;
      success.focus({ preventScroll: true });
      clearDraft();
      $('#judgment').hidden = false;
      clearTimeout(judgmentTimer);
      judgmentTimer = setTimeout(() => { $('#judgment').hidden = true; }, isMotionPaused() ? 900 : 1600);
      protocolEvent('accepted');
    } else {
      form.hidden = false;
      showError(result.code);
      submitButton.focus({ preventScroll: true });
      protocolEvent('error');
    }
    busy = false;
  });
  $('#return-button').addEventListener('click', () => {
    clearTimeout(judgmentTimer);
    $('#judgment').hidden = true;
    success.hidden = true;
    form.hidden = false;
    form.reset();
    draft = blankDraft();
    blockedAttempt = false;
    survival = null;
    goToStep(1);
    $('#challenge').scrollIntoView({ behavior: isMotionPaused() ? 'instant' : 'smooth' });
  });

  render();
  const pursuitTick = setInterval(() => {
    if (draft.step === 3 && !document.hidden) updatePursuit();
  }, 250);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && draft.step === 3) updatePursuit(); });
  window.addEventListener('pagehide', event => { if (!event.persisted) clearInterval(pursuitTick); });
  return {
    announce,
    refresh() {
      form.elements.submissionLanguage.value = i18n.language;
      $('#processing-text').textContent = stageIndex < i18n.t('signup.stages').length ? i18n.t(`signup.stages.${stageIndex}`) : i18n.t('signup.awaiting');
      render();
      warnings.refresh();
    },
  };
}
