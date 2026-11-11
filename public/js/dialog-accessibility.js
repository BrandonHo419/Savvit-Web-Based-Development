(() => {
  const selector = '[role="dialog"]';
  let stack = [], active = null, returnFocus = null;
  let lastTrigger = null;
  document.addEventListener('click', event => {
    const trigger = event.target.closest('button, a, [role="button"]');
    if (trigger) lastTrigger = trigger;
  }, true);
  const previousInert = new Map();
  const visible = element => !element.hidden && getComputedStyle(element).display !== 'none' && element.getClientRects().length > 0;
  const focusables = dialog => [...dialog.querySelectorAll('a[href], button, input, textarea, select, summary, [tabindex]')]
    .filter(element => !element.disabled && element.tabIndex >= 0 && visible(element));
  function restoreBackground() {
    for (const [element, value] of previousInert) element.inert = value;
    previousInert.clear();
  }
  function isolate(dialog) {
    let branch = dialog;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && !['SCRIPT', 'STYLE', 'LINK'].includes(sibling.tagName)) {
          previousInert.set(sibling, sibling.inert);
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
  }
  function sync() {
    const shown = [...document.querySelectorAll(selector)].filter(visible);
    stack = stack.filter(entry => shown.includes(entry.dialog));
    for (const dialog of shown) {
      if (!stack.some(entry => entry.dialog === dialog)) {
        const opener = lastTrigger && !dialog.contains(lastTrigger) ? lastTrigger : document.activeElement;
        stack.push({ dialog, opener, pinId: dialog.dataset.pinId });
      }
    }
    const next = stack.at(-1) || null;
    if (next?.dialog === active?.dialog) return;
    restoreBackground();
    if (active && !shown.includes(active.dialog)) returnFocus = active;
    active = next;
    if (active) {
      isolate(active.dialog);
      active.dialog.tabIndex = -1;
      const nestedOpener = returnFocus?.opener;
      const target = nestedOpener?.isConnected && active.dialog.contains(nestedOpener) ? nestedOpener : focusables(active.dialog)[0] || active.dialog;
      target.focus({ preventScroll: true });
      returnFocus = null;
    } else if (returnFocus) {
      const candidate = returnFocus.opener?.isConnected ? returnFocus.opener
        : [...document.querySelectorAll('.pin_card')].find(card => card.dataset.pinId === returnFocus.pinId)
          || document.querySelector('main');
      candidate?.focus({ preventScroll: true });
      returnFocus = null;
    }
  }
  document.addEventListener('keydown', event => {
    if (!active) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation();
      active.dialog.querySelector('[data-dialog-close]')?.click();
    }
    if (event.key === 'Tab') {
      const items = focusables(active.dialog);
      const first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); active.dialog.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !items.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
  }, true);
  document.addEventListener('DOMContentLoaded', () => {
    new MutationObserver(sync).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'hidden'] });
    sync();
  });
})();
