import './theme.css';

export interface BannerProps {
  title: string;
  tone?: 'info' | 'warning';
  dismissible?: boolean;
  onDismiss?: () => void;
}

export function Banner({ title, tone = 'info', dismissible = false, onDismiss }: BannerProps) {
  return (
    <section className="banner" style={{ padding: 16, borderRadius: 8 }}>
      <h2 className="banner__title">{title}</h2>
      <p style={{ color: tone === 'info' ? '#2563EB' : '#B45309', fontSize: 14 }}>{tone}</p>
      {dismissible ? <button onClick={onDismiss}>Dismiss</button> : null}
    </section>
  );
}
