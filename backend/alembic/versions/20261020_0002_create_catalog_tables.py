"""create_catalog_tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-20 03:20:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '0002'
down_revision: str | None = '0001'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. departamentos
    op.create_table(
        'departamentos',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('nome', sa.String(length=120), nullable=False),
        sa.Column('slug', sa.String(length=120), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=True, server_default=''),
        sa.Column('icone', sa.String(length=20), nullable=False, server_default='drop'),
        sa.Column('uso', sa.String(length=255), nullable=True, server_default=''),
        sa.Column('cuidado', sa.String(length=255), nullable=True, server_default=''),
        sa.Column('ordem', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=255), nullable=False, server_default=''),
        sa.Column('updated_by', sa.String(length=255), nullable=False, server_default=''),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('departamentos', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_departamentos_slug'), ['slug'], unique=True)
        batch_op.create_index('ix_departamentos_active_ordem', ['is_active', 'ordem'], unique=False)

    # 2. produtos
    op.create_table(
        'produtos',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('departamento_id', sa.String(length=36), nullable=False),
        sa.Column('nome', sa.String(length=160), nullable=False),
        sa.Column('slug', sa.String(length=160), nullable=False),
        sa.Column('marca', sa.String(length=80), nullable=False, server_default=''),
        sa.Column('tamanho', sa.String(length=40), nullable=False, server_default=''),
        sa.Column('descricao', sa.Text(), nullable=False, server_default=''),
        sa.Column('como_usar', sa.Text(), nullable=False, server_default=''),
        sa.Column('forma', sa.String(length=20), nullable=False, server_default='garrafa'),
        sa.Column('cor', sa.String(length=7), nullable=False, server_default='#003399'),
        sa.Column('imagem_url', sa.String(length=1000), nullable=True),
        sa.Column('imagem_posicao', sa.String(length=20), nullable=False, server_default='center'),
        sa.Column('imagem_zoom', sa.Integer(), nullable=False, server_default='100'),
        sa.Column('preco_de', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('preco_por', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('promo_inicio', sa.Date(), nullable=True),
        sa.Column('promo_fim', sa.Date(), nullable=True),
        sa.Column('embalagem_grande', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('ordem', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=255), nullable=False, server_default=''),
        sa.Column('updated_by', sa.String(length=255), nullable=False, server_default=''),
        sa.ForeignKeyConstraint(['departamento_id'], ['departamentos.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('produtos', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_produtos_slug'), ['slug'], unique=True)
        batch_op.create_index(batch_op.f('ix_produtos_departamento_id'), ['departamento_id'], unique=False)
        batch_op.create_index('ix_produtos_dept_active_ordem', ['departamento_id', 'is_active', 'ordem'], unique=False)
        batch_op.create_index('ix_produtos_active_ordem', ['is_active', 'ordem'], unique=False)
        batch_op.create_index(batch_op.f('ix_produtos_preco_por'), ['preco_por'], unique=False)

    # 3. kits
    op.create_table(
        'kits',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('nome', sa.String(length=120), nullable=False),
        sa.Column('slug', sa.String(length=120), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=False, server_default=''),
        sa.Column('publico', sa.String(length=40), nullable=False, server_default='empresa'),
        sa.Column('ordem', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=255), nullable=False, server_default=''),
        sa.Column('updated_by', sa.String(length=255), nullable=False, server_default=''),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('kits', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_kits_slug'), ['slug'], unique=True)
        batch_op.create_index('ix_kits_active_ordem', ['is_active', 'ordem'], unique=False)

    # 4. kit_itens
    op.create_table(
        'kit_itens',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('kit_id', sa.String(length=36), nullable=False),
        sa.Column('produto_id', sa.String(length=36), nullable=False),
        sa.Column('quantidade', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('ordem', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['kit_id'], ['kits.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['produto_id'], ['produtos.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('kit_itens', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_kit_itens_kit_id'), ['kit_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_kit_itens_produto_id'), ['produto_id'], unique=False)
        batch_op.create_index('ix_kit_itens_kit_ordem', ['kit_id', 'ordem'], unique=False)


def downgrade() -> None:
    op.drop_table('kit_itens')
    op.drop_table('kits')
    op.drop_table('produtos')
    op.drop_table('departamentos')
