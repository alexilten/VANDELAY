import { lazy, Suspense, useEffect, useState } from 'react';
import { isApprovalLink } from './approve/verify';
import { AmbientLight, Logo, ThemeToggle } from './design/components';
import type { CategoryId } from './design/categories';
import { FrontDoor } from './flow/FrontDoor';
import { Workspace } from './flow/Workspace';
import { guessCategory } from './lib/guess';

type Session = { category: CategoryId; brief: string };

// The approval viewer loads on demand, so the front door stays light.
const Approve = lazy(() => import('./approve/Approve').then((m) => ({ default: m.Approve })));

const readHash = () => (typeof location === 'undefined' ? '' : location.hash);
/** The approval viewer lives at #/approve, and opens from share links (#v=0&receipt=…). */
const isReview = (h: string) => h.startsWith('#/approve') || isApprovalLink(h);

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [hash, setHash] = useState(readHash);
  useEffect(() => {
    const on = () => setHash(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const review = isReview(hash);
  const start = (category: CategoryId, brief = '') => setSession({ category, brief });
  const home = () => {
    setSession(null);
    if (review) {
      history.pushState(null, '', location.pathname + location.search);
      setHash('');
    }
  };

  return (
    <>
      <AmbientLight />
      <div className={`v-page ${session ? 'v-page--work' : ''}`}>
        <header className="v-top">
          <Logo onClick={home} />
          <div className="v-top__end">
            <ThemeToggle />
            {review ? null : (
              <a className="v-signin v-signin--review v-glass-soft" href="#/approve">
                Review a design
              </a>
            )}
            <span className="v-signin v-glass-soft">Sign in</span>
          </div>
        </header>
        <main className="v-main" aria-live="polite">
          {review ? (
            <Suspense fallback={<p className="v-fine">Loading the viewer…</p>}>
              <Approve key={hash} hash={hash} />
            </Suspense>
          ) : session ? (
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
