import AnimatedPage from '@/components/layout/AnimatedPage'
import LegalPageLayout from './LegalPageLayout'

/**
 * LGPD-compliant privacy policy for the WhatsApp + web portal flow.
 *
 * Spells out: what we collect, why, lawful basis, sub-processors (Meta,
 * OpenAI, Google for geocoding), retention periods, and how the user
 * exercises their LGPD rights. Lives at /privacidade — submitted to
 * Meta as the App's "Privacy policy URL" during App Review.
 *
 * Update the `lastUpdated` date when changing material content.
 */
export default function Privacidade() {
  return (
    <AnimatedPage>
      <LegalPageLayout
        title="Política de Privacidade"
        lastUpdated="16 de maio de 2026"
      >
        <p>
          Esta política descreve como a <strong>Pizzaria e Sorveteria Planalto</strong>{' '}
          (doravante "nós", "Pizzaria") coleta, usa, armazena e compartilha os dados
          pessoais dos clientes que interagem com nosso atendimento pelo WhatsApp e
          pelo site <a href="https://planaltopizzasesorvetes.com">planaltopizzasesorvetes.com</a>.
          Está em conformidade com a Lei nº 13.709/2018 (LGPD).
        </p>

        <h2>1. Controlador dos dados</h2>
        <p>
          <strong>Pizzaria e Sorveteria Planalto</strong> · CNPJ a definir ·
          E-mail de contato: <a href="mailto:pizzasplanalto@gmail.com">pizzasplanalto@gmail.com</a>.
          Em caso de dúvidas, solicitações ou reclamações sobre seus dados, fale
          conosco por esse e-mail ou pelo nosso WhatsApp <strong>(17) 99128-9777</strong>.
        </p>

        <h2>2. Dados que coletamos</h2>
        <h3>a) Informações que você nos fornece</h3>
        <ul>
          <li>Nome, telefone (WhatsApp), CPF (quando solicita nota fiscal)</li>
          <li>Endereço de entrega, ponto de referência</li>
          <li>Pedidos: itens, forma de pagamento, observações</li>
          <li>Mensagens trocadas pelo WhatsApp e pelo chat do site (texto, áudio, imagens, localização)</li>
          <li>E-mail e senha para acesso ao portal de pedidos online</li>
        </ul>
        <h3>b) Informações coletadas automaticamente</h3>
        <ul>
          <li>Histórico de pedidos vinculado ao seu telefone</li>
          <li>Coordenadas (latitude/longitude) calculadas a partir do endereço para cálculo de taxa de entrega</li>
          <li>Dados técnicos básicos do navegador (tipo, idioma) para suporte</li>
        </ul>

        <h2>3. Para que usamos seus dados</h2>
        <ul>
          <li><strong>Executar seus pedidos:</strong> tirar pedido, calcular entrega, processar pagamento, emitir nota fiscal, despachar motoboy.</li>
          <li><strong>Atendimento automatizado:</strong> nosso assistente conversacional usa o histórico recente para entender suas preferências e responder com agilidade.</li>
          <li><strong>Suporte e disputa:</strong> consultar conversas e pedidos passados quando houver alguma reclamação.</li>
          <li><strong>Comunicações operacionais:</strong> avisar mudanças de status do pedido, eventuais problemas na entrega, recuperação de senha.</li>
          <li><strong>Cumprir obrigações fiscais:</strong> guardar dados de venda e nota fiscal pelo prazo exigido pela Receita Federal e pela Sefaz.</li>
        </ul>

        <h2>4. Bases legais (LGPD, art. 7º)</h2>
        <ul>
          <li><strong>Execução de contrato</strong> — para preparar e entregar o pedido.</li>
          <li><strong>Cumprimento de obrigação legal/regulatória</strong> — armazenamento fiscal por 5 anos.</li>
          <li><strong>Legítimo interesse</strong> — prevenção a fraudes e melhoria do serviço.</li>
          <li><strong>Consentimento</strong> — quando enviarmos mensagens promocionais (opcional, com opt-out fácil).</li>
        </ul>

        <h2>5. Com quem compartilhamos seus dados (sub-processadores)</h2>
        <p>
          Não vendemos seus dados. Compartilhamos o mínimo necessário com prestadores que viabilizam o serviço:
        </p>
        <ul>
          <li><strong>Meta Platforms Ireland Ltd.</strong> — operadora do WhatsApp Cloud API. Recebe suas mensagens trocadas com a Pizzaria para entregar entre as partes. <a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noreferrer">Política de privacidade do WhatsApp</a>.</li>
          <li><strong>OpenAI, L.L.C.</strong> — modelo de linguagem que gera as respostas do assistente. Recebe o conteúdo da conversa do momento para compor a resposta; <em>não</em> usa esses dados para treinar modelos (uso via API com retenção zero, conforme contrato).</li>
          <li><strong>OpenStreetMap (Nominatim)</strong> — geocodificação de endereços para cálculo de taxa de entrega (consulta anônima).</li>
          <li><strong>Datacaixa</strong> — sistema de emissão fiscal local (na pizzaria). Recebe dados do pedido para imprimir nota e cupom.</li>
          <li><strong>Provedor de hospedagem (DigitalOcean Inc.)</strong> — armazena o banco de dados em servidor localizado nos Estados Unidos.</li>
        </ul>

        <h2>6. Transferência internacional</h2>
        <p>
          Parte da infraestrutura (Meta, OpenAI, DigitalOcean) está em jurisdição
          fora do Brasil. Adotamos cláusulas contratuais padrão e medidas técnicas
          (criptografia em trânsito via TLS, controle de acesso por chaves) para
          proteger seus dados, conforme art. 33 da LGPD.
        </p>

        <h2>7. Por quanto tempo guardamos seus dados</h2>
        <ul>
          <li><strong>Conta no portal:</strong> enquanto a conta existir. Você pode pedir exclusão a qualquer momento.</li>
          <li><strong>Histórico de pedidos:</strong> 5 anos (prazo fiscal — art. 174 do CTN).</li>
          <li><strong>Mensagens do WhatsApp:</strong> 12 meses para suporte. Depois, arquivadas ou apagadas.</li>
          <li><strong>Logs técnicos:</strong> 90 dias.</li>
        </ul>

        <h2>8. Seus direitos (LGPD, art. 18)</h2>
        <p>Você pode, a qualquer momento, solicitar:</p>
        <ul>
          <li>Confirmação de que tratamos seus dados</li>
          <li>Acesso a uma cópia dos seus dados</li>
          <li>Correção de dados incompletos ou desatualizados</li>
          <li>Anonimização, bloqueio ou exclusão de dados desnecessários</li>
          <li>Portabilidade para outro fornecedor</li>
          <li>Eliminação dos dados tratados com consentimento</li>
          <li>Informação sobre com quem compartilhamos</li>
          <li>Revogação de consentimento</li>
        </ul>
        <p>
          Para exercer qualquer um desses direitos, veja a página{' '}
          <a href="/exclusao-dados">/exclusao-dados</a> ou envie e-mail para{' '}
          <a href="mailto:pizzasplanalto@gmail.com">pizzasplanalto@gmail.com</a>.
          Respondemos em até 15 dias.
        </p>

        <h2>9. Segurança</h2>
        <p>
          Senhas são armazenadas com hash criptográfico (bcrypt). Conexões usam
          TLS 1.2+. Tokens de sessão são httpOnly. Aplicamos princípio de menor
          privilégio em quem acessa os dados internamente. Em caso de incidente
          de segurança que possa afetar você, comunicamos no prazo da LGPD.
        </p>

        <h2>10. Cookies</h2>
        <p>
          O site usa apenas cookies essenciais (sessão, carrinho). Não usamos
          rastreadores de marketing nem cookies de terceiros para publicidade.
        </p>

        <h2>11. Crianças e adolescentes</h2>
        <p>
          O serviço não se destina a menores de 13 anos. Pedidos por menores
          devem ter consentimento dos responsáveis.
        </p>

        <h2>12. Mudanças nesta política</h2>
        <p>
          Podemos atualizar esta política. Mudanças significativas serão
          avisadas pelo WhatsApp ou e-mail cadastrado. A data no topo desta
          página mostra quando foi a última revisão.
        </p>

        <h2>13. Contato</h2>
        <p>
          Dúvidas, denúncias ou solicitações:{' '}
          <a href="mailto:pizzasplanalto@gmail.com">pizzasplanalto@gmail.com</a>{' '}
          ou WhatsApp <strong>(17) 99128-9777</strong>.
          Caso entenda que seus direitos não foram atendidos, você pode
          reclamar diretamente à{' '}
          <a href="https://www.gov.br/anpd" target="_blank" rel="noreferrer">
            Autoridade Nacional de Proteção de Dados (ANPD)
          </a>.
        </p>
      </LegalPageLayout>
    </AnimatedPage>
  )
}
