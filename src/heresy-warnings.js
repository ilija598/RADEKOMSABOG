import { createWarningSequence, HERESY_WARNING_COUNT } from './challenger-gates.js';

export function createHeresyWarnings({ dialog, i18n, onConfirm }) {
  const sequence = createWarningSequence();
  const ok = dialog.querySelector('[data-warning-ok]');

  function refresh() {
    if (!sequence.active) return;
    const entry = i18n.t(`signup.heresyWarnings.entries.${sequence.index}`);
    dialog.querySelector('[data-warning-count]').textContent = `${i18n.t('signup.heresyWarnings.counter')} ${sequence.index + 1} / ${HERESY_WARNING_COUNT}`;
    dialog.querySelector('[data-warning-title]').textContent = entry.title;
    dialog.querySelector('[data-warning-message]').textContent = entry.message;
    dialog.querySelector('[data-warning-progress]').style.width = `${((sequence.index + 1) / HERESY_WARNING_COUNT) * 100}%`;
    ok.textContent = i18n.t('signup.heresyWarnings.ok');
  }

  ok.addEventListener('click', () => {
    if (!sequence.active || !dialog.open) return;
    const answer = sequence.acknowledge();
    if (answer !== null) {
      dialog.close();
      onConfirm(answer);
    } else {
      refresh();
      ok.focus({ preventScroll: true });
    }
  });
  // Escape exits the sequence without recording an answer or advancing the form.
  dialog.addEventListener('cancel', () => sequence.cancel());
  dialog.addEventListener('close', () => { if (!dialog.open) sequence.cancel(); });

  return {
    refresh,
    get active() { return sequence.active; },
    show(answer) {
      if (answer !== 'yes') return;
      if (dialog.open || !sequence.begin(answer)) return;
      refresh();
      dialog.showModal();
      ok.focus({ preventScroll: true });
    },
  };
}
