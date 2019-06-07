import { createMuiTheme } from '@material-ui/core/styles'

export default (t) =>
  createMuiTheme({
    ...t,
    palette: {
      // ...t.palette,
      type: 'dark',
      background: {
        default: '#19163b',
      },
      primary: {
        contrastText: t.palette.common.white,
        light: '#fabdb3',
        main: '#f38681',
      },
      secondary: {
        main: '#5471f1',
        dark: '#2d306d',
      },
      tertiary: {
        main: '#6a93ff',
      },
      text: {
        secondary: '#b2bddb',
      },
    },
    shape: {
      borderRadius: 2,
    },
    typography: {
      h1: {
        fontSize: '3rem',
        lineHeight: '4rem',
      },
      h2: {
        fontSize: '2.25rem',
      },
      h3: {
        fontSize: '1.75rem',
      },
      h4: {
        fontSize: '1.25rem',
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
        fontWeight: t.typography.fontWeightRegular,
      },
    },
    overrides: {
      ...t.overrides,
      MuiTypography: {},
      MuiButton: {
        root: {
          padding: [[8, 24]],
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
    },
  })
