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
    main: colors.lightBlue[50],
  },
  warning: {
    main: colors.yellow[200],
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
    secondary: '#b2bddb',
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

const websiteTypography = {
  ...baseTypography,
  h1: {
    fontSize: '3rem',
    lineHeight: '3.5rem',
  },
  h2: {
    fontSize: '2.25rem',
    lineHeight: 44 / 36,
  },
  h3: {
    fontSize: '1.75rem',
    lineHeight: 32 / 28,
  },
  h4: {
    fontSize: '1.25rem',
    lineHeight: 1.4,
  },
  h5: {
    fontSize: '1rem',
    lineHeight: 1.5,
  },
  body1: {
    lineHeight: 2,
  },
  body2: {
    lineHeight: 2,
  },
  button: {
    fontWeight: defaultTheme.typography.fontWeightRegular,
  },
}

const websiteOverrides = {
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

// default app theme
export const appTheme = createMuiTheme({
  palette: appPalette,
  typography: appTypography,
})

// theme used for navbar and footer
export const navTheme = createMuiTheme({
  palette: websitePalette,
  typography: appTypography,
  overrides: websiteOverrides,
})

// theme used for marketing pages
export const websiteTheme = createMuiTheme({
  palette: websitePalette,
  typography: websiteTypography,
  overrides: websiteOverrides,
})

export const createCustomAppTheme = ({ palette, typography, ...rest }, ...args) =>
  createMuiTheme(
    {
      palette: { ...appPalette, ...palette },
      typography: { ...appTypography, ...typography },
      ...rest,
    },
    ...args,
  )

// expose themes for development purposes
if (process.env.NODE_ENV === 'development') {
  window.THEMES = { appTheme, navTheme, websiteTheme }
}
