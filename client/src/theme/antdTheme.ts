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
    Select: {
      optionSelectedBg: '#fee2e2',
      optionSelectedColor: '#b91c1c',
      optionActiveBg: '#fff1f0',
    },
  },
};

export const darkTokenOverrides: ThemeConfig['token'] = {
  colorPrimary: '#E63333',
  colorBgBase: '#111827',
  colorTextBase: '#F9FAFB',
  colorBgContainer: '#0f1115',
  colorBgElevated: '#17191f',
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
  Select: {
    optionSelectedBg: '#572328',
    optionSelectedColor: '#fff1f0',
    optionActiveBg: '#292024',
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
