interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md';
  disabled?: boolean;
}

const VARIANT_CLASSES = {
  primary: 'bg-blue-600 text-white',
  secondary: 'bg-gray-100 text-gray-900',
};

export function Button({ label, variant = 'primary', size = 'md', disabled }: ButtonProps) {
  return (
    <button
      className={`px-4 py-2 rounded-lg text-sm font-semibold ${VARIANT_CLASSES[variant]}`}
      disabled={disabled}
      data-size={size}
    >
      {label}
    </button>
  );
}
