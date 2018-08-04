// @flow
/**
 * An object containing the handles to a Promise.
 */
export type Resolver<T> = {
  resolve: (v: T) => any,
  reject: (e: Error) => any,
};

/**
 * An object containing a Promise and a Resolver for that Promise.
 */
export type Deferred<T> = {
  promise: Promise<T>,
  resolver: Resolver<T>,
};

/**
 * Create a Deferred.
 *
 * @name defer
 */
export default <T>(): Deferred<T> => {
  let resolver;
  const promise = new Promise((resolve, reject) => {
    resolver = { resolve, reject };
  });
  return { resolver: (resolver: any), promise };
};
