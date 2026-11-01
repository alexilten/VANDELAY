import { useEffect, useId, useRef, useState } from 'react';
import type { CheckStatus, CheckView } from '../engine/home';

const LABEL: Record<CheckStatus, string> = { fail: 'Fails', warn: 'Warning', review: 'Needs review', pass: 'Passes', 'n/a': 'Skipped' };

/**
 * A small chip over the model that opens the option's checks. Every check can
 * answer "why?": the rule, where its limit comes from, how it was measured, and
 * any code citations. Interpretations are marked unverified.
 */
export function Checks({ checks }: { checks: readonly CheckView[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const open_ = checks.filter((c) => c.status === 'fail' || c.status === 'warn' || c.status === 'review').length;
  const fails = checks.some((c) => c.status === 'fail');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <div className="v-checks" ref={ref} onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`v-checks__chip ${fails ? 'is-fail' : open_ ? 'is-warn' : 'is-pass'}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <i aria-hidden="true" />
        {open_ === 0 ? 'All checks pass' : `${open_} to review`}
        <span className="v-checks__why">Why?</span>
      </button>
      {open ? (
        <div id={id} className="v-checks__panel" role="dialog" aria-label="Checks for this option">
          <div className="v-checks__top">
            <b>Checks</b>
            <button type="button" className="v-checks__close" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
          <p className="v-fine">Checked on an example site. Limits labelled as assumptions aren't from a code yet.</p>
          <ul>
            {checks.map((c) => (
              <li key={c.id} className={`is-${c.status === 'n/a' ? 'na' : c.status}`}>
                <div className="v-checks__head">
                  <i aria-hidden="true" />
                  <b>{c.rule?.topic ?? c.id}</b>
                  <span>{LABEL[c.status]}</span>
                </div>
                <p>{c.message}</p>
                {c.why ? <p className="v-checks__cite">{c.why}</p> : null}
                {c.rule ? (
                  <p className="v-fine">
                    {c.rule.statement.trim() === c.message.trim() ? '' : `${c.rule.statement} `}Source: {c.rule.source}.
                  </p>
                ) : null}
                {c.formula ? <p className="v-fine v-checks__formula">Measured: {c.formula}</p> : null}
                {c.citations.length ? (
                  <p className="v-fine">
                    {c.citations.map((x, i) => (
                      <a key={i} href={x.url} target="_blank" rel="noreferrer">
                        {x.label}
                        {x.verification === 'primary' ? '' : x.verification === 'secondary' ? ' (secondary source)' : ' (unverified)'}
                      </a>
                    ))}
                  </p>
                ) : null}
                {c.interpretations.map((t, i) => (
                  <p key={i} className="v-fine">
                    <span className="v-example">Unverified</span> {t}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
