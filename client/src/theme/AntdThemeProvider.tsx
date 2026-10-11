import { ConfigProvider, theme as antdTheme } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { useLayoutEffect, type ReactNode } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import {
  baseAntdTheme,
  darkTokenOverrides,
  lightTokenOverrides,
  darkComponentOverrides,
} from './antdTheme';
import { sharedColors } from './colorTokens';

function CssTokenSync() {
  const { token } = antdTheme.useToken();
  const sharedColorSignature = Object.entries(sharedColors)
    .map(([name, value]) => `${name}:${value}`)
    .join('|');

  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--app-color-primary', token.colorPrimary);
    root.setProperty('--app-color-primary-hover', token.colorPrimaryHover);
    root.setProperty('--app-color-primary-active', token.colorPrimaryActive);
    root.setProperty('--app-color-brand-navy', sharedColors.brandNavy);
    root.setProperty('--app-color-info', token.colorInfo);
    root.setProperty('--app-color-link', token.colorLink);
    root.setProperty('--app-color-text', token.colorText);
    root.setProperty('--app-color-text-secondary', token.colorTextSecondary);
    root.setProperty('--app-color-bg-container', token.colorBgContainer);
    root.setProperty('--app-color-bg-layout', token.colorBgLayout);
    root.setProperty('--app-color-border', token.colorBorder);
    root.setProperty('--app-color-border-secondary', token.colorBorderSecondary);
    root.setProperty('--app-font-family', token.fontFamily);
    root.setProperty('--app-border-radius', `${token.borderRadius}px`);
    Object.entries(sharedColors).forEach(([name, value]) => {
      root.setProperty(`--shared-color-${name}`, value);
    });
  }, [sharedColorSignature, token]);

  return null;
}

export function AntdThemeProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <ConfigProvider
      spin={{ indicator: <LoadingOutlined spin /> }}
      theme={{
        ...baseAntdTheme,
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          ...baseAntdTheme.token,
          ...(isDark ? darkTokenOverrides : lightTokenOverrides),
        },
        components: {
          ...baseAntdTheme.components,
          ...(isDark ? darkComponentOverrides : {}),
        },
      }}
    >
      <CssTokenSync />
      {children}
    </ConfigProvider>
  );
}
