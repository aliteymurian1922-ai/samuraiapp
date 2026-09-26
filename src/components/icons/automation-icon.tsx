type Props = { className?: string };

export function AutomationIcon({ className = "" }: Props) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center font-black leading-none ${className}`}
    >
      ↻
    </span>
  );
}
