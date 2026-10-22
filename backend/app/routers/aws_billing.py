from typing import Annotated, Literal

import requests
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.aws_billing import get_console_signin_url
from app.dependencies import require_hr
from app.models.user import User

router = APIRouter(prefix='/aws', tags=['aws'])

# The federation endpoint's `Destination` param only accepts the classic
# console.aws.amazon.com domain, not the newer account-specific vanity
# domain (<account-id>-<hash>.<region>.console.aws.amazon.com) — using that
# form here caused AWS to reject the whole login with a 400 Bad Request.
CONSOLE_HOST = 'console.aws.amazon.com'

DESTINATIONS = {
    'home': f'https://{CONSOLE_HOST}/console/home?region=ap-south-1',
    'bills': f'https://{CONSOLE_HOST}/billing/home?region=ap-south-1#/bills',
    'payments_due': (
        f'https://{CONSOLE_HOST}/costmanagement/home'
        '?region=ap-south-1#/paymentsoverview/payments-due'
    ),
}


class AwsSigninUrlResponse(BaseModel):
    url: str


@router.get('/billing/signin-url', response_model=AwsSigninUrlResponse)
def billing_signin_url(
    destination: Literal['home', 'bills', 'payments_due'],
    _: Annotated[User, Depends(require_hr)],
):
    try:
        url = get_console_signin_url(DESTINATIONS[destination])
    except (ClientError, BotoCoreError) as e:
        print(f'AWS STS federation failed for billing signin-url: {e}')
        raise HTTPException(
            status_code=502,
            detail='Could not generate an AWS sign-in link — the billing '
            'credentials may be missing or invalid.',
        ) from e
    except requests.RequestException as e:
        print(f'AWS federation endpoint request failed: {e}')
        raise HTTPException(
            status_code=502,
            detail='Could not reach the AWS sign-in service. Please try again shortly.',
        ) from e
    return AwsSigninUrlResponse(url=url)
