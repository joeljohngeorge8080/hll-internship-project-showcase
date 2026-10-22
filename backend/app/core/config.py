from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = 'HS256'
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    GOOGLE_CLIENT_ID: str = ''
    ALLOWED_ORIGINS: str = 'http://localhost:3000,http://localhost:5173'

    AWS_ACCESS_KEY_ID: str = ''
    AWS_SECRET_ACCESS_KEY: str = ''
    AWS_REGION: str = 'ap-south-1'

    # Separate from the SES-sending credentials above — this is the
    # billing-only IAM user's access key, used only to mint short-lived
    # AWS Console federation sign-in links (see app/core/aws_billing.py).
    AWS_BILLING_ACCESS_KEY_ID: str = ''
    AWS_BILLING_SECRET_ACCESS_KEY: str = ''

    GOOGLE_CLIENT_ID: str = ''
    ALLOWED_ORIGINS: str = 'http://localhost:3000,http://localhost:5173'

    ENVIRONMENT: str = 'development'
    FRONTEND_URL: str = 'http://localhost:3000'

    class Config:
        env_file = '.env'


settings = Settings()
