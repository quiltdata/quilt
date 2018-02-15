const mkValidator = (name, test) => (v) => v && !test(v) ? name : undefined;

const matches = (re) => (str) => re.test(str);

export const required = (v) => v ? undefined : 'required';

const EMAIL_RE = new RegExp(
  "[a-z0-9!#$%&'*+/=?^_`{|}~.-]+" +
  '@' +
  '([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+' +
  '[a-z0-9][a-z0-9]+' +
  '$',
  'i'
);
export const email = mkValidator('email', matches(EMAIL_RE));

// TODO
const USERNAME_RE = /^[a-z][a-z0-9]+$/;
export const username = mkValidator('username', matches(USERNAME_RE));
