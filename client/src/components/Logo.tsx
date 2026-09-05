import { AlertOutlined } from '@ant-design/icons';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  light?: boolean;
}

const sizes = { sm: 20, md: 28, lg: 36 };

export default function Logo({ size = 'md', showIcon = true, light = false }: LogoProps) {
  const fontSize = sizes[size];
  const navy = light ? '#FFFFFF' : '#282F49';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {showIcon && <AlertOutlined style={{ fontSize: fontSize * 0.9, color: '#E63333' }} />}
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize, letterSpacing: 1 }}>
        <span style={{ color: navy }}>ANYA</span>
        <span style={{ color: '#E63333' }}>REPORT</span>
      </span>
    </div>
  );
}
