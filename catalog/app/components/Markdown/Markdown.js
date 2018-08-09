import hljs from 'highlight.js';
import flow from 'lodash/flow';
import memoize from 'lodash/memoize';
import PT from 'prop-types';
import React from 'react';
import { setPropTypes } from 'recompose';
import Remarkable from 'remarkable';
import { replaceEntities, escapeHtml } from 'remarkable/lib/common/utils';
import styled from 'styled-components';

import { composeComponent } from 'utils/reactTools';


const highlight = (str, lang) => {
  if (lang === 'none') return '';
  if (hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(lang, str).value;
    } catch (err) {
      // istanbul ignore next
      console.error(err); // eslint-disable-line no-console
    }
  } else {
    try {
      return hljs.highlightAuto(str).value;
    } catch (err) {
      // istanbul ignore next
      console.error(err); // eslint-disable-line no-console
    }
  }
  // istanbul ignore next
  return ''; // use external default escaping
};

const escape = flow(replaceEntities, escapeHtml);

/**
 * Plugin for remarkable that disables image rendering.
 *
 * @param {Object} md Remarkable instance
 */
const disableImg = (md) => {
  // eslint-disable-next-line no-param-reassign
  md.renderer.rules.image = (tokens, idx) => {
    const t = tokens[idx];
    const src = escape(t.src);
    const title = t.title ? ` "${escape(t.title)}"` : '';
    const alt = t.alt ? escape(t.alt) : '';
    return `<span>![${alt}](${src}${title})</span>`;
  };
};

/**
 * Plugin for remarkable that adjusts link rendering:
 *
 *   - adds rel="nofollow" attribute
 *
 * @param {Object} md Remarkable instance
 */
const adjustLinks = (md) => {
  // eslint-disable-next-line no-param-reassign
  md.renderer.rules.link_open = (tokens, idx) => {
    const t = tokens[idx];
    const title = t.title ? ` title="${escape(t.title)}"` : '';
    return `<a href="${escapeHtml(t.href)}" rel="nofollow"${title}>`;
  };
};

/**
 * Get Remarkable instance based on the given options (memoized).
 *
 * @param {Object} options
 *
 * @param {boolean} images
 *   Whether to render images notated as `![alt](src title)` or skip them.
 *
 * @returns {Object} Remarakable instance
 */
const getRenderer = memoize(({ images }) => {
  const md = new Remarkable('full', {
    highlight,
    html: false,
    linkify: true,
    typographer: true,
  });
  md.use(adjustLinks);
  if (!images) md.use(disableImg);
  return md;
});

// Ensure that markdown styles are smaller than page h1, h2, etc. since
// they should appear as subordinate to the page's h1, h2
const Style = styled.div`
  display: block;
  overflow: auto;

  h1 code {
    background-color: inherit;
  }

  /* prevent horizontal overflow */
  img {
    max-width: 100%;
  }
`;

export default composeComponent('Markdown',
  setPropTypes({
    data: PT.string,
    className: PT.string,
    images: PT.bool,
  }),
  ({ data, className = '', images = true }) => (
    <Style
      className={`markdown ${className}`}
      dangerouslySetInnerHTML={{
        // would prefer to render in a saga but md.render() fails when called
        // in a generator
        __html: getRenderer({ images }).render(data),
      }}
    />
  ));
