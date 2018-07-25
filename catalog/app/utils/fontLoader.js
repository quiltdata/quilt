import FontFaceObserver from 'fontfaceobserver';

/**
 * Load the fonts.
 *
 * @param {...string} fonts Font-faces to load.
 *
 * @returns {Promise} A promise resolved when all the fonts are loaded.
 */
export default (...fonts) =>
  Promise.all(fonts.map((f) =>
    new FontFaceObserver(f, {}).load()));
