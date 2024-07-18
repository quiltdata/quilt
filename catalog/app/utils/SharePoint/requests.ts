export async function makeRequestSigned(
  authToken: string,
  url: RequestInfo | string | URL,
) {
  const response = await window.fetch(url, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  })
  return response.json()
}

export async function postSigned(authToken: string, url: RequestInfo | string | URL) {
  const response = await window.fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  })
  return response.json()
}
