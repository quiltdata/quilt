const PLACEHOLDER = '_'

// Dynamic styled-components helper: dispatches on a prop value to a style value
// (or a function of the props). The prop values and produced styles are
// arbitrary, so the variant map / fn are typed loosely.
type Props = Record<string, any>
type Variants = ((propVal: any, props: Props) => any) | Record<PropertyKey, any>

export default (propName: string, variants?: Variants) =>
  (props: Props): any => {
    const propVal = props[propName]
    if (!variants) return propVal
    if (typeof variants === 'function') return variants(propVal, props)
    const key =
      (propVal as PropertyKey) in variants ? (propVal as PropertyKey) : PLACEHOLDER
    const variant = variants[key]
    return typeof variant === 'function' ? variant(props) : variant
  }
