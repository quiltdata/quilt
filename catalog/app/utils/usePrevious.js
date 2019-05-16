import * as React from 'react'

export default (value, onChange) => {
  const ref = React.useRef()
  React.useEffect(() => {
    if (onChange) onChange(ref.current)
    ref.current = value
  })
  return ref.current
}
