// matrix-fx — pill panels
//
// The entry scaffolding: pill-choice screen, red-pill auth, blue-pill
// diagnostics host. Authentication, navigation, and the diagnostics body are
// all injected through the config — this file only renders the shell and
// reacts to the boolean answers.

import { el, btn, input } from '../lib/dom';
import type { MatrixEntryConfig } from '../types';
import type { PillChoice } from '../overlays/context';

export interface ShellCtx {
  panel: HTMLElement;
  branding: string;
  config: MatrixEntryConfig;
  toast: (message: string, intent?: 'success' | 'danger' | 'warning' | 'primary') => void;
  /** Mutable: the in-flight passphrase. Zeroed after use / on back. */
  passphrase: string;
  getChoice(): PillChoice;
  setPill(p: PillChoice): void;
  partAndEnter(): Promise<void>;
  /** Stop the rain loop + timers (called before handing off to a host route). */
  stopAnimation(): void;
  /** Register the blue-pill diagnostics cleanup so it runs on teardown/leave. */
  setDiagnosticsCleanup(fn: (() => void) | null): void;
}

export function renderPanel(shell: ShellCtx) {
  const { panel } = shell;
  panel.innerHTML = '';
  const choice = shell.getChoice();
  if (choice === 'none') return;       // landing — panel is hidden
  if (choice === 'choose') return renderPillChoice(shell);
  if (choice === 'blue') return renderBluePill(shell);
  if (choice === 'red') return void renderRedPill(shell);
}

function renderPillChoice(shell: ShellCtx) {
  const { panel } = shell;
  panel.appendChild(el('div', { cls: 'parsec-matrix__pill-screen', children: [
    el('div', { cls: 'parsec-matrix__pill-screen-brand', text: shell.branding }),
    el('p', { cls: 'parsec-matrix__tagline', text: 'Choose your path' }),
    el('div', { cls: 'parsec-matrix__pills', children: [
      el('div', {
        cls: 'parsec-matrix__pill parsec-matrix__pill--blue',
        onClick: () => shell.setPill('blue'),
        children: [
          el('div', { cls: 'parsec-matrix__pill-capsule' }),
          el('div', { cls: 'parsec-matrix__pill-label', text: 'Blue Pill' }),
          el('div', { cls: 'parsec-matrix__pill-desc', text: 'Diagnostics' }),
        ],
      }),
      el('div', {
        cls: 'parsec-matrix__pill parsec-matrix__pill--red',
        onClick: () => shell.setPill('red'),
        children: [
          el('div', { cls: 'parsec-matrix__pill-capsule' }),
          el('div', { cls: 'parsec-matrix__pill-label', text: 'Red Pill' }),
          el('div', { cls: 'parsec-matrix__pill-desc', text: 'Live wallet' }),
        ],
      }),
    ]}),
    el('p', { cls: 'parsec-matrix__footer-text', text: 'Safe to walk away. No session active.' }),
    el('div', { cls: 'parsec-matrix__back', children: [
      el('a', { text: 'Return to Matrix', attrs: { href: '#' }, onClick: (e) => { e.preventDefault(); shell.setPill('none'); } }),
    ]}),
  ]}));
}

function renderBluePill(shell: ShellCtx) {
  const { panel, config } = shell;

  panel.appendChild(el('div', { cls: 'parsec-matrix__choice-label parsec-matrix__choice-label--blue', text: 'BLUE PILL — DIAGNOSTICS' }));

  // Host-supplied diagnostics body. The module only provides the mount point;
  // the host renders whatever it wants (on-chain data, network status, …) and
  // may return a cleanup fn for its timers/listeners.
  const host = el('div', { cls: 'parsec-matrix__blue-host' });
  panel.appendChild(host);

  if (config.renderDiagnostics) {
    const cleanup = config.renderDiagnostics(host);
    shell.setDiagnosticsCleanup(typeof cleanup === 'function' ? cleanup : null);
  } else {
    host.appendChild(el('p', { cls: 'parsec-matrix__lead', text: 'No diagnostics configured.' }));
    shell.setDiagnosticsCleanup(null);
  }

  backButton(shell);
}

async function renderRedPill(shell: ShellCtx) {
  const { panel, config } = shell;

  panel.appendChild(el('div', { cls: 'parsec-matrix__pill-screen', children: [
    el('div', { cls: 'parsec-matrix__choice-label parsec-matrix__choice-label--red', text: 'RED PILL — LIVE WALLET' }),
    el('p', { cls: 'parsec-matrix__lead', text: 'Sovereign access. Signing authority.' }),
  ]}));

  // A returning user with an unlockable vault gets the passphrase field.
  const showUnlock = config.auth.isTauri() || await config.auth.hasVault();
  if (shell.getChoice() !== 'red') return; // user navigated away during the await

  if (showUnlock) {
    const passInput = input({ type: 'password', placeholder: 'Enter passphrase', cls: 'parsec-matrix__input', onInput: (v) => { shell.passphrase = v; }, onEnter: () => doUnlock(shell) });
    panel.appendChild(passInput);
    panel.appendChild(btn('Unlock Wallet', { intent: 'primary', large: true, cls: 'parsec-matrix__action parsec-matrix__action--red', onClick: () => doUnlock(shell) }));
    setTimeout(() => passInput.focus(), 100);
    panel.appendChild(el('div', { cls: 'parsec-matrix__divider', text: 'or' }));
  }

  // Always show create + import (new and returning users)
  panel.appendChild(btn('Create New Wallet', { outlined: true, large: true, cls: 'parsec-matrix__action', onClick: () => { shell.stopAnimation(); config.onNavigate('onboarding'); } }));
  panel.appendChild(btn('Import Wallet', { outlined: true, cls: 'parsec-matrix__action', onClick: () => { shell.stopAnimation(); config.onNavigate('import-wallet'); } }));

  backButton(shell);
}

function backButton(shell: ShellCtx) {
  shell.panel.appendChild(el('div', { cls: 'parsec-matrix__back', children: [
    el('a', { text: 'Return to Matrix', attrs: { href: '#' }, onClick: (e) => { e.preventDefault(); shell.passphrase = ''; shell.setPill('none'); } }),
  ]}));
}

async function doUnlock(shell: ShellCtx) {
  const { config } = shell;
  if (!shell.passphrase || shell.passphrase.length < 8) { shell.toast('Enter your passphrase', 'danger'); return; }
  const ok = await config.auth.unlock(shell.passphrase);
  if (ok) {
    // Overwrite the local copy with null bytes before clearing the reference.
    shell.passphrase = '\0'.repeat(shell.passphrase.length);
    shell.passphrase = '';
    await shell.partAndEnter();
  } else {
    shell.toast('Wrong passphrase', 'danger');
    shell.passphrase = '\0'.repeat(shell.passphrase.length);
    shell.passphrase = '';
  }
}
