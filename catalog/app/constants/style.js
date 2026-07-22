/* constants for use in CSS. prefer integers over strings so we can do math */
import { colors, createMuiTheme } from '@material-ui/core'

const defaultTheme = createMuiTheme()

const appPalette = {
  primary: {
    main: '#282b50',
    dark: '#1d2146',
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
    main: '#282b50',
  },
}

const websitePalette = {
  type: 'dark',
  background: {
    default: '#19163b',
  },
  primary: {
    contrastText: colors.common.white,
    light: '#fabdb3',
    main: '#f38681',
  },
  secondary: {
    main: '#5471f1',
    dark: '#2d306d',
  },
  tertiary: {
    contrastText: colors.common.white,
    main: '#6a93ff',
  },
  text: {
    primary: 'rgba(255, 255, 255, 0.85)',
    secondary: 'rgba(255, 255, 255, 0.6)',
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

const tooltipOverrides = {
  MuiTooltip: {
    tooltip: {
      ...defaultTheme.typography.body2,
    },
  },
}

const websiteOverrides = {
  MuiAppBar: {
    colorPrimary: {
      background: appPalette.primary.main,
    },
  },
  MuiButton: {
    root: {
      padding: [[8, 24]],
      borderRadius: 2,
    },
    containedPrimary: {
      backgroundImage: [
        'linear-gradient(to left, #f1b39d, #f78881)',
        'linear-gradient(to top, #000000, rgba(255, 255, 255, 0.7))',
      ],
    },
    containedSecondary: {
      backgroundImage: [
        'linear-gradient(225deg, #5c83ea, #6752e6)',
        'linear-gradient(to top, #000000, rgba(255, 255, 255, 0.7))',
      ],
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
  overrides: tooltipOverrides,
})

// theme used for navbar and footer
export const navTheme = createMuiTheme({
  palette: websitePalette,
  typography: appTypography,
  overrides: { ...tooltipOverrides, ...websiteOverrides },
  mixins,
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
  window.THEMES = { appTheme, navTheme }
}
