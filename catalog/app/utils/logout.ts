export default function logout(fiercely: boolean = false) {
  if (fiercely) {
    window.localStorage.clear()
  } else {
    window.localStorage.removeItem('USER')
    window.localStorage.removeItem('TOKENS')
  }
  window.location.reload()
}
