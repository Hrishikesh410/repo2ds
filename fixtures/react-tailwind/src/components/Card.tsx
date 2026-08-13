import clsx from 'clsx';

export interface CardProps {
  title: string;
  subtitle?: string;
  elevated?: boolean;
}

export function Card({ title, subtitle, elevated }: CardProps) {
  return (
    <section
      className={clsx('flex flex-col gap-4 p-4 rounded-lg bg-white', elevated && 'border-gray-200')}
    >
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {subtitle ? <p className="text-sm text-gray-500">{subtitle}</p> : null}
    </section>
  );
}
