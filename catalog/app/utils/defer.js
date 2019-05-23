/**
 * An object containing the handles to a Promise.
 * @typedef {{resolve: function, reject: function}} Resolver
 */

/**
 * An object containing a Promise and a Resolver for that Promise.
 * @typedef {{promise: Promise, resolver: Resolver}} Deferred
 */

/**
 * Create a Deferred.
 *
 * @name defer
 *
 * @returns {Deferred}
 */
export default () => {
  let resolver
  const promise = new Promise((resolve, reject) => {
    resolver = { resolve, reject }
  })
  return { resolver, promise }
}
