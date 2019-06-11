const PLACEHOLDER = '_'

export default (propName, variants) => (props) => {
  const propVal = props[propName]
  if (!variants) return propVal
  const variant =
    typeof variants === 'function'
      ? variants
      : variants[propVal in variants ? propVal : PLACEHOLDER]
  return typeof variant === 'function' ? variant(props, propVal, propName) : variant
}
