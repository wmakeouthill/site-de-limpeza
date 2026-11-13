# Como colocar um agente para implementar o site e o CMS da Falcão Limpeza

Esta entrega contém só documentação: o protótipo organizado em `prototipo/`, a
[spec](../specs/site-falcao-limpeza.md) e estes prompts. Nada foi copiado do Falcon, nenhum plano de
implementação foi escrito e nenhum commit, push ou deploy foi autorizado.

Ordem: **plano → (revisão) → execução**. Cada prompt vai numa conversa nova, aberta neste projeto.

## 1. Preparar o contexto

1. Abra a conversa de desenvolvimento em `D:\freela-workspace\falcao-limpeza`.
2. Garanta que o agente consiga **ler** `D:\freela-workspace\falcon-advocacia-site`. Ele é só
   origem: nada é escrito lá. Em outra máquina, disponibilize uma cópia dos arquivos versionados
   do Falcon (sem `.env`, uploads ou banco) e troque o caminho nos prompts.
3. Revise a spec, principalmente a seção 16 (em aberto) e as regras de texto da seção 12.
4. O modo de execução já vem escolhido no prompt da seção 4: coordenador com subagentes por
   tarefa independente, revisão do diff acumulado por fase; auth, migrations e contratos em
   sequência. Alternativa: um agente só, fase a fase, com o mesmo plano.

## 2. Prompt para escrever o plano

```text
Trabalhe no projeto D:\freela-workspace\falcao-limpeza.
Leia as instruções canônicas do projeto e a spec docs/specs/site-falcao-limpeza.md inteira
(comece pela seção 0). O protótipo de referência está em prototipo/ (veja prototipo/LEIAME.md).
A origem a copiar é D:\freela-workspace\falcon-advocacia-site, somente leitura.

Escreva o plano de implementação em docs/superpowers/plans/AAAA-MM-DD-site-falcao-limpeza.md
(data de hoje), usando regras-core:spec-driven e superpowers:writing-plans. O plano é grande:
grave primeiro o esqueleto (contexto autossuficiente, índice das fases P0–P7 da seção 15 com
entrega testável e dependências, seção "Interfaces já definidas") e depois uma fase por vez,
anexada ao arquivo e marcada no índice. Leia no Falcon só o código que a fase toca.

Cada tarefa diz os arquivos, o teste que nasce do critério de aceite (seção 14) e o comando
para rodar. Registre no plano o commit do Falcon usado na cópia. Para cada fase, indique o
modelo do executor conforme regras-modelo.

Não escreva código de produto, não copie o Falcon ainda e não altere a spec sem me dizer o
motivo. Se achar conflito entre a spec e o Falcon, liste no fim do plano, com o impacto.
Não faça commit, push nem PR.
```

## 3. Prompt de revisão (opcional, antes de autorizar a execução)

```text
Trabalhe no projeto D:\freela-workspace\falcao-limpeza.
Leia as instruções canônicas do projeto, docs/specs/site-falcao-limpeza.md e o plano em
docs/superpowers/plans/ (o mais recente de site-falcao-limpeza).
Revise a spec e o plano contra o Falcon em D:\freela-workspace\falcon-advocacia-site
(somente leitura) e contra o protótipo em prototipo/.
Use regras-core:spec-driven. Relate: critério de aceite sem tarefa, tarefa sem teste,
contrato do plano diferente da seção 11 da spec, rota faltando na allowlist do BFF,
qualquer texto que fira a seção 12 (vitrine, preço por quantidade, nota fiscal).
Não implemente, não altere código e não crie outro plano.
```

## 4. Prompt para executar depois de aprovar o plano

Enviar este prompt autoriza implementar, não autoriza Git nem deploy.

```text
Li e aprovo docs/specs/site-falcao-limpeza.md e o plano em docs/superpowers/plans/
(o mais recente de site-falcao-limpeza).

Implemente o site e o CMS da Falcão Limpeza neste projeto: D:\freela-workspace\falcao-limpeza.
Origem para copiar e reaproveitar, somente leitura: D:\freela-workspace\falcon-advocacia-site.

Leia primeiro as instruções canônicas do projeto. Comece por P0: copie só os arquivos
versionados do Falcon (git archive HEAD), remova e renomeie conforme a seção 2 da spec.
Reaproveite auth, uploads, editor, artigos, depoimentos, métricas, sitemap e testes do Falcon;
não reescreva do zero o que já funciona. prototipo/ é referência: não edite.

Modo escolhido: um agente coordenador com superpowers:subagent-driven-development.
Despache subagentes para tarefas independentes do plano; auth, migrations e contratos de API
são sequenciais. Siga regras-modelo para o modelo de cada tarefa. Revise o diff acumulado ao
fim de cada fase, sem pedir review externo. Se o harness não tiver subagentes, siga inline por
fases, sem fingir que delegou.

Avance de P0 a P7 mantendo o índice e as interfaces do plano atualizados. Cada critério de
aceite da seção 14 vira teste. Use superpowers:verification-before-completion antes de dizer
que algo funciona.

Não copie .env, chaves, uploads, banco, conteúdo, imagens ou dados do Falcon. Não escreva no
Falcon. Seed só em desenvolvimento, a partir de prototipo/fonte/p4.html, marcado como fictício.
Nada de venda online, preço por quantidade, "vitrine" ou nota fiscal nos textos.
Não faça commit, push, PR, pedido de review externo, deploy ou recurso de nuvem sem ordem
específica minha. Nunca crie bypass de login; use mocks só nos testes.

Se houver impedimento real ou a spec precisar mudar, explique o impacto antes de alterar o
desenho; não esconda a lacuna com sucesso fictício.

Ao terminar, mostre: o que foi mantido, adaptado e removido do Falcon; arquivos alterados;
comandos de validação e resultados; como subir a stack local e criar o primeiro usuário do
CMS; o que depende de dado real da loja (seção 16).
```

## 5. Retomar depois de interrupção

```text
Retome a implementação do site da Falcão Limpeza a partir do índice e das interfaces do plano em
docs/superpowers/plans/ (o mais recente de site-falcao-limpeza). Mantenha a spec e as autorizações
anteriores. Leia a primeira fase incompleta e continue dali; não recomece a cópia do Falcon,
não apague alterações e não refaça o plano.
```

## 6. Como conferir a entrega

- `grep -ri falcon` fora de `docs/` e `prototipo/` não acha nada (o destino usa "falcao"); nenhum `.env`, upload ou imagem do Falcon veio.
- No CMS: criar produto com oferta, ver "de/por" no site sem build; a oferta some sozinha no dia
  seguinte ao fim.
- Lista e cotação abrem o WhatsApp com a mensagem no formato da spec (RF-L03, RF-L04) e com o
  número cadastrado em Dados da loja.
- Promoção de entrada aparece uma vez, respeita público e frequência, fecha com Esc e não
  aparece no `/cms`.
- Guia com "O que você vai precisar" põe os produtos na lista; artigo "A gente testou" tem selo.
- Depoimentos, guias e artigos somem do site quando desligados ou inativos.
- Testes da seção 14 verdes; relatório separa o que foi testado com mock e o que depende de dado
  real da loja.
- Nenhum commit, push ou deploy feito sem ordem.
