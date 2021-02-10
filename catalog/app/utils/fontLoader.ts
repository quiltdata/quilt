import FontFaceObserver from 'fontfaceobserver'

/**
 * Load the fonts.
 *
 * @param fonts - Font-faces to load.
 *
 * @returns A promise resolved when all the fonts are loaded.
 */
export default (...fonts: string[]) =>
  Promise.all(fonts.map((f) => new FontFaceObserver(f, {}).load()))
