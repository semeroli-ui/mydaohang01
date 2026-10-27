// src/theme.ts
// ─────────────────────────────────────────────────────────────────────────────
// 设计变量（token）的唯一来源。
//
// 立此文件的起因：圆角、阴影、字号此前散落在 9 个组件里各写一套 ——
// 同样一张「站点卡片」，在 SiteCard 里是 `borderRadius: 3`（=36px），
// 在 GroupCard 里是 `borderRadius: 4`（=16px），在 ThemeToggle 里又是一套；
// 阴影从 elevation 1 一路用到 8，其中 8 档里有 6 档肉眼分不出区别。
//
// 现在全站只允许引用这里的变量：
//   · 圆角 → RADIUS.*         （四档）
//   · 阴影 → theme.shadows[n] （三档，通过 sx 的 boxShadow 数字索引取值）
//   · 字号 → theme.typography.* （语义化变体）
//
// 注意 MUI 的一个坑：sx 里的 `borderRadius: 3` 不是 3px，而是
// theme.shape.borderRadius × 3。所以只要有人改了 shape.borderRadius，
// 所有写数字的圆角会一起跟着放大 —— 这也正是要换成 RADIUS.* 的原因。
// ─────────────────────────────────────────────────────────────────────────────

import { createTheme, type Theme } from '@mui/material/styles';

/**
 * 圆角：全站只保留四档。
 *
 * 一律是带 px 的字符串，不是数字 —— 因为 MUI 的 sx 会把「数字」圆角
 * 乘以 theme.shape.borderRadius：`borderRadius: 12` 在 shape=12 时等于 144px。
 * 写成 '12px' 才是字面值。这个坑本人已经踩过一次（卡片圆角一度变成 144px）。
 */
export const RADIUS = {
  /** 输入框、按钮、图标按钮、小标签 */
  control: '8px',
  /** 站点卡片 */
  card: '12px',
  /** 分组容器、弹窗、菜单 */
  surface: '16px',
  /** 胶囊（圆形角标、头像占位） */
  pill: '999px',
} as const;

/** 字号：全站只保留四档。单位 px。语义变体见下方 typography。 */
export const FONT_SIZE = {
  /** 卡片描述、计数、辅助说明、按钮 */
  caption: 13,
  /** 正文、卡片标题 */
  body: 15,
  /** 分组标题 */
  section: 22,
  /** 页面主标题 */
  title: 32,
} as const;

/**
 * 三档阴影。深色模式下阴影几乎不可见（深色底靠亮度分层），
 * 所以深色用更重的不透明度，浅色用带蓝调的灰，避免发脏。
 */
const SHADOW = {
  light: {
    /** 静止的卡片 —— 几乎只是「贴住」页面 */
    rest: '0 1px 2px rgba(16, 24, 40, 0.04), 0 2px 8px -2px rgba(16, 24, 40, 0.06)',
    /** 悬停 / 浮起一级 */
    hover: '0 8px 16px -6px rgba(16, 24, 40, 0.10), 0 16px 32px -12px rgba(16, 24, 40, 0.12)',
    /** 拖拽中 / 弹窗 —— 明显离开页面 */
    float: '0 16px 32px -8px rgba(16, 24, 40, 0.14), 0 40px 64px -16px rgba(16, 24, 40, 0.16)',
  },
  dark: {
    rest: '0 1px 2px rgba(0, 0, 0, 0.32), 0 2px 8px -2px rgba(0, 0, 0, 0.40)',
    hover: '0 8px 16px -6px rgba(0, 0, 0, 0.45), 0 16px 32px -12px rgba(0, 0, 0, 0.50)',
    float: '0 16px 32px -8px rgba(0, 0, 0, 0.55), 0 40px 64px -16px rgba(0, 0, 0, 0.60)',
  },
} as const;

/**
 * MUI 内部固定读 shadows[0..24]（Paper 的 elevation、Menu/Popover/Dialog 的默认高度
 * 都是写死的数字），所以必须凑满 25 项。这里按区间把 25 个索引压回三档：
 *   0       → 无
 *   1–3     → rest
 *   4–6     → hover
 *   7–24    → float
 * 这样即使某个 MUI 组件自己传了 elevation={8}，也只会落在 float 档，不会出现第四种阴影。
 */
function buildShadows(mode: 'light' | 'dark'): string[] {
  const s = SHADOW[mode];
  return Array.from({ length: 25 }, (_, i) => {
    if (i === 0) return 'none';
    if (i <= 3) return s.rest;
    if (i <= 6) return s.hover;
    return s.float;
  });
}

/** 系统字体栈。中文不再依赖 Roboto —— Roboto 里没有任何一个汉字。 */
const FONT_FAMILY = [
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  '"PingFang SC"',
  '"Hiragino Sans GB"',
  '"Microsoft YaHei"',
  '"Noto Sans SC"',
  '"Helvetica Neue"',
  'Arial',
  'sans-serif',
].join(', ');

export function createAppTheme(mode: 'light' | 'dark'): Theme {
  const dark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: dark
        ? {
            main: '#60A5FA',
            light: '#93C5FD',
            dark: '#3B82F6',
            // 浅蓝底上必须放深色字，白字对比度只有 2.2:1，读不清
            contrastText: '#0B1220',
          }
        : {
            main: '#2563EB',
            light: '#DBEAFE',
            dark: '#1D4ED8',
            contrastText: '#FFFFFF',
          },
      background: dark
        ? { default: '#0F1115', paper: '#181B21' }
        : { default: '#F7F8FA', paper: '#FFFFFF' },
      text: dark
        ? { primary: '#E8EAED', secondary: '#9AA3AF', disabled: '#5C6470' }
        : { primary: '#111827', secondary: '#6B7280', disabled: '#9CA3AF' },
      divider: dark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(17, 24, 39, 0.09)',
      action: dark
        ? { hover: 'rgba(255, 255, 255, 0.06)', selected: 'rgba(255, 255, 255, 0.11)' }
        : { hover: 'rgba(17, 24, 39, 0.04)', selected: 'rgba(17, 24, 39, 0.08)' },
      success: dark
        ? { main: '#4ADE80', contrastText: '#052E16' }
        : { main: '#15803D', contrastText: '#FFFFFF' },
    },

    shape: {
      // MUI 内部（ToggleButton、Chip 等）直接读这个基准值。
      // 组件里一律用上面的 RADIUS.*（带 px 的字符串），不要在 sx 里写数字。
      borderRadius: 12,
    },

    shadows: buildShadows(mode) as Theme['shadows'],

    typography: {
      fontFamily: FONT_FAMILY,
      // 中文在 rem 下的行高容易挤，统一收紧字距并给足行高
      h1: { fontSize: 34, fontWeight: 700, lineHeight: 1.25, letterSpacing: 0 },
      h2: { fontSize: 28, fontWeight: 700, lineHeight: 1.3, letterSpacing: 0 },
      h3: { fontSize: FONT_SIZE.title, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.01em' },
      h4: { fontSize: 24, fontWeight: 700, lineHeight: 1.3, letterSpacing: 0 },
      h5: { fontSize: FONT_SIZE.section, fontWeight: 600, lineHeight: 1.35, letterSpacing: 0 },
      h6: { fontSize: 17, fontWeight: 600, lineHeight: 1.4, letterSpacing: 0 },
      subtitle1: { fontSize: FONT_SIZE.body, fontWeight: 600, lineHeight: 1.4, letterSpacing: 0 },
      subtitle2: { fontSize: 14, fontWeight: 600, lineHeight: 1.45, letterSpacing: 0 },
      body1: { fontSize: FONT_SIZE.body, lineHeight: 1.65, letterSpacing: 0 },
      body2: { fontSize: FONT_SIZE.caption, lineHeight: 1.6, letterSpacing: 0 },
      caption: { fontSize: 12, lineHeight: 1.5, letterSpacing: 0 },
      button: { fontSize: 14, fontWeight: 600, letterSpacing: 0, textTransform: 'none' },
    },

    components: {
      // 深色模式下 MUI 会给每个 Paper 叠一层白色渐变来模拟高度，
      // 自定义了深色色板之后这层渐变会把 #181B21 洗成灰蓝，必须关掉。
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },

      MuiCard: {
        styleOverrides: {
          root: { borderRadius: RADIUS.card },
        },
      },

      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: RADIUS.control,
            paddingInline: 14,
            minWidth: 0,
          },
          sizeSmall: {
            fontSize: FONT_SIZE.caption,
            paddingBlock: 5,
            paddingInline: 12,
          },
        },
      },

      MuiIconButton: {
        styleOverrides: {
          root: { borderRadius: RADIUS.control },
        },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: RADIUS.control },
        },
      },

      MuiMenu: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: RADIUS.card,
            border: `1px solid ${theme.palette.divider}`,
          }),
        },
      },

      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: RADIUS.surface },
        },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: { fontSize: 12, borderRadius: RADIUS.control, padding: '6px 10px' },
        },
      },

      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: RADIUS.control },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: { borderRadius: RADIUS.control },
        },
      },

      MuiSnackbarContent: {
        styleOverrides: {
          root: { borderRadius: RADIUS.control },
        },
      },
    },
  });
}
