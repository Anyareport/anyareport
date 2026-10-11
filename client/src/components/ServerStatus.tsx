import { useEffect, useState } from 'react';
import { theme } from 'antd';
import { api } from '../lib/api';

type ServerState = 'checking' | 'active' | 'inactive';

export default function ServerStatus() {
  const [state, setState] = useState<ServerState>('checking');
  const { token } = theme.useToken();
  const statusDetails: Record<ServerState, { color: string; label: string }> = {
    checking: { color: token.colorWarning, label: 'Checking server...' },
    active: { color: token.colorSuccess, label: 'Server active' },
    inactive: { color: token.colorError, label: 'Server unavailable' },
  };

  const checkServer = async () => {
    try {
      await api.health();
      setState('active');
    } catch {
      setState('inactive');
    }
  };

  useEffect(() => {
    const initialCheck = window.setTimeout(() => void checkServer(), 0);
    const interval = window.setInterval(() => void checkServer(), 10_000);
    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(interval);
    };
  }, []);

  const details = statusDetails[state];

  return (
    <>
      <span
        aria-label={details.label}
        role="status"
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: details.color,
          boxShadow: `0 0 0 3px color-mix(in srgb, ${details.color} 18%, transparent)`,
        }}
      />
      <span style={{ marginLeft: 8, fontSize: 13 }}>{details.label}</span>
    </>
  );
}
