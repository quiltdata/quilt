declare module 'react-router-hash-link' {
  import type * as React from 'react'
  import type { LinkProps, NavLinkProps } from 'react-router-dom'

  interface HashLinkProps {
    scroll?: (element: HTMLElement) => void
    smooth?: boolean
    elementId?: string
  }

  export function genericHashLink<P>(
    LinkComponent: React.ComponentType<P>,
  ): React.ComponentType<P & HashLinkProps>

  export const HashLink: React.ComponentType<LinkProps & HashLinkProps>
  export const NavHashLink: React.ComponentType<NavLinkProps & HashLinkProps>
}
