import * as React from 'react'
import { Helmet } from 'react-helmet'

interface LandingMetaTitleProps {
  subtitle?: string
}

function LandingMetaTitle({ subtitle }: LandingMetaTitleProps) {
  return (
    <Helmet>
      <title>
        {subtitle ? `${subtitle} • ` : ''}
        Quilt is a versioned data portal for AWS
      </title>
    </Helmet>
  )
}

export function Landing() {
  return <LandingMetaTitle />
}

export const OpenLanding = Landing

export function OpenProfile() {
  return <LandingMetaTitle subtitle="Profile" />
}

export function Install() {
  return <LandingMetaTitle subtitle="Install" />
}

export function About() {
  return <LandingMetaTitle subtitle="About" />
}

export function Personas() {
  return <LandingMetaTitle subtitle="Personas" />
}

export function Product() {
  return <LandingMetaTitle subtitle="Product" />
}
