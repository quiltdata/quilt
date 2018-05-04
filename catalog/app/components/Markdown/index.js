/* Markdown */
import hljs from 'highlight.js';
import flow from 'lodash/flow';
import PropTypes from 'prop-types';
import React from 'react';
import Remarkable from 'remarkable';
import { replaceEntities, escapeHtml } from 'remarkable/lib/common/utils';
import styled from 'styled-components';


const highlight = (str, lang) => {
  if (lang === 'none') {
    return '';
  } else if (hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(lang, str).value;
    } catch (err) {
      console.error(err); // eslint-disable-line no-console
    }
  } else {
    try {
      return hljs.highlightAuto(str).value;
    } catch (err) {
      console.error(err); // eslint-disable-line no-console
    }
  }
  return ''; // use external default escaping
};

const escape = flow(replaceEntities, escapeHtml);

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

// TODO review for script injection attacks; html set to false as prelim
const md = new Remarkable('full', {
  highlight,
  html: false,
  linkify: true,
  typographer: true,
});

const mdWithoutImg = new Remarkable('full', {
  highlight,
  html: false,
  linkify: true,
  typographer: true,
});
mdWithoutImg.use(disableImg);

function Markdown({ data, className = '', images = true }) {
  // would prefer to render in a saga but md.render() fails when called in
  // a generator
  const html = { __html: (images ? md : mdWithoutImg).render(data) };
  return (
    <Style className={`markdown ${className}`} dangerouslySetInnerHTML={html} />
  );
}

Markdown.propTypes = {
  data: PropTypes.string,
  className: PropTypes.string,
  images: PropTypes.bool,
};

/* Ensure that markdown styles are smaller than page h1, h2, etc. since
 * they should appear as subordinate to the page's h1, h2 */
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

export default Markdown;
