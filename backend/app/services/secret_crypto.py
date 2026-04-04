"""Encrypt / decrypt API keys at rest using SECRET_KEY-derived Fernet key."""

import base64
import hashlib

from cryptography.fernet import Fernet


def _fernet_key(secret: str) -> bytes:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_secret(plain: str, app_secret: str) -> str:
    f = Fernet(_fernet_key(app_secret))
    return f.encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_secret(token: str, app_secret: str) -> str:
    f = Fernet(_fernet_key(app_secret))
    return f.decrypt(token.encode("utf-8")).decode("utf-8")
