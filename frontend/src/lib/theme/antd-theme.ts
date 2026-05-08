import type { ThemeConfig } from 'antd';
import { colors, radius, spacing, typography } from './tokens';

/**
 * Single AntD ThemeConfig consumed by the root ConfigProvider.
 * Every component picks up brand colors automatically — no per-component CSS.
 */
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary:     colors.brandPrimary,
    colorInfo:        colors.info,
    colorSuccess:     colors.success,
    colorWarning:     colors.warning,
    colorError:       colors.error,
    colorTextBase:    colors.textPrimary,
    colorBgBase:      '#ffffff',
    colorBgLayout:    colors.bgBody,
    colorBorder:      colors.borderDefault,
    colorBorderSecondary: colors.borderLight,
    fontFamily:       typography.fontFamilySans,
    fontSize:         typography.fontSizeBase,
    borderRadius:     radius.base,
    borderRadiusSM:   radius.sm,
    borderRadiusLG:   radius.lg,
    sizeStep:         spacing.xs,
    sizeUnit:         spacing.xs,
  },
  components: {
    Layout: {
      headerBg:      colors.bgHeader,
      headerColor:   colors.textPrimary,
      headerHeight:  64,
      siderBg:       colors.bgSiderDark,
      bodyBg:        colors.bgBody,
      footerBg:      colors.bgBody,
      triggerBg:     colors.bgSiderHover,
      triggerColor:  colors.textInverse,
    },
    Menu: {
      darkItemBg:              colors.bgSiderDark,
      darkSubMenuItemBg:       colors.bgSiderHover,
      darkItemSelectedBg:      colors.brandPrimary,
      darkItemSelectedColor:   colors.textInverse,
      darkItemHoverBg:         colors.bgSiderHover,
      darkItemHoverColor:      colors.textInverse,
      darkItemColor:           '#b8c7ce', // legacy AdminLTE sidebar text
      itemHeight:              44,
    },
    Button: {
      borderRadius:    radius.base,
      controlHeight:   38,  // AdminLTE buttons are taller than AntD default
      controlHeightLG: 46,
      controlHeightSM: 30,
    },
    Card: {
      borderRadiusLG: radius.lg,
      headerBg:       '#fafafa',
      headerHeight:   48,
      paddingLG:      spacing.lg,
    },
    Table: {
      headerBg:           '#fafafa',
      headerColor:        colors.textPrimary,
      headerSplitColor:   colors.borderLight,
      borderColor:        colors.borderLight,
      rowHoverBg:         '#f5f7f9',
      cellPaddingBlock:   12,
    },
    Input: {
      controlHeight:   38,
      controlHeightLG: 46,
      paddingBlock:    9,
      paddingInline:   12,
    },
    Select: {
      controlHeight:   38,
      controlHeightLG: 46,
    },
    Form: {
      labelFontSize:    typography.fontSizeBase,
      verticalLabelPadding: '0 0 4px',
    },
    Tag: {
      borderRadiusSM: radius.sm,
    },
    Tabs: {
      itemColor:         colors.textSecondary,
      itemSelectedColor: colors.brandPrimary,
      itemHoverColor:    colors.brandPrimary,
      inkBarColor:       colors.brandPrimary,
      titleFontSize:     typography.fontSizeBase,
    },
    Breadcrumb: {
      itemColor:        colors.textMuted,
      lastItemColor:    colors.textPrimary,
      separatorColor:   colors.textMuted,
      linkColor:        colors.textSecondary,
      linkHoverColor:   colors.brandPrimary,
    },
    Modal: {
      borderRadiusLG: radius.lg,
      headerBg:       '#ffffff',
    },
    Tree: {
      directoryNodeSelectedBg:    colors.brandPrimary,
      directoryNodeSelectedColor: colors.textInverse,
      nodeSelectedBg:             '#e6f7fa', // light teal tint
      nodeHoverBg:                '#f5f7f9',
    },
    Statistic: {
      titleFontSize: typography.fontSizeSm,
    },
  },
};
