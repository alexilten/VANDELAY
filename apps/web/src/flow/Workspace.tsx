import { useMemo, useState } from 'react';
import { AppIcon, Button, ExampleTag, Pill, PromptField, Segmented, Widget } from '../design/components';
import { CATEGORY_IDS, CATEGORY_NAMES, type CategoryId } from '../design/categories';
import { EXAMPLES } from '../data/examples';
import { useMedia } from '../lib/useMedia';
import { ViewerPanel } from '../viewer/ViewerPanel';
import { optionGeometry } from '../viewer/source';
import { liveHome } from '../engine/home';
import { Checks } from './Checks';
import { SiteMap } from './SiteMap';

type Props = {
  category: CategoryId;
  brief: string;
  onCategory: (c: CategoryId) => void;
  onBrief: (b: string) => void;
};

type WidgetKey = 'site' | 'brief' | 'options';

/**
 * Everything on one screen: the brief, the site, a few questions and three
 * options. Each part is a collapsible widget. Options update in place, so the
 * person never pages through steps.
 */
export function Workspace({ category, brief, onCategory, onBrief }: Props) {
  const ex = EXAMPLES[category];
  const compact = useMedia('(max-width: 760px)');
  const [picks, setPicks] = useState(() => ex.questions.map((q) => q.initial));
  const [address, setAddress] = useState('');
  const [chosen, setChosen] = useState(() => Math.max(0, ex.options.findIndex((o) => o.bestFit)));
  // On a phone, start with only the options open so they fit the screen.
  const [open, setOpen] = useState<Record<WidgetKey, boolean>>(() => ({ site: !compact, brief: !compact, options: true }));
  const toggle = (k: WidgetKey) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  // Home runs the real engine on an example site; other categories show example data.
  const live = useMemo(() => (category === 'home' ? liveHome(brief, picks) : null), [category, brief, picks]);
  const options = live?.options ?? ex.options;
  const site = live?.site ?? ex.site;
  const siteSummary = [address || 'Example site', site[0]?.[1]].filter(Boolean).join(' · ');
  const briefSummary = ex.questions.map((q, i) => q.options[picks[i] ?? q.initial]).join(' · ');
  const pick = options[chosen] ?? options[0];
  const geometry = useMemo(
    () => live?.options[chosen]?.geometry ?? optionGeometry(category, chosen, picks),
    [live, category, chosen, picks],
  );

  return (
    <div className="v-work">
      <div className="v-work__bar">
        <div className="v-cats" role="radiogroup" aria-label="What kind of building">
          {CATEGORY_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={id === category}
              className="v-cats__item"
              onClick={() => id !== category && onCategory(id)}
            >
              <AppIcon id={id} size="sm" />
              <span>{CATEGORY_NAMES[id]}</span>
            </button>
          ))}
        </div>
        <PromptField
          key={brief}
          className="v-prompt--compact v-work__prompt"
          label="Describe what you want to build"
          placeholder={brief || ex.placeholder}
          submitLabel="Update brief"
          onSubmit={(v) => v && onBrief(v)}
        />
      </div>

      <div className="v-work__grid">
        <div className="v-work__side">
          <Widget
            title="Site"
            summary={siteSummary}
            aside={<ExampleTag />}
            open={open.site}
            onToggle={() => toggle('site')}
          >
            <div className="v-site">
              <PromptField
                className="v-prompt--compact"
                label="Address or parcel"
                placeholder={address || 'Address or parcel'}
                submitLabel="Find site"
                arrow="right"
                onSubmit={(v) => v && setAddress(v)}
              />
              <div className="v-site__body">
                <SiteMap />
                <dl className="v-facts">
                  {site.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              {address ? <p className="v-fine">Site lookup isn't connected yet, so this is an example site, not {address}.</p> : null}
            </div>
          </Widget>

          <Widget title="Your brief" summary={briefSummary} open={open.brief} onToggle={() => toggle('brief')}>
            <div className="v-questions">
              {ex.questions.map((q, qi) => (
                <div className="v-q" key={q.label}>
                  <span>{q.label}</span>
                  <Segmented
                    label={q.label}
                    options={q.options}
                    value={picks[qi] ?? q.initial}
                    onChange={(oi) => setPicks((p) => p.map((v, i) => (i === qi ? oi : v)))}
                  />
                </div>
              ))}
            </div>
          </Widget>
        </div>

        <Widget
          className="v-work__options"
          title="Three ways to build it"
          summary={pick.name}
          aside={<ExampleTag>Examples</ExampleTag>}
          open={open.options}
          onToggle={() => toggle('options')}
        >
          <ViewerPanel category={category} option={chosen} optionName={pick.name} geometry={geometry} engine={Boolean(live)}>
            {live?.options[chosen] ? <Checks checks={live.options[chosen].checks} /> : null}
          </ViewerPanel>
          <div className="v-options" role="radiogroup" aria-label="Options">
            {options.map((o, i) => (
              <button
                key={o.name}
                type="button"
                role="radio"
                aria-checked={i === chosen}
                className="v-opt"
                onClick={() => setChosen(i)}
              >
                <Pill tone={o.bestFit ? 'accent' : 'plain'}>{o.bestFit ? 'Best fit' : `Option ${'ABC'[i]}`}</Pill>
                <h3>{o.name}</h3>
                <div className="v-opt__big">
                  {o.headline}
                  <small>{o.headlineLabel} · example</small>
                </div>
                <dl>
                  {o.metrics.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </button>
            ))}
          </div>
        </Widget>
      </div>

      <div className="v-work__cta v-glass">
        <div className="v-work__cta-text">
          <AppIcon id={category} size="sm" />
          <span>
            <b>{pick.name}</b>
            <span className="v-fine">Build packages are coming soon</span>
          </span>
        </div>
        <Button disabled>Get build package</Button>
      </div>
    </div>
  );
}
