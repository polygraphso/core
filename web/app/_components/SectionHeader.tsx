type Props = {
  number: string; // "§ 02"
  label: string; // "How we test"
  title?: string; // optional larger title
  children?: React.ReactNode;
};

export function SectionHeader({ number, label, title, children }: Props) {
  return (
    <div className="border-t hairline pt-6 mb-10">
      <div className="flex items-baseline gap-4">
        <span className="section-label tabular">{number}</span>
        <span className="section-label">/</span>
        <span className="section-label">{label}</span>
      </div>
      {title && (
        <h2 className="font-serif text-3xl md:text-4xl tracking-tight text-ink mt-3 max-w-3xl leading-[1.1]">
          {title}
        </h2>
      )}
      {children && (
        <div className="mt-3 max-w-2xl text-ink-muted leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}
