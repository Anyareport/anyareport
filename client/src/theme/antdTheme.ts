import type { ThemeConfig } from 'antd';

export const baseAntdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#E63333',
    colorInfo: '#3481f5',
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
    Segmented: {
      itemSelectedBg: '#E63333',
      itemSelectedColor: '#FFFFFF',
    },
  },
};

export const darkTokenOverrides: ThemeConfig['token'] = {
  colorPrimary: '#E63333',
  colorBgBase: '#111827',
  colorTextBase: '#F9FAFB',
  colorBgContainer: '#0f1115',
  //  colorBgElevated: '#E63333',
  colorBgLayout: '#0f1115',
  colorBorder: '#353535',
  colorBorderSecondary: '#353535',
};

export const lightTokenOverrides: ThemeConfig['token'] = {
  colorBgBase: '#FFFFFF',
  colorTextBase: '#3c3d41',
};

export const darkComponentOverrides: ThemeConfig['components'] = {
  Drawer: {
    colorBgElevated: '#0f1115',
  },
  Segmented: {
    itemSelectedBg: '#E63333',
    itemSelectedColor: '#FFFFFF',
  },
};

export const fonts = {
  heading: "'Roboto', sans-serif",
  body: "'Roboto', sans-serif",
};

export const colors = {
  red: '#E63333',
  white: '#FFFFFF',
  navy: '#282F49',
};
