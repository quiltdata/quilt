/* constants for use in CSS. prefer integers over strings so we can do math */
import { colors, createMuiTheme, Theme } from '@material-ui/core'
import {
  PaletteOptions,
  SimplePaletteColorOptions,
} from '@material-ui/core/styles/createPalette'
import { TypographyOptions } from '@material-ui/core/styles/createTypography'
import { MixinsOptions } from '@material-ui/core/styles/createMixins'
import { Overrides } from '@material-ui/core/styles/overrides'
import { ThemeOptions } from '@material-ui/core/styles/createMuiTheme'
import { CSSProperties } from '@material-ui/core/styles/withStyles'

const defaultTheme = createMuiTheme()

const appPalette: PaletteOptions = {
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
}

// `tertiary` is a Quilt-specific palette extension not present in MUI's PaletteOptions
const websitePalette: PaletteOptions & { tertiary?: SimplePaletteColorOptions } = {
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

// `monospace` is a Quilt-specific typography variant not present in MUI's TypographyOptions.
// `fontFamily` carries an array (JSS joins it at runtime), which the strict CSSProperties
// type does not model, so the variant value is typed loosely to preserve the value exactly.
const baseTypography: TypographyOptions & {
  monospace?: { fontFamily: string[] }
} = {
  monospace: {
    fontFamily: ['Roboto Mono', 'monospace'],
  },
}

const appTypography: TypographyOptions & { monospace?: { fontFamily: string[] } } = {
  ...baseTypography,
}

const websiteTypography: TypographyOptions & {
  monospace?: { fontFamily: string[] }
} = {
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

const tooltipOverrides: Overrides = {
  MuiTooltip: {
    tooltip: {
      ...defaultTheme.typography.body2,
    },
  },
}

// JSS accepts array values that MUI's csstype-based CSSProperties does not model:
// an array-of-arrays for `padding` (space-joined → "8px 24px") and an array of
// `backgroundImage` values (fallbacks). Cast these specific values to preserve
// the exact runtime styles.
const websiteOverrides: Overrides = {
  MuiAppBar: {
    colorPrimary: {
      background: (appPalette.primary as SimplePaletteColorOptions).main,
    },
  },
  MuiButton: {
    root: {
      padding: [[8, 24]] as unknown as CSSProperties['padding'],
      borderRadius: 2,
    },
    containedPrimary: {
      backgroundImage: [
        'linear-gradient(to left, #f1b39d, #f78881)',
        'linear-gradient(to top, #000000, rgba(255, 255, 255, 0.7))',
      ] as unknown as CSSProperties['backgroundImage'],
    },
    containedSecondary: {
      backgroundImage: [
        'linear-gradient(225deg, #5c83ea, #6752e6)',
        'linear-gradient(to top, #000000, rgba(255, 255, 255, 0.7))',
      ] as unknown as CSSProperties['backgroundImage'],
    },
  },
}

const mixins: MixinsOptions = {
  // see https://css-tricks.com/almanac/properties/l/line-clamp/
  lineClamp: (lines: number): CSSProperties => ({
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: lines,
    display: '-webkit-box',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
}

// default app theme
export const appTheme: Theme = createMuiTheme({
  palette: appPalette,
  typography: appTypography,
  mixins,
  overrides: tooltipOverrides,
})

// theme used for navbar and footer
export const navTheme: Theme = createMuiTheme({
  palette: websitePalette,
  typography: appTypography,
  overrides: { ...tooltipOverrides, ...websiteOverrides },
  mixins,
})

// theme used for "website" pages
export const websiteTheme: Theme = createMuiTheme({
  palette: websitePalette,
  typography: websiteTypography,
  overrides: { ...tooltipOverrides, ...websiteOverrides },
  mixins,
})

interface CustomAppThemeOptions extends ThemeOptions {
  mixins?: MixinsOptions
}

export const createCustomAppTheme = (
  { palette, typography, mixins: mxs, ...rest }: CustomAppThemeOptions,
  ...args: object[]
): Theme =>
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
  ;(window as Window & { THEMES?: object }).THEMES = { appTheme, navTheme, websiteTheme }
}
