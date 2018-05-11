import invoke from 'lodash/fp/invoke';
import Divider from 'material-ui/Divider';
import { List } from 'material-ui/List';
import RaisedButton from 'material-ui/RaisedButton';
import PT from 'prop-types';
import React from 'react';
import { FormattedMessage as FM } from 'react-intl';
import { setPropTypes } from 'recompose';
import styled from 'styled-components';

import MIcon from 'components/MIcon';
import Spinner from 'components/Spinner';
import api, { apiStatus } from 'constants/api';
import { palette } from 'constants/style';
import { makeSignInURL } from 'containers/Auth/util';
import { composeComponent } from 'utils/reactTools';

import Comment from './Comment';
import CommentForm from './CommentForm';
import msg from './messages';

const Message = styled.div`
  align-items: center;
  display: flex;
  min-height: 72px;
  padding-bottom: 15px;
  padding-left: 56px;
  padding-top: 16px;
  position: relative;
`;

const MessageDivider = styled(Divider)`
  background: ${palette.borderColor};
  bottom: 0;
  left: 56px;
  position: absolute;
  right: 0;
`;

const MessageIcon = styled.div`
  height: 40px;
  left: 0;
  position: absolute;
  top: 16px;
  width: 40px;
`;

const MessageText = styled.div`
  font-size: 1.25em;
`;

export default composeComponent('Package.Comments',
  setPropTypes({
    comments: PT.shape({
      status: apiStatus.isRequired,
      response: PT.oneOfType([
        PT.instanceOf(Error),
        PT.array,
      ]),
    }).isRequired,
    getComments: PT.func.isRequired,
    addComment: PT.func.isRequired,
    user: PT.string.isRequired,
    owner: PT.string.isRequired,
  }),
  ({ comments: { status, response }, addComment, getComments, user, owner }) => (
    <List>
      {invoke(status, {
        [api.SUCCESS]: () =>
          response.map((c) => (
            <Comment key={c.id} isOwner={c.author === owner} {...c} />
          )),
        [api.ERROR]: () => (
          <Message>
            <MessageIcon>
              <MIcon
                style={{
                  color: palette.borderColor,
                  display: 'flex',
                  fontSize: 48, // the actual glyph looks like 40px
                  justifyContent: 'center',
                  lineHeight: '40px',
                  width: '100%',
                }}
              >
                error_outline
              </MIcon>
            </MessageIcon>
            <MessageText><FM {...msg.commentsErrorLoading} /></MessageText>
            <RaisedButton
              onClick={getComments}
              label={<FM {...msg.commentsRetry} />}
              style={{ marginLeft: 16 }}
            />
            <MessageDivider />
          </Message>
        ),
        [api.WAITING]: () => (
          <Message>
            <MessageIcon>
              <Spinner
                style={{
                  color: palette.borderColor,
                  display: 'flex',
                  fontSize: 46, // the actual glyph looks like 40px
                  width: '100%',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                }}
              />
            </MessageIcon>
            <MessageText><FM {...msg.commentsLoading} /></MessageText>
            <MessageDivider />
          </Message>
        ),
      })}
      {user
        ? <CommentForm addComment={addComment} user={user} />
        : (
          <Message>
            <RaisedButton
              href={makeSignInURL()}
              label={<FM {...msg.commentsSignIn} />}
            />
          </Message>
        )
      }
    </List>
  ));
