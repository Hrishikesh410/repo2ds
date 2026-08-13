export interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onPress?: () => void;
}

export function Button({ label, variant = 'primary', disabled, onPress }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPress}
      style={{
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 8,
        paddingBottom: 8,
        borderRadius: 8,
        fontSize: 14,
        fontWeight: '600',
        backgroundColor: variant === 'primary' ? '#2563EB' : '#FFFFFF',
        color: variant === 'primary' ? '#FFFFFF' : '#111827',
      }}
    >
      {label}
    </button>
  );
}
