/** Theme toggle: persists the visitor's choice in a cookie so the server renders it (no flash, no inline script). */
export function initThemeToggle(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((btn) => {
    if (btn.dataset.ready) return;
    btn.dataset.ready = '1';
    btn.addEventListener('click', () => {
      const root = document.documentElement;
      const current = root.dataset.theme === 'auto'
        ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : root.dataset.theme;
      const next = current === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      document.cookie = `fn_theme=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    });
  });
}
