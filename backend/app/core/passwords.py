from passlib.context import CryptContext

_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def make_hash(value: str) -> str:
    return _context.hash(value)


def matches(value: str, stored_hash: str) -> bool:
    return _context.verify(value, stored_hash)
