"""Comandos de operacao do backend.

Uso (na VPS):
    docker compose exec backend uv run --no-sync python -m app.cli set-password email@dominio
    docker compose exec backend uv run --no-sync python -m app.cli seed-catalogo
"""

import argparse
import asyncio
import getpass
import sys

from app.application.services.cms_author_service import CmsAuthorService, WeakPasswordError
from app.infrastructure.config.settings import get_settings
from app.infrastructure.database.seeds.catalog_seed import seed_catalog
from app.infrastructure.database.session import AsyncSessionLocal, engine
from app.infrastructure.repositories.cms_author_repository import SqlAlchemyCmsAuthorRepository
from app.infrastructure.repositories.cms_session_repository import (
    SqlAlchemyCmsSessionRepository,
)


async def set_password(email: str, password: str, name: str) -> int:
    async with AsyncSessionLocal() as session:
        author = await CmsAuthorService(SqlAlchemyCmsAuthorRepository(session)).set_password(
            email, password, name
        )
        # Troca de senha derruba todas as sessoes abertas desse usuario.
        revoked = await SqlAlchemyCmsSessionRepository(session).revoke_all_for_email(author.email)
    await engine.dispose()
    print(f"Senha definida para {author.email}. Sessoes revogadas: {revoked}.")
    return 0


async def run_seed_catalog() -> int:
    async with AsyncSessionLocal() as session:
        stats = await seed_catalog(session)
    await engine.dispose()
    print(
        f"Catálogo de desenvolvimento semeado com sucesso: {stats['departamentos']} departamentos, "
        f"{stats['produtos']} produtos, {stats['kits']} kits."
    )
    return 0


def _read_password() -> str:
    password = getpass.getpass("Nova senha: ")
    if password != getpass.getpass("Repita a senha: "):
        raise SystemExit("As senhas nao conferem.")
    return password


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)

    set_password_cmd = commands.add_parser(
        "set-password", help="Define ou troca a senha de acesso ao CMS."
    )
    set_password_cmd.add_argument("email")
    set_password_cmd.add_argument("--name", default="", help="Nome exibido no CMS.")

    commands.add_parser(
        "seed-catalogo", help="Popula o banco com dados de catálogo de desenvolvimento do protótipo."
    )

    args = parser.parse_args(argv)

    if args.command == "seed-catalogo":
        return asyncio.run(run_seed_catalog())

    if args.command == "set-password":
        email = args.email.strip().lower()
        if email not in get_settings().cms_allowed_email_list:
            print(
                f"Aviso: {email} nao esta em CMS_ALLOWED_EMAILS; o login sera recusado (403).",
                file=sys.stderr,
            )
        try:
            return asyncio.run(set_password(email, _read_password(), args.name))
        except WeakPasswordError as error:
            raise SystemExit(str(error)) from error

    return 0


if __name__ == "__main__":
    sys.exit(main())
