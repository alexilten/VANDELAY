import { useState } from 'react';
import { AmbientLight, Logo, ThemeToggle } from './design/components';
import type { CategoryId } from './design/categories';
import { FrontDoor } from './flow/FrontDoor';
import { Workspace } from './flow/Workspace';
import { guessCategory } from './lib/guess';

type Session = { category: CategoryId; brief: string };

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const start = (category: CategoryId, brief = '') => setSession({ category, brief });
  const home = () => setSession(null);

  return (
    <>
      <AmbientLight />
      <div className={`v-page ${session ? 'v-page--work' : ''}`}>
        <header className="v-top">
          <Logo onClick={home} />
          <div className="v-top__end">
            <ThemeToggle />
            <span className="v-signin v-glass-soft">Sign in</span>
          </div>
        </header>
        <main className="v-main" aria-live="polite">
          {session ? (
            <Workspace
              key={session.category}
              category={session.category}
              brief={session.brief}
              onCategory={(c) => setSession((s) => ({ brief: s?.brief ?? '', category: c }))}
              onBrief={(b) => setSession({ brief: b, category: b ? guessCategory(b) : session.category })}
            />
          ) : (
            <FrontDoor onStart={(brief) => start(brief ? guessCategory(brief) : 'home', brief)} onPick={(c) => start(c)} />
          )}
        </main>
        <footer className="v-foot">Prototype · every figure shown is an example</footer>
      </div>
    </>
  );
}
