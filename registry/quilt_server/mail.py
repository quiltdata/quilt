from flask import render_template
from flask_mail import Mail, Message

from . import app

CATALOG_URL = app.config['CATALOG_URL']
DEFAULT_SENDER = app.config['DEFAULT_SENDER']
REGISTRY_URL = app.config['REGISTRY_URL']

TEAM_ID = app.config['TEAM_ID']
TEAM_NAME = app.config['TEAM_NAME']

mail = Mail(app)

def send_email(recipients, sender, subject, html, body=None, dry_run=False):
    message = Message(
        subject=subject,
        recipients=recipients,
        html=html,
        body=body,
        sender=sender
    )

    if app.config['TESTING'] or app.config['MAIL_DEV'] or dry_run:
        print(message)
    else:
        mail.send(message)

def send_activation_email(user, activation_link):
    base = REGISTRY_URL
    link = '{base}/activate/{link}'.format(base=base, link=activation_link)
    html = render_template('activation_email.html', link=link,
                           team=TEAM_ID, name=user.name, CATALOG_URL=CATALOG_URL)
    body = render_template('activation_email.txt', link=link,
                           team=TEAM_ID, name=user.name, CATALOG_URL=CATALOG_URL)
    send_email(recipients=[user.email], sender=DEFAULT_SENDER,
               subject='Activate your Quilt account', html=html, body=body)

def send_reset_email(user, reset_link):
    base = CATALOG_URL
    link = '{base}/reset_password/{link}'.format(base=base, link=reset_link)
    html = render_template('reset_pw_email.html', link=link, team=TEAM_NAME, name=user.name)
    body = render_template('reset_pw_email.txt', link=link, name=user.name)
    send_email(recipients=[user.email], sender=DEFAULT_SENDER,
               subject='Reset your Quilt password', html=html, body=body)

def send_invitation_email(email, owner, package_name):
    subject = "{owner} shared data with you on Quilt".format(owner=owner)
    html = render_template('invitation_email.html', owner=owner, pkg=package_name)
    body = render_template('invitation_email.txt', owner=owner, pkg=package_name)
    send_email(recipients=[email], html=html, body=body, sender=DEFAULT_SENDER, subject=subject)

def send_new_user_email(username, email, admins):
    subject = "New Quilt User: {user}".format(user=username)
    html = render_template('new_user_activated.html', team=TEAM_ID,
                           user=username, email=email, authurl=CATALOG_URL)
    body = render_template('new_user_activated.txt', team=TEAM_ID,
                           user=username, email=email, authurl=CATALOG_URL)
    send_email(recipients=admins, sender=DEFAULT_SENDER, subject=subject,
               html=html, body=body)

def send_welcome_email(username, email, link=None):
    subject = "Welcome to Quilt, {username}".format(username=username)
    html = render_template('welcome_email.html', team_id=TEAM_ID, team_name=TEAM_NAME,
                           frontend=CATALOG_URL, needsreset=link is not None, reseturl=link)
    body = render_template('welcome_email.txt', team_id=TEAM_ID, team_name=TEAM_NAME,
                           frontend=CATALOG_URL, needsreset=link is not None, reseturl=link)
    send_email(recipients=[email], sender=DEFAULT_SENDER, subject=subject,
               html=html, body=body)

def send_comment_email(email, package_owner, package_name, commenter):
    """Send email to owner of package regarding new comment"""
    link = '{REGISTRY_URL}/{owner}/{pkg}/comments'.format(
        REGISTRY_URL=REGISTRY_URL, owner=package_owner, pkg=package_name)
    subject = "New comment on {package_owner}/{package_name}".format(
        package_owner=package_owner, package_name=package_name)
    html = render_template('comment_email.html', commenter=commenter, link=link)
    body = render_template('comment_email.txt', commenter=commenter, link=link)
    send_email(recipients=[email], sender=DEFAULT_SENDER, subject=subject,
               html=html, body=body)
