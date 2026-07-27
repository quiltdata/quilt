import type { Theme } from '@material-ui/core'

// the `tertiary` palette entry exists only on `websiteTheme` (constants/style.js),
// so it is typed here rather than via global palette augmentation
export interface WebsiteTheme extends Theme {
  palette: Theme['palette'] & {
    tertiary: {
      contrastText: string
      main: string
    }
  }
}
