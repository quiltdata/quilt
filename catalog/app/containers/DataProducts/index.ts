/**
 * The barrel App's lazy routes load through.
 *
 * Both named screens are re-exported, not just the default: `App.jsx` resolves
 * `m.ExchangeScreen` and `m.NewProductScreen` off this module, and a barrel that
 * exported only `default` gave both routes `{ default: undefined }` and crashed
 * the SPA on render. Nothing typed catches that — `App.jsx` is untyped JSX — so
 * `DataProducts.spec.tsx` loads both through this barrel the way the router does.
 */

export { default, ExchangeScreen, NewProductScreen } from './DataProducts'
