import Avatar from 'material-ui/Avatar';
import RaisedButton from 'material-ui/RaisedButton';
import Textarea from 'material-ui/TextField/EnhancedTextarea';
import { grey100, grey400, grey500, grey600, red400 } from 'material-ui/styles/colors';
import { fade } from 'material-ui/utils/colorManipulator';
import PT from 'prop-types';
import React from 'react';
import { FormattedMessage as FM } from 'react-intl';
import {
  setPropTypes,
  withProps,
  withStateHandlers,
} from 'recompose';
import { reduxForm, Field } from 'redux-form/immutable';
import styled from 'styled-components';

import MD from 'components/Markdown';
import Spinner from 'components/Spinner';
import { composeComponent, withStyle } from 'utils/reactTools';
import * as validators from 'utils/validators';

import msg from './messages';
import { getInitials } from './util';

const Container = styled.div`
  padding-top: 16px;
  padding-bottom: 16px;
  padding-left: 56px;
  position: relative;
`;

const StyledAvatar = styled(Avatar)`
  left: 0;
  position: absolute;
  top: 16px;
`;

const Heading = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const HeadingText = styled.span`
  font-size: 1.25em;
`;

const StyledSpinner = styled(Spinner)`
  font-size: 1.25em;
  opacity: 0.5;
`;

const Preview = composeComponent('Package.CommentForm.Preview',
  withProps(({ meta }) => ({
    error: Boolean(meta.submitFailed && meta.error),
  })),
  withStyle`
    background: ${(p) => p.error ? fade(red400, 0.1) : grey100};
    ${(p) => p.error && `color: ${red400};`}
    padding-left: 12px;
    padding-right: 12px;
  `,
  ({ input, meta, error, ...rest }) => (
    <FM {...msg.commentFormEmpty}>
      {(empty) => (
        <MD
          images={false}
          data={input.value || `(${empty})`}
          {...rest}
        />
      )}
    </FM>
  ));

const Actions = styled.div`
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
`;

const Hint = styled.a`
  &, &:active, &:focus, &:visited {
    color: ${grey500};
    font-size: .75em;
    font-weight: 300;
    text-decoration: none;
  }

  &:hover {
    color: ${grey600};
    text-decoration: none;
  }
`;

const CommentField = composeComponent('Package.CommentForm.CommentField',
  setPropTypes({
    input: PT.object,
    meta: PT.object,
  }),
  withProps(({ meta }) => ({
    error: Boolean(meta.submitFailed && meta.error),
  })),
  withStyle`
    border: 1px solid ${(p) => fade(p.error ? red400 : grey400, 0.5)};
    display: block;
    overflow: hidden;

    &:hover, &:active, &:focus {
      outline: none;
    }

    &:not(:disabled) {
      &:hover, &:focus {
        border-color: ${(p) => p.error ? red400 : grey400};
        outline: none;
      }
    }

    &:disabled {
      opacity: .7;
    }

    ${(p) => p.error && `
      &::placeholder {
        color: ${red400};
      }`}
  `,
  ({ input, meta, error, ...rest }) => (
    <FM {...msg.commentFormHint}>
      {(hint) => (
        <Textarea
          {...input}
          placeholder={hint}
          textareaStyle={{
            padding: 11,
          }}
          {...rest}
        />
      )}
    </FM>
  ));

export default composeComponent('Package.CommentForm',
  setPropTypes({
    addComment: PT.func.isRequired,
    user: PT.string.isRequired,
  }),
  withStateHandlers({
    preview: false,
  }, {
    showPreview: () => () => ({ preview: true }),
    hidePreview: () => () => ({ preview: false }),
    togglePreview: ({ preview }) => () => ({ preview: !preview }),
  }),
  reduxForm({
    form: 'Package.CommentForm',
    onSubmit: (values, dispatch, { addComment }) =>
      addComment(values.toJS().comment),
    onSubmitSuccess: (values, dispatch, { reset, hidePreview }) => {
      reset();
      hidePreview();
    },
  }),
  ({
    user,
    preview,
    togglePreview,
    handleSubmit,
    invalid,
    submitting,
    submitFailed,
  }) => (
    <Container>
      <StyledAvatar>{getInitials(user)}</StyledAvatar>
      <Heading>
        <HeadingText><FM {...msg.commentFormHeading} /></HeadingText>
        {submitting && <StyledSpinner />}
      </Heading>
      <form onSubmit={handleSubmit}>
        <Field
          name="comment"
          validate={[validators.required]}
          component={preview ? Preview : CommentField}
          disabled={submitting}
        />
        <Actions>
          <Hint href="http://commonmark.org/help/" target="_blank">
            <FM {...msg.commentFormMarkdown} />
          </Hint>

          <div>
            <RaisedButton
              label={<FM {...msg[`commentFormButton${preview ? 'Edit' : 'Preview'}`]} />}
              disabled={submitting}
              onClick={togglePreview}
            />
            <RaisedButton
              type="submit"
              primary
              label={<FM {...msg.commentFormSubmit} />}
              style={{ marginLeft: 16 }}
              disabled={submitting || (submitFailed && invalid)}
            />
          </div>
        </Actions>
      </form>
    </Container>
  ));
