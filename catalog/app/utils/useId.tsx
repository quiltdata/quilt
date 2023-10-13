import * as React from 'react'

type MakeId = () => string

function randomId() {
  return Math.random().toString(36).substring(2)
}

export default function useId(makeId: MakeId = randomId): string {
  const [id] = React.useState(makeId)
  return id
}
