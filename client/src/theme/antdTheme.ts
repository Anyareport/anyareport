import type { ThemeConfig } from 'antd';
import { sharedColors } from './colorTokens';

export const baseAntdTheme: ThemeConfig = {
  token: {
    colorPrimary: sharedColors.brandPrimary,
    colorInfo: sharedColors.infoBlue,
    colorTextBase: sharedColors.brandNavy,
    colorBgBase: sharedColors.white,
    fontFamily: 'Roboto, sans-serif',
    borderRadius: 6,
  },
  components: {
    Layout: {
      siderBg: sharedColors.brandNavy,
      triggerBg: sharedColors.navyDeep,
    },
    Menu: {
      darkItemBg: sharedColors.brandNavy,
      darkSubMenuItemBg: sharedColors.navyDeep,
    },
    Button: {
      primaryShadow: 'none',
    },
    Segmented: {
      itemSelectedBg: sharedColors.brandPrimary,
      itemSelectedColor: sharedColors.white,
    },
    Select: {
      optionSelectedBg: sharedColors.red100,
      optionSelectedColor: sharedColors.red800,
      optionActiveBg: sharedColors.red50,
    },
  },
};

export const darkTokenOverrides: ThemeConfig['token'] = {
  colorBgBase: sharedColors.gray900,
  colorTextBase: sharedColors.gray50,
  colorBgContainer: sharedColors.darkCanvas,
  colorBgElevated: sharedColors.darkElevated,
  colorBgLayout: sharedColors.darkCanvas,
  colorBorder: sharedColors.charcoalBorder,
  colorBorderSecondary: sharedColors.charcoalBorder,
};

export const lightTokenOverrides: ThemeConfig['token'] = {
  colorBgBase: sharedColors.white,
  colorTextBase: sharedColors.neutralText,
};

export const darkComponentOverrides: ThemeConfig['components'] = {
  Drawer: {
    colorBgElevated: sharedColors.darkCanvas,
  },
  Segmented: {
    itemSelectedBg: sharedColors.brandPrimary,
    itemSelectedColor: sharedColors.white,
  },
  Select: {
    optionSelectedBg: sharedColors.selectDarkBg,
    optionSelectedColor: sharedColors.red50,
    optionActiveBg: sharedColors.red50,
  },
};

export const fonts = {
  heading: "'Roboto', sans-serif",
  body: "'Roboto', sans-serif",
};

export const colors = {
  red: sharedColors.brandPrimary,
  white: sharedColors.white,
  navy: sharedColors.brandNavy,
};
