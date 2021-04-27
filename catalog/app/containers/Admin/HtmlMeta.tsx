import * as React from 'react'
import { Helmet } from 'react-helmet'

interface MetaTitleProps {
  subtitle?: string
}

function MetaTitle({ subtitle }: MetaTitleProps) {
  return (
    <Helmet>
      <title>
        {subtitle ? `${subtitle} • ` : ''}
        Admin • Quilt is a versioned data portal for AWS
      </title>
    </Helmet>
  )
}

export function UsersAndRoles() {
  return <MetaTitle subtitle="Users and Roles" />
}

export function Buckets() {
  return <MetaTitle subtitle="Buckets" />
}
