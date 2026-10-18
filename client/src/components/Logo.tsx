import logoMark from '../assets/logo.svg';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const sizes = { sm: 20, md: 28, lg: 36 };

export default function Logo({ size = 'md', showIcon = true }: LogoProps) {
  const fontSize = sizes[size];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {showIcon && (
        <img
          src={logoMark}
          alt=""
          aria-hidden="true"
          style={{ width: fontSize * 1.1, height: fontSize * 1.1, flexShrink: 0 }}
        />
      )}
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize, letterSpacing: 1 }}>
        <span style={{ color: 'var(--text-primary)' }}>ANYA</span>
        <span style={{ color: 'var(--brand-primary)' }}>REPORT</span>
      </span>
    </div>
  );
}
