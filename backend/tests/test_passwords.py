from app.core.passwords import make_hash, matches


def test_password_hash_round_trip() -> None:
    stored = make_hash("a-secure-password")
    assert stored != "a-secure-password"
    assert matches("a-secure-password", stored)
    assert not matches("wrong-password", stored)
