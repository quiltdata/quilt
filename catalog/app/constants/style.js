/* constants for use in CSS. prefer integers over strings so we can do math */
import { colors, createMuiTheme } from '@material-ui/core'

const defaultTheme = createMuiTheme()

const appPalette = {
  // Midnight primary (ratified 2026-07-22): the one dark that says Quilt — rail ground, primary actions, active fills. Deep step #100e28. Indigo #282b50 retired (trivially revertible).
  primary: {
    main: '#19163b',
    dark: '#100e28',
  },
  secondary: {
    main: colors.orange[600],
  },
  info: {
    main: colors.lightBlue[600],
    light: colors.lightBlue[50],
  },
  warning: {
    main: colors.yellow[200],
    dark: colors.yellow[900],
  },
  tertiary: {
    contrastText: colors.common.white,
    main: '#19163b',
  },
  // The navigation chrome (the midnight rail + its indicator vocabulary).
  navigation: {
    indicator: colors.orange[600],
    text: 'rgba(255, 255, 255, 0.85)',
    textMuted: 'rgba(255, 255, 255, 0.6)',
    hover: 'rgba(255, 255, 255, 0.06)',
    selected: 'rgba(255, 255, 255, 0.18)',
  },
}

const baseTypography = {
  monospace: {
    fontFamily: ['Roboto Mono', 'monospace'],
  },
}

const appTypography = {
  ...baseTypography,
}

const overrides = {
  MuiTooltip: {
    tooltip: {
      ...defaultTheme.typography.body2,
    },
  },
  // The Focus Ring Rule (DESIGN.md §2), applied once at the theme rather than
  // per surface: MUI sets `outline: 0` on every ButtonBase, so without this a
  // keyboard user has no ring at all on any button that doesn't hand-roll one --
  // which was every control on the search results surface.
  //
  // Midnight Chassis, which is the rule's light-surface half -- the app ground is
  // light everywhere except the rail. Not `currentColor`: on a contained primary
  // button that resolves to white, and the ring draws OUTSIDE the button (offset
  // 2) on the light page ground, so it would disappear precisely where it is most
  // needed.
  //
  // The rail is the midnight half of the rule and must keep its amber Indicator
  // ring -- a midnight ring on midnight ground is the very thing this prevents.
  // Its rules use `&&` to win on specificity outright rather than relying on JSS
  // injection order, which is not a contract worth betting a focus ring on.
  MuiButtonBase: {
    root: {
      '&.Mui-focusVisible': {
        outline: `2px solid ${appPalette.primary.main}`,
        outlineOffset: 2,
      },
    },
  },
}

const mixins = {
  // see https://css-tricks.com/almanac/properties/l/line-clamp/
  lineClamp: (lines) => ({
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: lines,
    display: '-webkit-box',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
}

// default app theme
export const appTheme = createMuiTheme({
  palette: appPalette,
  typography: appTypography,
  mixins,
  overrides,
})

export const createCustomAppTheme = (
  { palette, typography, mixins: mxs, ...rest },
  ...args
) =>
  createMuiTheme(
    {
      palette: { ...appPalette, ...palette },
      typography: { ...appTypography, ...typography },
      mixins: { ...mixins, ...mxs },
      ...rest,
    },
    ...args,
  )

// expose themes for development purposes
if (process.env.NODE_ENV === 'development') {
  window.THEMES = { appTheme }
}
