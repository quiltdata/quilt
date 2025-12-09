import { createMuiTheme, type ThemeOptions } from '@material-ui/core/styles'
import { describe, it, expect } from 'vitest'

const mockTheme = createMuiTheme({
  typography: {
    monospace: {
      fontFamily: 'monospace',
    },
  } as ThemeOptions['typography'],
})

/**
 * Creates a mock for @material-ui/core makeStyles that returns predictable class names
 * Instead of generated names like 'makeStyles-root-123', returns simple names like 'Namespace-root'
 *
 * Usage in tests:
 * ```
 * vi.mock('@material-ui/core', async () => ({
 *   ...(await vi.importActual('@material-ui/core')),
 *   makeStyles: makeStyles('ComponentName'),
 * }))
 * ```
 */
export function makeStyles(componentName: string) {
  return (stylesFn: Function | Object) => {
    const styles = typeof stylesFn === 'function' ? stylesFn(mockTheme) : stylesFn
    return (): Record<string, string> =>
      Object.keys(styles).reduce(
        (acc, key) => ({ ...acc, [key]: `${componentName}-${key}` }),
        {},
      )
  }
}

describe('utils/makeStyles.spec', () => {
  describe('makeStyles', () => {
    it('should return a function that creates namespaced class names', () => {
      const mockStylesFn = () => ({
        root: { color: 'red' },
        button: { padding: '8px' },
        small: { fontSize: '12px' },
      })

      const useStyles = makeStyles('TestComponent')(mockStylesFn)
      const classes = useStyles()

      expect(classes).toEqual({
        root: 'TestComponent-root',
        button: 'TestComponent-button',
        small: 'TestComponent-small',
      })
    })

    it('should handle style objects (non-function)', () => {
      const styleObj = {
        container: { display: 'flex' },
        item: { flexGrow: 1 },
      }

      const useStyles = makeStyles('MyComponent')(styleObj)
      const classes = useStyles()

      expect(classes).toEqual({
        container: 'MyComponent-container',
        item: 'MyComponent-item',
      })
    })

    it('should pass theme to style function', () => {
      const mockStylesFn = (theme: any) => {
        // The theme should be available and have expected properties
        expect(theme).toBeDefined()
        expect(theme.palette).toBeDefined()
        expect(theme.spacing).toBeDefined()

        return {
          root: { color: theme.palette.primary?.main || 'blue' },
        }
      }

      const useStyles = makeStyles('ThemedComponent')(mockStylesFn)
      const classes = useStyles()

      expect(classes).toEqual({
        root: 'ThemedComponent-root',
      })
    })

    it('should work with different component names', () => {
      const styles = { root: { color: 'red' } }

      const buttonStyles = makeStyles('Button')(styles)()
      const cardStyles = makeStyles('Card')(styles)()
      const dialogStyles = makeStyles('Dialog')(styles)()

      expect(buttonStyles.root).toBe('Button-root')
      expect(cardStyles.root).toBe('Card-root')
      expect(dialogStyles.root).toBe('Dialog-root')
    })

    it('should handle empty style objects', () => {
      const useStyles = makeStyles('EmptyComponent')({})
      const classes = useStyles()

      expect(classes).toEqual({})
    })
  })
})
