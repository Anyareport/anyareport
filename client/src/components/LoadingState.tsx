import { Spin } from 'antd';
import type { CSSProperties } from 'react';

interface LoadingStateProps {
  minHeight?: CSSProperties['minHeight'];
  size?: 'small' | 'default' | 'large';
}

export default function LoadingState({ minHeight = '50vh', size = 'large' }: LoadingStateProps) {
  return (
    <div style={{ display: 'grid', minHeight, placeItems: 'center' }}>
      <Spin size={size} />
    </div>
  );
}
