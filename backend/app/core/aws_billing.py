import json
from urllib.parse import urlencode

import boto3
import requests

from .config import settings

FEDERATION_ENDPOINT = 'https://signin.aws.amazon.com/federation'

# GetFederationToken sessions can never exceed the calling IAM user's own
# permissions — since the biller user is billing-only, every link this mints
# is billing-only too, regardless of DurationSeconds below.
SESSION_DURATION_SECONDS = 3600


def get_console_signin_url(destination: str) -> str:
    """
    Mints a one-click AWS Console sign-in URL that lands directly on
    `destination`, using the billing-only IAM user's credentials via AWS STS
    federation — no password prompt. See:
    https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_enable-console-custom-url.html
    """
    sts = boto3.client(
        'sts',
        aws_access_key_id=settings.AWS_BILLING_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_BILLING_SECRET_ACCESS_KEY,
    )
    # Explicit session policy grants billing actions — without this, the
    # federated session defaults to a deny-all policy even if the calling
    # user (biller) has broader permissions. This policy is the intersection
    # of what we allow and what the biller user can already do.
    session_policy = json.dumps({
        'Version': '2012-10-17',
        'Statement': [{
            'Effect': 'Allow',
            'Action': [
                'ce:*',
                'cur:*',
                'billing:*',
                'payments:*',
                'aws-portal:*',
            ],
            'Resource': '*',
        }],
    })
    federated = sts.get_federation_token(
        Name='hma-billing-viewer',
        DurationSeconds=SESSION_DURATION_SECONDS,
        Policy=session_policy,
    )
    creds = federated['Credentials']
    session = json.dumps({
        'sessionId': creds['AccessKeyId'],
        'sessionKey': creds['SecretAccessKey'],
        'sessionToken': creds['SessionToken'],
    })

    token_resp = requests.get(
        FEDERATION_ENDPOINT,
        params={
            'Action': 'getSigninToken',
            'SessionDuration': SESSION_DURATION_SECONDS,
            'Session': session,
        },
        timeout=10,
    )
    token_resp.raise_for_status()
    signin_token = token_resp.json()['SigninToken']

    login_params = {
        'Action': 'login',
        'Issuer': settings.FRONTEND_URL,
        'Destination': destination,
        'SigninToken': signin_token,
    }
    return f'{FEDERATION_ENDPOINT}?{urlencode(login_params)}'
