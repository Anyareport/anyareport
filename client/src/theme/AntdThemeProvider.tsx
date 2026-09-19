import { ConfigProvider, theme as antdTheme } from 'antd';
import type { ReactNode } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { baseAntdTheme, darkTokenOverrides, lightTokenOverrides } from './antdTheme';

export function AntdThemeProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <ConfigProvider
      theme={{
        ...baseAntdTheme,
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          ...baseAntdTheme.token,
          ...(isDark ? darkTokenOverrides : lightTokenOverrides),
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
