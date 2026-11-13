from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

# argon2id com os parametros padrao da lib (RFC 9106, perfil de baixa memoria).
_hasher = PasswordHasher()
# Conta sem senha tambem paga o custo do argon2: o tempo de resposta nao denuncia
# quais e-mails existem.
_DUMMY_HASH = _hasher.hash("talimpo-cms-dummy-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        matches = _hasher.verify(password_hash or _DUMMY_HASH, password)
    except (VerificationError, InvalidHashError):
        return False
    return matches and bool(password_hash)


if __name__ == "__main__":
    stored = hash_password("senha-forte-de-teste")
    assert stored.startswith("$argon2id$")
    assert verify_password("senha-forte-de-teste", stored)
    assert not verify_password("senha-errada", stored)
    assert not verify_password("talimpo-cms-dummy-password", "")  # sem senha nunca entra
    assert not verify_password("qualquer", "hash-corrompido")
    print("ok")
