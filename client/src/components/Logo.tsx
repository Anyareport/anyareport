import { AlertOutlined } from '@ant-design/icons';
import { sharedColors } from '../theme/colorTokens';

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
        <AlertOutlined style={{ fontSize: fontSize * 0.9, color: sharedColors.brandPrimary }} />
      )}
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize, letterSpacing: 1 }}>
        <span style={{ color: 'var(--text-primary)' }}>ANYA</span>
        <span style={{ color: sharedColors.brandPrimary }}>REPORT</span>
      </span>
    </div>
  );
}
