"""create_guides_and_article_categories

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-20 05:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '0004'
down_revision: str | None = '0003'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Tabela guide_details
    op.create_table(
        'guide_details',
        sa.Column('content_entry_id', sa.String(length=36), nullable=False),
        sa.Column('publico', sa.String(length=20), nullable=False, server_default='ambos'),
        sa.Column('tempo_minutos', sa.Integer(), nullable=False, server_default='15'),
        sa.Column('etiqueta', sa.String(length=24), nullable=False, server_default=''),
        sa.Column('icone', sa.String(length=50), nullable=False, server_default='sparkle'),
        sa.Column('dificuldade', sa.String(length=30), nullable=False, server_default='Fácil'),
        sa.ForeignKeyConstraint(['content_entry_id'], ['content_entries.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('content_entry_id'),
    )

    # 2. Tabela guide_produtos
    op.create_table(
        'guide_produtos',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('guide_id', sa.String(length=36), nullable=False),
        sa.Column('produto_id', sa.String(length=36), nullable=False),
        sa.Column('quantidade', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('ordem', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['guide_id'], ['content_entries.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['produto_id'], ['produtos.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('guide_produtos', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_guide_produtos_guide_id'), ['guide_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_guide_produtos_produto_id'), ['produto_id'], unique=False)

    # 3. Adiciona categoria em article_details
    with op.batch_alter_table('article_details', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('categoria', sa.String(length=30), nullable=False, server_default='geral')
        )


def downgrade() -> None:
    with op.batch_alter_table('article_details', schema=None) as batch_op:
        batch_op.drop_column('categoria')

    with op.batch_alter_table('guide_produtos', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_guide_produtos_produto_id'))
        batch_op.drop_index(batch_op.f('ix_guide_produtos_guide_id'))
    op.drop_table('guide_produtos')

    op.drop_table('guide_details')
