/**
 * Promise-based replacements for window.confirm / window.prompt, rendered as
 * native <dialog> elements styled like the rest of the workspace.
 */

function build(title: string, body: string | null, opts: { input?: string; okLabel?: string; danger?: boolean }) {
  const dlg = document.createElement('dialog');
  dlg.className = 'modal modal-sm';
  const h = document.createElement('h2');
  h.textContent = title;
  dlg.append(h);
  if (body) {
    const p = document.createElement('p');
    p.className = 'muted modal-body';
    p.textContent = body;
    dlg.append(p);
  }
  let input: HTMLInputElement | null = null;
  if (opts.input !== undefined) {
    input = document.createElement('input');
    input.className = 'input';
    input.value = opts.input;
    dlg.append(input);
  }
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn';
  cancel.textContent = '取消';
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = `btn ${opts.danger ? 'btn-danger-solid' : 'btn-primary'}`;
  ok.textContent = opts.okLabel ?? '确定';
  actions.append(cancel, ok);
  dlg.append(actions);
  document.body.append(dlg);
  return { dlg, input, ok, cancel };
}

export function confirmDialog(title: string, body: string | null = null, opts: { okLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const { dlg, ok, cancel } = build(title, body, opts);
    const done = (v: boolean) => {
      dlg.close();
      dlg.remove();
      resolve(v);
    };
    ok.onclick = () => done(true);
    cancel.onclick = () => done(false);
    dlg.oncancel = (e) => { e.preventDefault(); done(false); };
    dlg.showModal();
    (opts.danger ? cancel : ok).focus();
  });
}

export function promptDialog(title: string, initial = '', opts: { okLabel?: string; body?: string } = {}): Promise<string | null> {
  return new Promise((resolve) => {
    const { dlg, input, ok, cancel } = build(title, opts.body ?? null, { input: initial, okLabel: opts.okLabel });
    const done = (v: string | null) => {
      dlg.close();
      dlg.remove();
      resolve(v);
    };
    ok.onclick = () => done(input!.value.trim() || null);
    cancel.onclick = () => done(null);
    input!.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); ok.click(); } };
    dlg.oncancel = (e) => { e.preventDefault(); done(null); };
    dlg.showModal();
    input!.select();
  });
}
