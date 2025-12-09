import { createMuiTheme } from '@material-ui/core/styles'

const mockTheme = createMuiTheme()

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
    return () =>
      Object.keys(styles).reduce(
        (acc, key) => ({ ...acc, [key]: `${componentName}-${key}` }),
        {},
      )
  }
}
