/* String utils */
import config from 'constants/config';

export function makeHandle(owner, pkg) {
  return config.team ? `${config.team.id}:${owner}/${pkg}` : `${owner}/${pkg}`;
}

export function makeMatcher(exp, flags = 'i') {
  const re = new RegExp(exp, flags);
  return (s) => re.test(s);
}

export function numberToCommaString(num) {
  const digs = num.toString().split('');
  return arrayToCommaString(digs);
}

function arrayToCommaString(digs) {
  if (digs.length < 4) {
    return digs.join('');
  }
  const begin = digs.slice(0, -3);
  const last3 = `,${digs.slice(-3, digs.length).join('')}`;
  return arrayToCommaString(begin) + last3;
}

export function printObject(obj) {
  return JSON.stringify(obj, null, '  ');
}
