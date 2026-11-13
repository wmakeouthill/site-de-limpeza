"""create_promocoes_table

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-20 04:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '0003'
down_revision: str | None = '0002'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'promocoes',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('titulo', sa.String(length=120), nullable=False),
        sa.Column('texto', sa.Text(), nullable=True, server_default=''),
        sa.Column('imagem_url', sa.String(length=1000), nullable=True),
        sa.Column('tipo_acao', sa.String(length=20), nullable=False, server_default='aviso'),
        sa.Column('produto_id', sa.String(length=36), nullable=True),
        sa.Column('cta_texto', sa.String(length=60), nullable=True, server_default=''),
        sa.Column('cta_caminho', sa.String(length=255), nullable=True, server_default=''),
        sa.Column('codigo_cupom', sa.String(length=50), nullable=True, server_default=''),
        sa.Column('whatsapp_mensagem', sa.String(length=300), nullable=True, server_default=''),
        sa.Column('publico', sa.String(length=20), nullable=False, server_default='todos'),
        sa.Column('frequencia', sa.String(length=20), nullable=False, server_default='uma_vez'),
        sa.Column('data_inicio', sa.DateTime(timezone=True), nullable=False),
        sa.Column('data_fim', sa.DateTime(timezone=True), nullable=False),
        sa.Column('prioridade', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('views_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('clicks_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=255), nullable=False, server_default=''),
        sa.Column('updated_by', sa.String(length=255), nullable=False, server_default=''),
        sa.ForeignKeyConstraint(['produto_id'], ['produtos.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('promocoes', schema=None) as batch_op:
        batch_op.create_index(
            'ix_promocoes_active_dates',
            ['is_active', 'data_inicio', 'data_fim', 'prioridade'],
            unique=False
        )
        batch_op.create_index(
            'ix_promocoes_publico',
            ['publico'],
            unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table('promocoes', schema=None) as batch_op:
        batch_op.drop_index('ix_promocoes_publico')
        batch_op.drop_index('ix_promocoes_active_dates')
    op.drop_table('promocoes')
