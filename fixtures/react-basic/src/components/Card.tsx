import type { ReactNode } from 'react';

type CardProps = {
  title: string;
  subtitle?: string;
  elevated?: boolean;
  children?: ReactNode;
};

export const Card = (props: CardProps) => {
  return (
    <div
      style={{
        padding: 16,
        margin: 8,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>{props.title}</h3>
      {props.subtitle ? (
        <span style={{ fontSize: 14, color: '#6B7280' }}>{props.subtitle}</span>
      ) : null}
      {props.children}
    </div>
  );
};
