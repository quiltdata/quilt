/* Markdown */
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

import Remarkable from 'remarkable';
import hljs from 'highlight.js';


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

// TODO review for script injection attacks; html set to false as prelim
const md = new Remarkable('full', {
  highlight,
  html: false,
  linkify: true,
  typographer: true,
});

function Markdown({ data }) {
  // would prefer to render in a saga but md.render() fails when called in
  // a generator
  const html = { __html: md.render(data) };
  return (
    <Style className="markdown" dangerouslySetInnerHTML={html} />
  );
}

Markdown.propTypes = {
  data: PropTypes.string,
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
