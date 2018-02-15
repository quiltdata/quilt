const mkValidator = (name, test) => (v) => v && !test(v) ? name : undefined;

const matches = (re) => (str) => re.test(str);

export const required = (v) => v ? undefined : 'required';

// taken from angular
const EMAIL_RE =
    /^(?=.{1,254}$)(?=.{1,64}@)[-!#$%&'*+/0-9=?A-Z^_`a-z{|}~]+(\.[-!#$%&'*+/0-9=?A-Z^_`a-z{|}~]+)*@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;

export const email = mkValidator('email', matches(EMAIL_RE));

// TODO
const USERNAME_RE = /^[a-z][a-z0-9]+$/;
export const username = mkValidator('username', matches(USERNAME_RE));
