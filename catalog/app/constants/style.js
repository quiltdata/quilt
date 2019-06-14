/* constants for use in CSS. prefer integers over strings so we can do math */
import * as colors from '@material-ui/core/colors'
import { createMuiTheme } from '@material-ui/core/styles'

// TODO: deprecate, mv to theme
export const bodyColor = colors.grey[900]
export const bodySize = '1em'
export const headerColor = colors.grey[900]

const palette = {
  primary: {
    main: '#282b50',
    dark: '#1d2146',
  },
  secondary: {
    main: colors.orange[600],
  },
}

const typography = {
  monospace: {
    fontFamily: ['Roboto Mono', 'monospace'],
  },
}

const overrides = {
  MuiAppBar: {
    colorPrimary: {
      backgroundColor: '#2d306d',
    },
  },
}

export const theme = createMuiTheme({
  palette,
  typography,
  overrides,
})

// expose theme for development purposes
if (process.env.NODE_ENV === 'development') {
  window.THEME = theme
}

export const themeInverted = createMuiTheme({
  palette: { ...palette, type: 'dark' },
  typography,
  overrides,
})
