import AnimatedPage from '@/components/layout/AnimatedPage'
import LegalPageLayout from './LegalPageLayout'

/**
 * Terms of Service for the WhatsApp ordering + web portal.
 *
 * Scope: only the digital ordering surface — covers what's expected of
 * users (truthful info, no abuse), what we promise (do our best to
 * deliver, no guaranteed uptime), refund/cancellation policy, and
 * jurisdiction (São José do Rio Preto / SP). Kept short and practical
 * because a pizzaria isn't a SaaS.
 *
 * Lives at /termos — submitted to Meta as the App's "Terms of Service
 * URL" during App Review.
 */
export default function Termos() {
  return (
    <AnimatedPage>
      <LegalPageLayout
        title="Termos de Uso"
        lastUpdated="16 de maio de 2026"
      >
        <p>
          Ao usar o atendimento da <strong>Pizzaria e Sorveteria Planalto</strong>{' '}
          pelo WhatsApp ou pelo site{' '}
          <a href="https://planaltopizzasesorvetes.com">planaltopizzasesorvetes.com</a>,
          você concorda com os termos abaixo. Leia com atenção — eles definem o que
          esperamos de você e o que você pode esperar de nós.
        </p>

        <h2>1. O que oferecemos</h2>
        <p>
          Atendimento para pedidos de pizzas, sorvetes, bebidas e outros itens do
          nosso cardápio, com entrega na área coberta e retirada no balcão. O
          atendimento pode ser feito por um assistente automatizado (bot) ou por
          um(a) atendente humano(a). Em ambos os casos, vale o cardápio e os
          preços do dia.
        </p>

        <h2>2. Cadastro e identificação</h2>
        <ul>
          <li>Para pedir, você precisa fornecer nome, telefone e endereço de entrega válidos.</li>
          <li>O telefone informado deve estar sob seu controle (verificamos com código no WhatsApp na primeira vez).</li>
          <li>Você é responsável por manter dados e endereço atualizados — entregas erradas por endereço incorreto não são reembolsadas.</li>
          <li>É proibido criar contas com dados de terceiros, automatizar interações ou tentar fraudar o sistema.</li>
        </ul>

        <h2>3. Pedidos e preços</h2>
        <ul>
          <li>Os preços e tempos exibidos durante o pedido são os que valem para aquele pedido.</li>
          <li>Promoções têm regras e prazos próprios, informados no momento da oferta.</li>
          <li>O pedido só está confirmado quando o sistema (ou um(a) atendente) responde com o número do pedido.</li>
          <li>Reservamo-nos o direito de recusar pedidos suspeitos de fraude ou fora da nossa área de cobertura.</li>
        </ul>

        <h2>4. Pagamento</h2>
        <ul>
          <li>Aceitamos PIX, cartão de crédito/débito na entrega ou no balcão, e dinheiro (informe o valor do troco antes da chegada do motoboy).</li>
          <li>PIX deve ser feito para a chave informada na conversa. Pedido só é despachado após confirmação do pagamento.</li>
          <li>Em caso de divergência (valor errado, comprovante incorreto), entre em contato imediatamente pelo WhatsApp para resolver.</li>
        </ul>

        <h2>5. Entrega</h2>
        <ul>
          <li>Tempo de entrega informado é estimativa, não garantia — pode variar por volume de pedidos, trânsito, distância ou clima.</li>
          <li>Cobramos taxa de entrega de acordo com o bairro/distância, calculada e exibida antes da confirmação do pedido.</li>
          <li>Endereços em zona rural podem exigir o envio da localização (pin) pelo WhatsApp.</li>
          <li>Se não conseguirmos entregar por endereço inválido ou ausência do cliente, podemos cobrar uma nova taxa de entrega.</li>
        </ul>

        <h2>6. Cancelamento e reembolso</h2>
        <ul>
          <li>Cancelamento sem custo: enquanto o pedido ainda não foi pra produção (geralmente até ~3 min após confirmar).</li>
          <li>Cancelamento durante o preparo: cobramos o que já foi preparado.</li>
          <li>Cancelamento após despacho: não há reembolso, mas se houver problema com o produto (item errado, frio, atrasado em mais de 30 min sem motivo) ofertaremos correção, desconto ou crédito conforme o caso.</li>
          <li>Reembolsos por PIX seguem o prazo do banco; por cartão, conforme regras da operadora.</li>
        </ul>

        <h2>7. Uso do WhatsApp e do assistente automatizado</h2>
        <ul>
          <li>Ao iniciar uma conversa, você consente em ser atendido por um sistema automatizado que pode usar histórico recente para entender seu pedido.</li>
          <li>A qualquer momento, você pode pedir para falar com uma pessoa — basta dizer "atendente" ou "humano".</li>
          <li>Não envie spam, mensagens ofensivas ou conteúdo ilegal. Conversas abusivas serão encerradas e podem resultar em bloqueio.</li>
          <li>Mensagens enviadas fora do horário de atendimento ficam registradas e respondemos quando reabrimos.</li>
        </ul>

        <h2>8. Conteúdo e propriedade intelectual</h2>
        <p>
          O cardápio, fotos, marca, logo, texto do site e do bot são propriedade
          da Pizzaria e não podem ser reproduzidos comercialmente sem permissão
          por escrito. Reproduções pessoais (compartilhar uma foto de pizza nas
          suas redes, recomendar a um amigo) são bem-vindas.
        </p>

        <h2>9. Limitação de responsabilidade</h2>
        <ul>
          <li>Fazemos o possível pra manter o serviço no ar, mas não garantimos disponibilidade 24/7 — manutenções, falhas de internet ou de provedores externos (WhatsApp, energia) podem causar indisponibilidade pontual.</li>
          <li>Não nos responsabilizamos por prejuízos indiretos (lucros cessantes, oportunidades perdidas) decorrentes de atrasos ou indisponibilidade.</li>
          <li>Para alergias e restrições alimentares, sempre avise antes de confirmar o pedido — nossas pizzas são preparadas em ambiente que manipula glúten, lactose, frutos do mar e nozes.</li>
        </ul>

        <h2>10. Privacidade</h2>
        <p>
          O tratamento dos seus dados está descrito na nossa{' '}
          <a href="/privacidade">Política de Privacidade</a>, que faz parte
          destes Termos.
        </p>

        <h2>11. Alterações nos Termos</h2>
        <p>
          Podemos atualizar estes Termos a qualquer momento. Mudanças
          significativas serão comunicadas no portal ou pelo WhatsApp.
          O uso contínuo do serviço após a mudança significa aceitação da nova versão.
        </p>

        <h2>12. Foro</h2>
        <p>
          Eventuais conflitos serão resolvidos no foro da Comarca de São José
          do Rio Preto/SP, com renúncia a qualquer outro, por mais privilegiado
          que seja.
        </p>

        <h2>13. Contato</h2>
        <p>
          Dúvidas sobre estes Termos:{' '}
          <a href="mailto:pizzasplanalto@gmail.com">pizzasplanalto@gmail.com</a>{' '}
          ou WhatsApp <strong>(17) 99128-9777</strong>.
        </p>
      </LegalPageLayout>
    </AnimatedPage>
  )
}
