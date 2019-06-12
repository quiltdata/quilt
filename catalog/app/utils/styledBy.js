const PLACEHOLDER = '_'

export default (propName, variants) => (props) => {
  const propVal = props[propName]
  if (!variants) return propVal
  if (typeof variants === 'function') return variants(propVal, props)
  const variant = variants[propVal in variants ? propVal : PLACEHOLDER]
  return typeof variant === 'function' ? variant(props) : variant
}
