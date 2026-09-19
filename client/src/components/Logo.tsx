import { AlertOutlined } from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const sizes = { sm: 20, md: 28, lg: 36 };

export default function Logo({ size = 'md', showIcon = true }: LogoProps) {
  const { theme } = useTheme();
  const fontSize = sizes[size];
  const textColor = theme === 'dark' ? '#F9FAFB' : '#3c3d41';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {showIcon && <AlertOutlined style={{ fontSize: fontSize * 0.9, color: '#E63333' }} />}
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize, letterSpacing: 1 }}>
        <span style={{ color: textColor }}>ANYA</span>
        <span style={{ color: '#E63333' }}>REPORT</span>
      </span>
    </div>
  );
}
