import type { Theme } from '@material-ui/core'

// the `tertiary` palette entry exists only on `websitePalette` (constants/style.js,
// used by `navTheme`), so it is typed here rather than via global palette augmentation
export interface WebsiteTheme extends Theme {
  palette: Theme['palette'] & {
    tertiary: {
      contrastText: string
      main: string
    }
  }
}
