declare module '*.png' {
  const value: string
  export default value
}

declare module '*.jpg' {
  const value: string
  export default value
}

declare module '*.svg' {
  const value: string
  export default value
}

declare module '*.webm' {
  const value: string
  export default value
}

declare module '*.webp' {
  const value: string
  export default value
}

declare module '*.css'
declare module '*.ico'

declare module 'intl/locale-data/jsonp/*'

// Imported `.wasm` resolves (via webpack's `asset/resource` rule) to the
// emitted file's URL — see internals/webpack/webpack.base.js and the Perspective
// WASM bootstrap in app/utils/perspective-pollution.ts.
declare module '*.wasm' {
  const url: string
  export default url
}

type $TSFixMe = any
