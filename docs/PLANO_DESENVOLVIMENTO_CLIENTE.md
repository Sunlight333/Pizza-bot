# Plano de Desenvolvimento — Visão para o Cliente

Este documento descreve o que está planejado para o sistema do bot de
pedidos nos próximos meses. A linguagem foi escrita pensando no dono da
pizzaria, não no programador. Cada item explica três coisas: a situação
que existe hoje, o que a nova funcionalidade vai fazer, e por que isso
vale a pena para o seu negócio.

O plano está organizado em três horizontes. O primeiro é o que dá
retorno mais rápido e resolve incômodos do dia a dia. O segundo é onde
o sistema começa a trabalhar a favor do crescimento, recuperando
clientes que sumiram e abrindo novas formas de receber pedido. O
terceiro é estratégico, pensado para quando o negócio já tiver tração
para ir além de uma única pizzaria.


## 1. Curto prazo — primeiros três meses

### 1.1 Relatórios para entender o negócio

Hoje você consegue ver quantos pedidos chegaram no dia, mas se eu te
perguntar qual foi a pizza mais vendida na sexta-feira passada, ou se o
ticket médio aos sábados está crescendo, não tem como responder sem
mexer direto no banco de dados. Isso é um problema porque decisões
importantes ficam no chute. A nova página de relatórios vai mostrar o
que vende mais, em qual hora do dia, qual bairro dá mais receita, qual
a taxa de conversão do bot, e como o ticket médio está evoluindo. Com
isso você passa a decidir promoção, preço e turno baseado em número,
não em sensação.

### 1.2 Promoções e cupons

Quando você quer fazer uma promoção do tipo "sexta com vinte por cento
off" ou "compre duas grandes, ganhe um refri", hoje a única forma é
descontar manualmente no atendimento. Isso não escala, não rastreia, e
o bot não sabe aplicar. A funcionalidade de promoções permite criar
cupons com código, valor, validade e regras de uso. O cliente pode
digitar o código no WhatsApp e o bot aplica sozinho. No final do mês
você vê quantos cupons foram usados e quanto eles geraram de receita,
e a partir disso decide se vale a pena repetir.

### 1.3 Tela da cozinha

A cozinha hoje recebe os pedidos pelo papel impresso do Datacaixa. Não
existe um lugar onde o pizzaiolo veja tudo o que está em produção,
marque "pronto" e dispare o status "saiu para entrega" automaticamente.
Uma tela dedicada da cozinha, pensada para tablet, resolve isso. O
pedido aparece com cronômetro desde que entrou, o pizzaiolo toca em
"pronto" quando saiu do forno, e o motoboy é notificado na hora. Isso
reduz papel, reduz erro de "esqueci esse pedido", e dá ao cliente um
aviso mais preciso de quando a entrega sai.

### 1.4 Cliente acompanhando o pedido

Toda vez que o cliente pergunta "e meu pedido?" no WhatsApp, alguém
precisa parar de fazer outra coisa para responder. Mesmo o bot, embora
saiba responder, gasta uma rodada de mensagem que poderia não
acontecer. A solução é dar ao cliente um link público que ele acessa no
celular e vê o pedido andar pelas etapas, do recebido ao entregue. O
bot manda esse link automaticamente na confirmação. Resultado: menos
perguntas repetitivas no atendimento e cliente mais tranquilo.

### 1.5 Acabou ingrediente

Você liga pra cozinha e descobre que o bacon acabou. Hoje, para
impedir o bot de aceitar pedidos com bacon extra, você precisa
desativar a pizza inteira ou avisar manualmente. A funcionalidade de
"esgotado hoje" deixa você marcar um adicional ou uma borda específica
como indisponível para aquele dia. O bot deixa de oferecer, recusa
educadamente se o cliente pedir, e a marcação volta sozinha no início
do próximo expediente. Evita constrangimento de aceitar pedido que não
dá pra entregar.

### 1.6 Limite por dia

Você fez quarenta pizzas brotinho de massa especial e não tem mais.
Hoje o bot continua aceitando pedidos a noite inteira. A funcionalidade
de limite diário deixa você definir, por produto, quantas unidades
podem ser vendidas no dia. Quando o limite chega, o bot recusa novos
pedidos daquele item com uma mensagem amigável e oferece alternativa.
Funciona como uma trava de segurança contra over-selling.

### 1.7 Histórico de quem mudou o quê

Quando alguém da equipe altera um preço sem querer, ou marca uma pizza
como inativa, hoje não tem como descobrir quem fez nem quando. Isso
vira problema em pizzarias com mais de uma pessoa no painel. O
histórico registra cada alteração com nome do usuário, data e o que
mudou. Em caso de dúvida você abre, vê quem foi, e conversa
diretamente. É também um freio natural contra cliques distraídos.

### 1.8 Painel funciona no celular

Hoje o painel administrativo é desenhado para tela de computador. No
celular fica difícil de mexer, especialmente o editor de tamanhos e
preços. Como muitas vezes você está no balcão e só tem o celular na
mão, isso atrapalha. A versão responsiva adapta cada tela para o
celular, com menu lateral em formato hambúrguer e edição em coluna
única. Você passa a poder atender, mexer no cardápio e ver pedido de
qualquer lugar.

### 1.9 Melhorias do bot

Algumas melhorias do próprio atendimento entram nessa fase. A primeira
é o bot responder em áudio quando o cliente manda áudio, mantendo o
tom natural da conversa. A segunda é detectar quando o cliente está
nervoso ou frustrado pela mensagem, e nesse caso passar para
atendimento humano sem precisar o cliente pedir. A terceira é poder
ajustar a personalidade e as respostas do bot pelo painel, sem
precisar mexer em código. A quarta é uma base de respostas para
perguntas que não são pedido — horário, endereço, formas de pagamento
— para o bot responder na hora sem chamar a inteligência artificial
inteira, o que reduz custo. Juntas, essas mudanças fazem o bot parecer
mais humano e mais rápido.

### 1.10 Endereço automático pelo CEP

Quando o cliente passa o CEP, hoje o bot precisa perguntar rua, bairro
e ponto de referência separadamente. Com a busca por CEP, o bot pega
rua e bairro automaticamente e só pede número e complemento. Reduz o
tempo do pedido, reduz erro de digitação, e abre caminho para escolher
automaticamente a faixa de entrega correta pela distância.


## 2. Médio prazo — entre três e seis meses

### 2.1 Disparo em massa para clientes antigos

Existem hoje cerca de seis mil contatos cadastrados na base. A maioria
fez um pedido em algum momento e não voltou. Esses clientes são, de
longe, o canal de crescimento mais barato que a pizzaria tem. A
funcionalidade de campanha permite escolher um grupo (clientes que não
pediram nos últimos sessenta dias, por exemplo), escolher uma mensagem,
e disparar em horário programado, dentro das regras do WhatsApp para
não bloquear a conta. Cada campanha registra quantos clientes
responderam e quantos voltaram a pedir, então você vê o que funciona.

### 2.2 Cupom de aniversário

No dia do aniversário o cliente recebe automaticamente um cupom de
desconto válido por sete dias. É uma prática padrão no varejo de
alimentação porque combina baixo custo, alta taxa de uso, e percepção
positiva de marca. O bot pergunta a data de aniversário em algum
pedido futuro (de forma opcional, com permissão), e a partir daí o
disparo é automático.

### 2.3 Programa de fidelidade

A cada real gasto o cliente acumula pontos. Em determinada faixa,
ganha desconto ou pizza grátis. É um mecanismo conhecido de retenção
que faz o cliente preferir você ao concorrente, mesmo que o preço
esteja parecido. O sistema gerencia os pontos, o resgate e a
expiração; o bot informa o saldo quando o cliente pergunta.

### 2.4 Gestão de motoboys

Hoje o motoboy está fora do sistema. Não há registro de quem está
levando qual pedido, quanto tempo demorou, ou qual o desempenho de
cada um. Com a gestão de motoboy você cadastra cada um, atribui pedido,
e o motoboy tem uma página própria no celular onde marca "saí" e
"entreguei". Isso gera dados de tempo médio de entrega, ajuda a
identificar problemas, e abre caminho para o cliente ter localização
em tempo real do pedido dele.

### 2.5 Pedidos do iFood e Rappi no mesmo lugar

Provavelmente a pizzaria já recebe alguns pedidos por iFood ou Rappi e
hoje esses pedidos são digitados manualmente no Datacaixa. Isso é
trabalho duplicado e fonte de erro. A integração faz os pedidos
chegarem direto no painel, junto com os do bot, no mesmo fluxo até o
Datacaixa. O atendente passa a ter uma única fila para olhar.

### 2.6 Permissões diferentes para cada funcionário

Hoje todo mundo que entra no painel tem acesso total. O atendente pode
acidentalmente apagar um produto. O dono pode acidentalmente fechar
uma configuração que não devia. Com a separação de funções (dono,
gerente, atendente, motoboy), cada um vê e mexe só no que faz sentido.
Reduz risco de erro e protege os dados.

### 2.7 Pizza com refrigerante por preço fechado

O combo é uma forma comum de aumentar ticket médio: pizza grande mais
refrigerante de dois litros por um valor menor que a soma. Hoje não há
como expressar isso no sistema, então o desconto é manual e o bot não
sabe oferecer. A funcionalidade de combo permite criar pacotes com
preço fixo, e o bot passa a sugerir quando o cliente está pedindo a
pizza separada.

### 2.8 Recibo por email

Cliente corporativo, especialmente quando paga com cartão da empresa,
costuma pedir nota por email. Hoje isso é feito manualmente quando é
feito. Com o envio automático, depois da emissão fiscal o cliente
recebe o PDF na caixa de entrada. É baixo custo de implementar e gera
profissionalismo na percepção do cliente.


## 3. Longo prazo — seis meses ou mais

### 3.1 Vender o sistema para outras pizzarias

Se o sistema funciona bem aqui, ele provavelmente funciona em outras
pizzarias parecidas. A funcionalidade de múltiplas lojas permite
hospedar várias pizzarias no mesmo sistema, cada uma com seu cardápio,
seus motoboys, sua configuração de bot e suas notas fiscais. É uma
mudança grande de arquitetura, mas abre uma linha de receita
recorrente além da pizzaria original.

### 3.2 Atender ligações por telefone

Cliente mais velho prefere ligar. Hoje a ligação cai com alguém da
equipe e tira essa pessoa do balcão. A versão por voz usa as mesmas
regras de pedido do bot do WhatsApp, mas atende ligações com fala
natural, transcreve o que o cliente disse, e responde com voz
sintetizada. O cliente liga, faz o pedido, e o atendente nem precisa
parar o que está fazendo. Útil principalmente em horários de pico.

### 3.3 Prever quantos funcionários vão ser necessários

Com seis meses de histórico de pedidos, dá para construir um modelo
simples que prevê o volume de pedido por dia da semana, levando em
conta clima, feriado e padrão sazonal. Esse modelo recomenda quantos
pizzaiolos e motoboys escalar para cada turno. Quem usa essa previsão
tende a reduzir custo de pessoal nos dias parados e evitar atraso nos
dias cheios.

### 3.4 Marca própria do painel

Quando outras pizzarias começam a usar o sistema, faz sentido cada uma
poder colocar sua logo, suas cores, e sua identidade visual no painel.
Não tem efeito direto no operacional, mas é importante para o cliente
final que assina o serviço sentir que está usando uma ferramenta
própria, não algo emprestado.

### 3.5 Saber o que o cliente achou

Depois que o pedido é entregue, o bot pergunta de zero a dez como foi
a experiência, e se houve algo abaixo de oito, pergunta o motivo. As
respostas alimentam um indicador de satisfação no painel, e os
comentários abertos viram caixa de entrada de melhoria. É a forma
mais direta de ouvir o cliente em escala, sem depender do que chega
de forma orgânica nas redes sociais.


## 4. Onde o foco mora

Se for para escolher uma única coisa para fazer por mês, a recomendação
é começar pelos itens que reduzem incômodo do dia a dia e dão
visibilidade do negócio.

### 4.1 Mês 1 — eficiência operacional

Acabou ingrediente (item 1.5), histórico de quem mudou o quê (item
1.7) e painel no celular (item 1.8). Resolve incômodos imediatos da
operação e dá segurança contra erro humano.

### 4.2 Mês 2 — visibilidade

Relatórios (item 1.1) e melhorias do bot (item 1.9). A pizzaria passa
a se enxergar em números, e a qualidade do atendimento automatizado
passa a ser medida em vez de palpitada.

### 4.3 Mês 3 — cliente final

Link de acompanhamento (item 1.4), endereço por CEP (item 1.10) e
limite diário (item 1.6). Reduz fricção no momento do pedido e evita
prometer o que não dá pra entregar.

### 4.4 Mês 4 — crescimento

Cupons (item 1.2), aniversário (item 2.2) e fidelidade (item 2.3).
Primeira engrenagem real de retenção entra em operação.

### 4.5 Mês 5 — fluxo operacional

Tela da cozinha (item 1.3) e gestão de motoboy (item 2.4). Cozinha e
entrega entram no sistema em vez de ficar no papel e na cabeça.

### 4.6 Mês 6 — alcance

Disparo em massa (item 2.1) e iFood/Rappi (item 2.5). Ativação dos
seis mil contatos da base e unificação de todos os canais de pedido
em uma fila só.

### 4.7 Depois do sexto mês

A prioridade depende do que funcionou e do que o mercado pediu. As
funcionalidades de longo prazo, especialmente vender o sistema para
outras pizzarias (item 3.1), só fazem sentido se o uso aqui já
estiver demonstravelmente sólido e replicável.


## 5. Como este documento deve ser usado

### 5.1 Não é contrato, é referência

Este plano não é um contrato fechado. É uma referência de prioridade.
À medida que algo é entregue, a recomendação é registrar no fim deste
arquivo, com a data, o que foi feito, sem apagar o item original. Isso
preserva o histórico de decisão e ajuda a explicar, mais adiante, por
que tal caminho foi escolhido.

### 5.2 Revisão a cada três meses

Vale revisitar o plano com o dono da pizzaria a cada três meses.
Necessidades mudam. O que parecia urgente em janeiro pode virar
secundário em abril, e o que parecia distante pode subir para o topo
da fila depois de uma conversa com algum cliente importante.
