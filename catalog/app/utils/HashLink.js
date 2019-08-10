import * as React from 'react'
import { Link } from 'react-router-dom'
import { genericHashLink } from 'react-router-hash-link'

export default React.forwardRef((props, ref) => genericHashLink({ ...props, ref }, Link))
