import boto3
from botocore.exceptions import ClientError

from .config import settings

_client = None


def get_ses_client():
    global _client
    if _client is None:
        _client = boto3.client(
            'ses',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
    return _client


def send_invite_email(recipient_email: str, recipient_name: str, login_url: str) -> bool:
    """
    Send an invitation email to a newly registered user.
    Returns True if sent successfully, False otherwise.
    """
    client = get_ses_client()

    sender = f'HMA IEMS <noreply@hllm-cup.in>'
    subject = 'Welcome to HMA IEMS – Access Your Account'

    html_body = f"""
    <html>
    <head></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c3e50;">Welcome to HMA IEMS</h2>
            <p>Hello <strong>{recipient_name}</strong>,</p>
            <p>Your account has been set up and is ready to use. You can now log in to HMA IEMS using your Google account.</p>

            <div style="margin: 30px 0; text-align: center;">
                <a href="{login_url}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    Sign In to HMA IEMS
                </a>
            </div>

            <p><strong>Login Details:</strong></p>
            <ul>
                <li>Email: <code>{recipient_email}</code></li>
                <li>Method: Google Sign-In</li>
            </ul>

            <p>If you have any questions or need assistance, please contact the HMA support team.</p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="font-size: 12px; color: #666;">
                This is an automated message from HMA IEMS. Please do not reply to this email.
            </p>
        </div>
    </body>
    </html>
    """

    text_body = f"""
    Welcome to HMA IEMS

    Hello {recipient_name},

    Your account has been set up and is ready to use. You can now log in to HMA IEMS using your Google account.

    Login URL: {login_url}
    Email: {recipient_email}
    Method: Google Sign-In

    If you have any questions or need assistance, please contact the HMA support team.

    This is an automated message from HMA IEMS. Please do not reply to this email.
    """

    try:
        client.send_email(
            Source=sender,
            Destination={'ToAddresses': [recipient_email]},
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {
                    'Html': {'Data': html_body, 'Charset': 'UTF-8'},
                    'Text': {'Data': text_body, 'Charset': 'UTF-8'},
                },
            },
        )
        return True
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
        print(f'SES error sending to {recipient_email}: {error_code} - {str(e)}')
        return False
