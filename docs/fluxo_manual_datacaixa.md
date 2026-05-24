# Fluxo manual enquanto a integração Datacaixa não está automática

Documento para o atendente da loja — passo a passo de como tratar
cada pedido do bot enquanto a impressão automática na cozinha não
está rodando. Imprimir e deixar perto do caixa ajuda no início.

---

## O que continua funcionando normalmente

- **Bot atendendo o cliente no WhatsApp** — saudação, cardápio, cobrança,
  endereço, taxa de entrega, troco, confirmação. Sem alteração.
- **Painel admin** — todas as conversas e pedidos aparecem em tempo real.
- **Histórico do cliente, dados pessoais, CPF (se informado)** — tudo
  salvo no banco do bot.

## O que NÃO está chegando sozinho

- Impressão automática do ticket na cozinha (via Datacaixa).
- Lançamento automático do pedido no caixa da Datacaixa.

A Datacaixa atualizou o layout do arquivo de integração e o nosso
gerador ainda está sendo ajustado. Previsão de retorno ao automático:
poucas horas.

---

## Passo a passo manual (por pedido)

### 1. Identificar o pedido novo

Mantenha aberta no navegador a aba **Painel Admin → Pedidos**.

Quando um cliente fechar um pedido pelo WhatsApp, aparece:

- Um card novo no topo da lista de pedidos, status **Recebido**.
- Som de notificação (se ativado nas preferências do navegador).
- Contador no menu lateral acende.

### 2. Abrir o pedido e ler os dados

Clique no card. Aparece um painel lateral com:

- **Cliente:** nome + telefone (já em formato E.164, ex: 5517991289777)
- **Endereço de entrega:** rua, número, bairro, complemento, referência
- **Itens:** descrição completa de cada pizza (sabor, tamanho, borda,
  adicionais, quantidade)
- **Forma de pagamento:** dinheiro / cartão / PIX, e troco se for dinheiro
- **Subtotal, taxa de entrega, total**
- **Observações:** qualquer coisa que o cliente pediu (sem cebola, ponto
  da massa, etc.)

Confira o pedido inteiro antes de partir pra Datacaixa.

### 3. Lançar o pedido na Datacaixa

Abra a Datacaixa → aba **Delivery** → botão **Criar Novo**.

Preencha:

- **Cliente:** digite o nome do cliente. Se ele já existe no Datacaixa,
  selecione; se não, cria novo cadastro.
- **Telefone:** copie do painel.
- **Endereço de entrega:** copie do painel. Inclua complemento e
  referência se tiver.
- **Itens:** adicione um por vez. No campo "Código" digite o código
  do produto (ou pesquise por descrição) e quantidade.
- **Taxa de entrega:** digite o valor que aparece no painel.
- **Forma de pagamento:** marque a indicada (cash, cartão, PIX).
  Se for dinheiro com troco, anote o valor entregue no campo de
  observação.
- **Observações:** copie qualquer pedido especial do cliente
  (sem cebola, ponto da massa, etc.) — a cozinha só vê isso se for
  digitado na Datacaixa.

Clique em confirmar. A Datacaixa imprime o ticket na cozinha
automaticamente.

### 4. Atualizar o status no painel admin (opcional, mas recomendado)

De volta no painel admin, clique no card do pedido e mude o status:

- **Em preparo** — assim que a Datacaixa imprimiu e o pizzaiolo
  começou a fazer.
- **Saiu pra entrega** — quando o motoboy pegar.
- **Entregue** — depois que o cliente recebeu.

Isso não afeta a Datacaixa, mas mantém o histórico organizado e
permite mandar atualização pro cliente no futuro (quando a
mensagem de status estiver ligada).

---

## Dicas pra agilizar em horário de pico

- **Dois monitores** (ou duas abas em monitores diferentes): um com o
  Painel Admin, outro com Datacaixa em modo Delivery. Não fique
  trocando de aba o tempo todo.
- **Em pico (sexta/sábado à noite):** designa um atendente
  específico só pra transcrever os pedidos do bot pra Datacaixa,
  enquanto outro toca a cozinha.
- Use **Ctrl+C / Ctrl+V** pra copiar endereço e observações.
- **Não tente refazer cálculos** — o valor que o painel mostra é o
  valor que o cliente já viu e confirmou. Se você alterar, vira
  problema de cobrança depois.

---

## Erros comuns a evitar

- **Esquecer a observação** ("sem cebola", "ponto bem passado") —
  cozinha não vê se não foi digitado na Datacaixa.
- **Trocar o item** — se a descrição no painel diz "Pizza Grande
  Calabresa", lance Calabresa, não Calabresa Especial.
- **Esquecer a taxa de entrega** — Datacaixa não calcula taxa
  automaticamente; precisa digitar o valor que aparece no painel.
- **Cobrar a mais ou a menos** — sempre cobra o **Total Geral** que
  aparece no painel. Esse valor já considera subtotal + taxa + troco.

---

## Quando o automático voltar

Você vai receber aviso no WhatsApp avisando que a integração voltou.
A partir daquele momento:

- Pedidos do bot **passam a imprimir sozinhos** na cozinha (sem
  passar pelo Datacaixa manual).
- Você continua usando o **Painel Admin** pra acompanhar e atualizar
  status, mas não precisa mais **lançar nada manualmente**.

Esse documento fica salvo pra caso a integração caia de novo no
futuro — qualquer atendente novo consegue assumir o fluxo manual
em 5 minutos lendo isso aqui.
