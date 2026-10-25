import type { ThemeConfig } from 'antd';
import { sharedColors } from './colorTokens';

export const baseAntdTheme: ThemeConfig = {
  token: {
    colorPrimary: sharedColors.brandPrimary,
    colorInfo: sharedColors.infoBlue,
    colorLink: sharedColors.brandPrimary,
    colorTextBase: sharedColors.brandNavy,
    colorText: sharedColors.neutralText,
    colorTextSecondary: sharedColors.lightTextSecondary,
    colorBgBase: sharedColors.white,
    colorBgContainer: sharedColors.white,
    colorBgElevated: sharedColors.white,
    colorBorder: sharedColors.borderDefault,
    colorBorderSecondary: sharedColors.borderSubtle,
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
      optionSelectedBg: sharedColors.blue100,
      optionSelectedColor: sharedColors.blueDark,
      optionActiveBg: sharedColors.blue100,
    },
  },
};

export const darkTokenOverrides: ThemeConfig['token'] = {
  colorPrimary: sharedColors.brandPrimaryLight,
  colorLink: sharedColors.brandPrimaryLight,
  colorBgBase: sharedColors.gray900,
  colorTextBase: sharedColors.darkText,
  colorText: sharedColors.darkText,
  colorTextSecondary: sharedColors.darkTextSecondary,
  colorBgContainer: sharedColors.darkElevated,
  colorBgElevated: sharedColors.darkElevated,
  colorBgLayout: sharedColors.darkCanvas,
  colorBorder: sharedColors.charcoalBorder,
  colorBorderSecondary: sharedColors.charcoalBorder,
};

export const lightTokenOverrides: ThemeConfig['token'] = {
  colorBgBase: sharedColors.white,
  colorBgLayout: sharedColors.layoutBackground,
  colorTextBase: sharedColors.neutralText,
  colorText: sharedColors.neutralText,
  colorTextSecondary: sharedColors.lightTextSecondary,
  colorBgContainer: sharedColors.white,
  colorBgElevated: sharedColors.white,
  colorBorder: sharedColors.borderDefault,
  colorBorderSecondary: sharedColors.borderSubtle,
};

export const darkComponentOverrides: ThemeConfig['components'] = {
  Drawer: {
    colorBgElevated: sharedColors.darkCanvas,
  },
  Segmented: {
    itemSelectedBg: sharedColors.brandPrimaryLight,
    itemSelectedColor: sharedColors.white,
  },
  Select: {
    optionSelectedBg: sharedColors.selectDarkBg,
    optionSelectedColor: sharedColors.blue100,
    optionActiveBg: sharedColors.selectDarkBg,
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
