from flask import render_template
from flask_mail import Mail, Message

from . import app, db
from .models import User


CATALOG_URL = app.config['CATALOG_URL']
DEFAULT_SENDER = app.config['DEFAULT_SENDER']
REGISTRY_HOST = app.config['REGISTRY_HOST']

TEAM_ID = app.config['TEAM_ID']
TEAM_NAME = app.config['TEAM_NAME']

mail = Mail(app)

def send_email(recipient, sender, subject, html, body=None, reply_to=None, dry_run=False):
    if reply_to is None:
        reply_to = sender

    if not isinstance(recipient, list):
        recipient = [recipient]

    message = Message(
        subject=subject,
        recipients=recipient,
        html=html,
        body=body,
        sender=sender
    )

    if app.config['TESTING'] or app.config['MAIL_DEV'] or dry_run:
        print(message)
    else:
        mail.send(message)

def send_activation_email(user, activation_link):
    base = REGISTRY_HOST
    link = '{base}/activate/{link}'.format(base=base, link=activation_link)
    html = render_template('activation_email.html', link=link, team=TEAM_ID, name=user.name)
    body = render_template('activation_email.txt', link=link, team=TEAM_ID, name=user.name)
    send_email(recipient=user.email, sender=DEFAULT_SENDER,
               subject='Activate your Quilt account', html=html, body=body)

def send_reset_email(user, reset_link):
    base = CATALOG_URL
    link = '{base}/reset_password/{link}'.format(base=base, link=reset_link)
    html = render_template('reset_pw_email.html', link=link, team=TEAM_NAME, name=user.name)
    body = render_template('reset_pw_email.txt', link=link, name=user.name)
    send_email(recipient=user.email, sender=DEFAULT_SENDER,
               subject='Reset your Quilt password', html=html, body=body)

def send_invitation_email(email, owner, package_name):
    body = (
        "{owner} shared data with you on Quilt.\n"
        "{owner}/{pkg}\n"
        "Sign up to access the data.\n"
    ).format(owner=owner, pkg=package_name)
    subject = "{owner} shared data with you on Quilt".format(owner=owner)
    html = render_template('invitation_email.html', owner=owner, pkg=package_name)
    body = render_template('invitation_email.txt', owner=owner, pkg=package_name)
    send_email(recipient=email, html=html, body=body, sender=DEFAULT_SENDER, subject=subject)

def send_new_user_email(username, email):
    recipients = (
        db.session.query(
            User.email
        ).filter(User.is_admin is True)
        .all()
    )
    recipients = [r[0] for r in recipients] # flatten out tuples
    subject = "New Quilt User: {user}".format(user=username)
    html = render_template('new_user_activated.html', team=TEAM_ID,
                           user=username, email=email, authurl=CATALOG_URL)
    body = render_template('new_user_activated.txt', team=TEAM_ID,
                           user=username, email=email, authurl=CATALOG_URL)
    send_email(recipient=recipients, sender=DEFAULT_SENDER, subject=subject,
               html=html, body=body)

def send_welcome_email(username, email, link=None):
    subject = "Welcome to Quilt, {username}".format(username=username)
    html = render_template('welcome_email.html', team_id=TEAM_ID, team_name=TEAM_NAME,
                           frontend=CATALOG_URL, needsreset=link is not None, reseturl=link)
    body = render_template('welcome_email.txt', team_id=TEAM_ID, team_name=TEAM_NAME,
                           frontend=CATALOG_URL, needsreset=link is not None, reseturl=link)
    send_email(recipient=email, sender=DEFAULT_SENDER, subject=subject,
               html=html, body=body)
