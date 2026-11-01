import { useEffect, useMemo, useRef, useState } from 'react';
import type { HomeOption } from '@vandelay/engine-home';
import type { SiteIntent } from '@vandelay/kernel';
import { AppIcon, Button, ExampleTag, Pill, Widget } from '../design/components';
import { liveOptions, siteFacts, type LiveOption } from '../engine/home';
import { useMedia } from '../lib/useMedia';
import { ViewerPanel } from '../viewer/ViewerPanel';
import { Checks } from '../flow/Checks';
import { makeExampleRequest } from './example';
import {
  approvalRecord,
  isApprovalLink,
  parseApprovalRequest,
  requestFromLink,
  verifyRequest,
  type Approval,
  type ApprovalRequest,
  type VerifyReport,
} from './verify';

type Source = 'link' | 'file' | 'example';
type Loaded = { req: ApprovalRequest; report: VerifyReport | null; source: Source };
type Tone = 'ok' | 'warn' | 'bad' | 'wait';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const short = (s: string, n = 10) => (s.length > n * 2 ? `${s.slice(0, n)}…${s.slice(-4)}` : s);
const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
};

/** One sentence for the whole verification, and whether the person may approve. */
export function verdict(r: VerifyReport | null, source: Source): { tone: Tone; title: string; detail: string; canApprove: boolean } {
  if (!r) return { tone: 'wait', title: 'Checking…', detail: 'Recomputing the receipt in your browser.', canApprove: false };
  if (r.signature === 'invalid') return { tone: 'bad', title: "Signature doesn't match", detail: 'Someone changed this receipt after it was signed. Do not approve it.', canApprove: false };
  if (!r.resultMatches) {
    if (source === 'link' && (!r.engineCurrent || !r.rulesCurrent))
      return { tone: 'warn', title: 'Made by an older engine', detail: "Today's engine gives a different answer, so this design can't be shown as signed. Ask the agent to run it again.", canApprove: false };
    return { tone: 'bad', title: 'Changed since signing', detail: "The design doesn't match its receipt. Do not approve it.", canApprove: false };
  }
  if (r.signature === 'unsupported') return { tone: 'warn', title: "Can't check the signature here", detail: "This browser can't check Ed25519 signatures. Try a current Chrome, Safari or Firefox.", canApprove: false };
  if (r.signature === 'unknown-key') {
    // From a link, the design was rebuilt by this viewer's own engine, so its content is ours even before the signer is known.
    return source === 'link'
      ? { tone: 'ok', title: 'Rebuilt and matches', detail: "This viewer re-ran the engine and got exactly what the agent got. Vandelay's signing key isn't published yet, so the signer isn't checked.", canApprove: true }
      : { tone: 'warn', title: 'Signer unknown', detail: 'The file came without a key we can check, so we cannot tell it was not altered.', canApprove: false };
  }
  if (r.keyTrust === 'trusted') return { tone: 'ok', title: 'Verified', detail: 'Signed by Vandelay and unchanged since.', canApprove: true };
  return {
    tone: 'ok',
    title: r.devKey ? 'Intact · example key' : 'Intact · key from this file',
    detail: 'Unchanged since it was signed. The key came with the file, so this proves the file is intact, not who signed it.',
    canApprove: true,
  };
}

function row(label: string, value: string, tone: Tone) {
  return { label, value, tone };
}

function rows(l: Loaded) {
  const { receipt } = l.req;
  const r = l.report;
  const signer = r?.keyTrust === 'trusted' ? 'Vandelay' : r?.devKey ? 'Example key' : r?.keyTrust === 'provided' ? 'Key in this file' : 'Not published yet';
  return [
    row('Signature', !r ? '…' : r.signature === 'valid' ? 'Valid' : r.signature === 'invalid' ? 'Invalid' : r.signature === 'unknown-key' ? 'Not checked' : 'Unsupported', !r ? 'wait' : r.signature === 'valid' ? 'ok' : r.signature === 'invalid' ? 'bad' : 'warn'),
    row('Signer', signer, r?.keyTrust === 'trusted' ? 'ok' : 'warn'),
    row('Design', !r ? '…' : r.resultMatches ? (l.source === 'link' ? 'Rebuilt, matches' : 'Matches receipt') : 'Changed', !r ? 'wait' : r.resultMatches ? 'ok' : 'bad'),
    row('Engine', `${receipt.engine.version}${r && !r.engineCurrent ? ' · older' : ''}`, !r || r.engineCurrent ? 'ok' : 'warn'),
    row('Rules', !r ? '…' : r.rulesCurrent ? 'Current' : 'Changed since', !r || r.rulesCurrent ? 'ok' : 'warn'),
  ];
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function remember(a: Approval) {
  try {
    const list = JSON.parse(localStorage.getItem('vandelay.approvals') ?? '[]') as unknown[];
    localStorage.setItem('vandelay.approvals', JSON.stringify([...list, a].slice(-50)));
  } catch {
    // Storage can be unavailable (private windows); the download is the record.
  }
}

function Empty({ onLoad, error, busy }: { onLoad: (text: string, source: Source) => void; error: string; busy: boolean }) {
  const [text, setText] = useState('');
  const file = useRef<HTMLInputElement>(null);
  return (
    <section className="v-door v-review">
      <p className="v-label v-door__eyebrow">Approve</p>
      <h1>Review a design</h1>
      <p className="v-door__lede">Open the receipt an agent sent you. Vandelay checks the design, its rules and its signature in your browser before you approve it.</p>
      <div className="v-review__actions">
        <Button onClick={() => file.current?.click()}>Open receipt file</Button>
        <Button variant="quiet" disabled={busy} onClick={() => onLoad('', 'example')}>
          {busy ? 'Making an example…' : 'Try an example'}
        </Button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="v-sr-only"
          aria-label="Receipt file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void f.text().then((t) => onLoad(t, 'file'));
            e.target.value = '';
          }}
        />
      </div>
      <form
        className="v-review__paste v-glass"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onLoad(text, 'file');
        }}
      >
        <label className="v-label" htmlFor="v-paste">
          Or paste it
        </label>
        <textarea id="v-paste" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder='{ "receipt": { "format": "vandelay.receipt/0", … } }' />
        <Button type="submit" variant="quiet" disabled={!text.trim()}>
          Check
        </Button>
      </form>
      {error ? (
        <p className="v-review__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/** The approval viewer: one signed result, re-checked, shown in 3D, approved in one click. */
export function Approve({ hash }: { hash: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState(0);
  const [approved, setApproved] = useState<Approval | null>(null);
  const [exampleFile, setExampleFile] = useState('');
  const compact = useMedia('(max-width: 760px)');
  // The verdict is the point of this screen, so it stays open even on phones.
  const [open, setOpen] = useState({ verify: true, brief: !compact, model: true });

  const start = (req: ApprovalRequest, source: Source) => {
    setError('');
    setApproved(null);
    setChosen(0);
    setLoaded({ req, report: null, source });
    void verifyRequest(req).then((report) => setLoaded((l) => (l && l.req === req ? { ...l, report } : l)));
  };

  useEffect(() => {
    if (!isApprovalLink(hash)) return;
    const req = requestFromLink(hash);
    if ('error' in req) setError(req.error);
    else start(req, 'link');
  }, [hash]);

  const onLoad = (text: string, source: Source) => {
    if (source === 'example') {
      setBusy(true);
      makeExampleRequest()
        .then(({ request, file }) => {
          setExampleFile(file);
          start(request, 'example');
        })
        .catch(() => setError("This browser can't make Ed25519 keys, so the example can't be signed here."))
        .finally(() => setBusy(false));
      return;
    }
    const req = parseApprovalRequest(text);
    if ('error' in req) setError(req.error);
    else start(req, 'file');
  };

  const view = useMemo(() => {
    if (!loaded) return null;
    const { result } = loaded.req;
    const raw = Array.isArray(result.options) ? (result.options as HomeOption[]) : [];
    let options: LiveOption[] = [];
    try {
      options = liveOptions(raw);
    } catch {
      options = [];
    }
    const body = isObject(result.intent) && isObject(result.intent.body) ? result.intent.body : null;
    const site = body && isObject(body.site) ? (body.site as unknown as SiteIntent) : null;
    const adu = Boolean(body && isObject(body.brief) && body.brief.use === 'adu');
    let facts: [string, string][] = [];
    try {
      facts = site ? (siteFacts(site, adu) as [string, string][]) : [];
    } catch {
      facts = [];
    }
    const input = loaded.req.input;
    const prompt = isObject(input) && typeof input.prompt === 'string' ? input.prompt : null;
    return { options, facts, prompt, note: typeof result.note === 'string' ? result.note : '', raw };
  }, [loaded]);

  if (!loaded || !view) return <Empty onLoad={onLoad} error={error} busy={busy} />;

  const v = verdict(loaded.report, loaded.source);
  const pick = view.options[chosen] ?? view.options[0];
  const intentHash = (() => {
    const o = view.raw[chosen] as unknown;
    return isObject(o) && isObject(o.result) && typeof o.result.intentHash === 'string' ? o.result.intentHash : undefined;
  })();
  const approve = () => {
    if (!pick) return;
    const a = approvalRecord(loaded.req, { index: chosen, label: pick.name, ...(intentHash ? { intentHash } : {}) });
    remember(a);
    setApproved(a);
  };
  const tog = (k: keyof typeof open) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div className="v-work v-approve">
      <div className="v-work__grid">
        <div className="v-work__side">
          <Widget title="Verification" index="01" summary={v.title} open={open.verify} onToggle={() => tog('verify')} aside={loaded.source === 'example' ? <ExampleTag /> : undefined}>
            <div className={`v-verify is-${v.tone}`} role="status">
              <b>
                <i aria-hidden="true" />
                {v.title}
              </b>
              <p>{v.detail}</p>
            </div>
            <ul className="v-verify__rows">
              {rows(loaded).map((r) => (
                <li key={r.label} className={`is-${r.tone}`}>
                  <span className="v-label">{r.label}</span>
                  <span>{r.value}</span>
                </li>
              ))}
            </ul>
            <dl className="v-verify__meta">
              <div>
                <dt className="v-label">Issued</dt>
                <dd>{when(loaded.req.receipt.issuedAt)}</dd>
              </div>
              <div>
                <dt className="v-label">Tool</dt>
                <dd>{loaded.req.receipt.tool}</dd>
              </div>
              <div>
                <dt className="v-label">Key</dt>
                <dd title={loaded.req.receipt.keyId}>{short(loaded.req.receipt.keyId, 14)}</dd>
              </div>
              <div>
                <dt className="v-label">Result</dt>
                <dd title={loaded.req.receipt.resultHash}>{short(loaded.req.receipt.resultHash)}</dd>
              </div>
            </dl>
            {loaded.report && loaded.report.problems.length > 0 && !v.canApprove ? (
              <ul className="v-verify__problems">
                {loaded.report.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : null}
          </Widget>

          <Widget title="What was asked" index="02" summary={view.prompt ?? 'Example site'} open={open.brief} onToggle={() => tog('brief')} aside={<ExampleTag>Example site</ExampleTag>}>
            <div className="v-site">
              {view.prompt ? <p className="v-review__prompt">“{view.prompt}”</p> : null}
              <dl className="v-facts">
                {view.facts.map(([k, val]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{val}</dd>
                  </div>
                ))}
              </dl>
              {view.note ? <p className="v-fine">Engine note: {view.note}.</p> : null}
              {exampleFile && loaded.source === 'example' ? (
                <Button variant="quiet" onClick={() => download('vandelay-example-receipt.json', exampleFile)}>
                  Download this example receipt
                </Button>
              ) : null}
            </div>
          </Widget>
        </div>

        <Widget className="v-work__options" title="The design" index="03" summary={pick?.name} open={open.model} onToggle={() => tog('model')}>
          {pick ? (
            <>
              <ViewerPanel category="home" option={chosen} optionName={pick.name} geometry={pick.geometry} engine>
                <Checks checks={pick.checks} />
              </ViewerPanel>
              <div className="v-options" role="radiogroup" aria-label="Options">
                {view.options.map((o, i) => (
                  <button key={o.name} type="button" role="radio" aria-checked={i === chosen} className="v-opt" onClick={() => setChosen(i)}>
                    <Pill tone={o.bestFit ? 'accent' : 'plain'}>{o.bestFit ? 'Best fit' : `Option ${'ABCDEFG'[i] ?? i + 1}`}</Pill>
                    <h3>{o.name}</h3>
                    <div className="v-opt__big">
                      {o.headline}
                      <small>{o.headlineLabel}</small>
                    </div>
                    <dl>
                      {o.metrics.map(([k, val]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{val}</dd>
                        </div>
                      ))}
                    </dl>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="v-fine">This receipt has no Home options to show.</p>
          )}
        </Widget>
      </div>

      <div className="v-work__cta v-glass">
        <div className="v-work__cta-text">
          <AppIcon id="home" size="sm" />
          <span>
            <b>{approved ? `Approved: ${approved.option.label}` : pick ? `Approve ${pick.name}?` : 'Nothing to approve'}</b>
            <span className="v-fine">
              {approved ? `${when(approved.approvedAt)} · not signed by you yet: sign-in isn't built` : v.canApprove ? 'Approving records exactly this signed design.' : v.title}
            </span>
          </span>
        </div>
        {approved ? (
          <Button variant="quiet" onClick={() => download(`vandelay-approval-${approved.resultHash.slice(0, 8)}.json`, JSON.stringify(approved, null, 2))}>
            Download record
          </Button>
        ) : (
          <Button disabled={!v.canApprove || !pick} onClick={approve}>
            Approve
          </Button>
        )}
      </div>
    </div>
  );
}
