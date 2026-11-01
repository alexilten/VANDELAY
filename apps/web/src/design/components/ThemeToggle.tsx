import { nextTheme, useTheme, type ThemeChoice } from '../../lib/theme';
import { AutoIcon, MoonIcon, SunIcon } from './icons';

const LABEL: Record<ThemeChoice, string> = { system: 'Match system', light: 'Light', dark: 'Dark' };

/** Cycles system → light → dark. */
export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const Icon = theme === 'light' ? SunIcon : theme === 'dark' ? MoonIcon : AutoIcon;
  const next = nextTheme(theme);
  return (
    <button
      type="button"
      className="v-icon-btn v-glass-soft"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[next]}.`}
      title={`Theme: ${LABEL[theme]}`}
    >
      <Icon />
    </button>
  );
}
