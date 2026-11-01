type Props = {
  label: string;
  options: readonly string[];
  value: number;
  onChange: (index: number) => void;
};

/** A row of pill toggles where exactly one is pressed. */
export function Segmented({ label, options, value, onChange }: Props) {
  return (
    <div className="v-seg" role="group" aria-label={label}>
      {options.map((o, i) => (
        <button key={o} type="button" aria-pressed={value === i} onClick={() => onChange(i)}>
          {o}
        </button>
      ))}
    </div>
  );
}
