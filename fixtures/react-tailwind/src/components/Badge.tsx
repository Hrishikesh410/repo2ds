export interface BadgeProps {
  label: string;
  tone?: 'neutral' | 'success';
}

export const Badge = ({ label, tone = 'neutral' }: BadgeProps) => (
  <span
    className={
      tone === 'success'
        ? 'px-4 py-2 rounded-lg text-sm bg-green-100 text-green-900'
        : 'px-4 py-2 rounded-lg text-sm bg-gray-100 text-gray-900'
    }
  >
    {label}
  </span>
);
