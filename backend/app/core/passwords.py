import base64
import hashlib
import hmac
import os

_ITERATIONS = 210_000
_SALT_BYTES = 16
_ALGORITHM = "sha256"


def make_hash(value: str) -> str:
    salt = os.urandom(_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac(_ALGORITHM, value.encode("utf-8"), salt, _ITERATIONS)
    encoded_salt = base64.b64encode(salt).decode("ascii")
    encoded_digest = base64.b64encode(digest).decode("ascii")
    return f"pbkdf2_{_ALGORITHM}${_ITERATIONS}${encoded_salt}${encoded_digest}"


def matches(value: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, encoded_salt, encoded_digest = stored_hash.split("$", 3)
        if algorithm != f"pbkdf2_{_ALGORITHM}":
            return False
        salt = base64.b64decode(encoded_salt.encode("ascii"))
        expected_digest = base64.b64decode(encoded_digest.encode("ascii"))
        actual_digest = hashlib.pbkdf2_hmac(
            _ALGORITHM,
            value.encode("utf-8"),
            salt,
            int(iterations),
        )
        return hmac.compare_digest(actual_digest, expected_digest)
    except (ValueError, TypeError):
        return False
