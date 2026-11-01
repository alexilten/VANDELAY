import { useEffect, useState } from 'react';

/** True when the page is showing its dark theme, by choice or by the OS. */
export function useIsDark(): boolean {
  const read = () => {
    const t = document.documentElement.dataset.theme;
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  };
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const update = () => setDark(read());
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : undefined;
    mq?.addEventListener('change', update);
    return () => {
      mo.disconnect();
      mq?.removeEventListener('change', update);
    };
  }, []);
  return dark;
}
