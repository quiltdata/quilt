import * as React from 'react'

const Ctx = React.createContext()

export function TalkToUsProvider({ children }) {
  // TODO: memoize
  function talkToUs() {
    // TODO: open meetingbird popup
    alert('talk to us')
  }
  return <Ctx.Provider value={talkToUs}>{children}</Ctx.Provider>
}

export function useTalkToUs() {
  return React.useContext(Ctx)
}

export { TalkToUsProvider as Provider, useTalkToUs as use }
