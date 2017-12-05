/* Quilt Error constructor with fields designed to to feed <Error />
 * via object rest spread */
export default function makeError(primary, secondary = '', response = {}) {
  const error = new Error(primary);
  // need to do this explicitly so that object rest spread will catch it
  // when it goes into <Error />
  error.headline = primary;
  error.detail = secondary;
  // Response objects do not work with JSON.stringify() so we copy
  // some fields into a fresh Object
  error.object = {
    ok: response.ok,
    redirected: response.redirected,
    status: response.status,
    statusText: response.statusText,
    type: response.type,
    url: response.url,
  };

  return error;
}
