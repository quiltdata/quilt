export async function xhrGet(authToken: string, url: RequestInfo | URL) {
  const response = await window.fetch(url, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  })
  return response.json()
}

export async function xhrPost(authToken: string, url: RequestInfo | URL) {
  const response = await window.fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  })
  return response.json()
}
