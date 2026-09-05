import type { ThemeConfig } from 'antd';

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#E63333',
    colorInfo: '#282F49',
    colorTextBase: '#282F49',
    colorBgBase: '#FFFFFF',
    fontFamily: 'Roboto, sans-serif',
    borderRadius: 6,
  },
  components: {
    Layout: {
      siderBg: '#282F49',
      triggerBg: '#1a2035',
    },
    Menu: {
      darkItemBg: '#282F49',
      darkSubMenuItemBg: '#1a2035',
    },
    Button: {
      primaryShadow: 'none',
    },
  },
};

export const fonts = {
  heading: "'Bebas Neue', sans-serif",
  body: "'Roboto', sans-serif",
};

export const colors = {
  red: '#E63333',
  white: '#FFFFFF',
  navy: '#282F49',
};
