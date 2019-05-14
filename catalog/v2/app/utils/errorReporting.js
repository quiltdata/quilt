import Raven from 'raven-js';
import createRavenMiddleware from 'raven-for-redux';

import config from 'constants/config';


// ignore irrelevant nonactionable stuff, e.g. browser extensions and 3rd-party scripts
// based on this gist: https://gist.github.com/impressiver/5092952
const ignoreErrors = [
  // Random plugins/extensions
  'top.GLOBALS',
  // See: http://blog.errorception.com/2012/03/tale-of-unfindable-js-error.html
  'originalCreateNotification',
  'canvas.contentDocument',
  'MyApp_RemoveAllHighlights',
  'http://tt.epicplay.com',
  'Can\'t find variable: ZiteReader',
  'jigsaw is not defined',
  'ComboSearch is not defined',
  'http://loading.retry.widdit.com/',
  'atomicFindClose',
  // Facebook borked
  'fb_xd_fragment',
  // ISP "optimizing" proxy - `Cache-Control: no-transform` seems to reduce this. (thanks @acdha)
  // See http://stackoverflow.com/questions/4113268/how-to-stop-javascript-injection-from-vodafone-proxy
  'bmi_SafeAddOnload',
  'EBCallBackMessageReceived',
  // See http://toolbar.conduit.com/Developer/HtmlAndGadget/Methods/JSInjection.aspx
  'conduitPage',
];

const ignoreUrls = [
  // Facebook flakiness
  /graph\.facebook\.com/i,
  // Facebook blocked
  /connect\.facebook\.net\/en_US\/all\.js/i,
  // Woopra flakiness
  /eatdifferent\.com\.woopra-ns\.com/i,
  /static\.woopra\.com\/js\/woopra\.js/i,
  // Chrome extensions
  /extensions\//i,
  /^chrome:\/\//i,
  // Other plugins
  /127\.0\.0\.1:4001\/isrunning/i, // Cacaoweb
  /webappstoolbarba\.texthelp\.com\//i,
  /metrics\.itunes\.apple\.com\.edgesuite\.net\//i,
];

if (config.sentryDSN) {
  Raven
    .config(config.sentryDSN, {
      ignoreErrors,
      ignoreUrls,
      environment: process.env.NODE_ENV,
      // release: TODO
      debug: process.env.NODE_ENV === 'development',
    })
    .install();
}

export const captureError = Raven.isSetup()
  ? (e, data) => Raven.captureException(e, data)
  : (e, data) => {
    // eslint-disable-next-line no-console
    console.log('Error captured, data:', data);
    // eslint-disable-next-line no-console
    console.error(e);
  };

export const captureMessage = Raven.isSetup()
  ? (m, data) => Raven.captureMessage(m, data)
  : (m, data) => {
    // eslint-disable-next-line no-console
    console.log(m, data);
  };

export const run = Raven.isSetup()
  ? (fn) => Raven.context(fn)
  : (fn) => { try { fn(); } catch (e) { captureError(e); } };

export const reduxMiddleware = Raven.isSetup()
  ? createRavenMiddleware(Raven, {})
  : () => (next) => (action) => next(action);
