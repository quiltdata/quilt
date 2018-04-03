/* String utils */
import React from 'react';
import { FormattedNumber } from 'react-intl';

import config from 'constants/config';

export function makeHandle(owner, pkg) {
  return config.team ? `${config.team.id}:${owner}/${pkg}` : `${owner}/${pkg}`;
}

export function makeMatcher(exp, flags = 'i') {
  const re = new RegExp(exp, flags);
  return (s) => re.test(s);
}

export function printObject(obj) {
  return JSON.stringify(obj, null, '  ');
}

export function readableBytes(bytes) {
  if (Number.isInteger(bytes)) {
    // https://en.wikipedia.org/wiki/Kilobyte
    const sizes = ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
    const log = bytes === 0 ? 0 : Math.log10(bytes);
    const index = Math.min(Math.floor(log / 3), sizes.length - 1);
    const display = (bytes / (10 ** (index * 3))).toFixed(1);
    return (
      <span>
        <FormattedNumber value={display} />&nbsp;{sizes[index]}B
      </span>
    );
  }
  return '?';
}
