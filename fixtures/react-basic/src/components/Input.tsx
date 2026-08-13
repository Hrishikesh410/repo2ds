interface InputProps {
  value: string;
  placeholder?: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}

export default function Input({ value, placeholder, invalid, onChange }: InputProps) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      style={{
        padding: 8,
        borderRadius: 4,
        fontSize: 14,
        color: '#111827',
        borderColor: invalid ? '#DC2626' : '#D1D5DB',
      }}
    />
  );
}
