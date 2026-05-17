import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'

import AnimatedPage from '@/components/layout/AnimatedPage'
import LegalPageLayout from './LegalPageLayout'

/**
 * Data-deletion instructions page.
 *
 * Meta's App Review requires every app to expose a way for users to
 * delete their data — either a webhook (instant, automated) or a
 * documented manual process. We chose the manual route: user e-mails
 * us with their phone number, we confirm + purge within 30 days.
 *
 * The page also includes a "copy template e-mail" helper so the user
 * doesn't have to write the request from scratch.
 *
 * Lives at /exclusao-dados — submitted to Meta as the App's "User
 * data deletion → Data deletion instructions URL" during App Review.
 */
const TEMPLATE_SUBJECT = 'Solicitação de exclusão de dados — LGPD'
const TEMPLATE_BODY = `Olá,

Solicito a exclusão de todos os meus dados pessoais armazenados pela
Pizzaria e Sorveteria Planalto, conforme art. 18, VI da LGPD.

Dados para identificação:
- Nome completo: [seu nome]
- Telefone WhatsApp cadastrado: +55 (XX) XXXXX-XXXX
- E-mail da conta no portal (se houver): [seu e-mail]

Aguardo confirmação da exclusão em até 30 dias.

Atenciosamente,
[seu nome]`

export default function ExclusaoDados() {
  const [copied, setCopied] = useState(false)

  const copyTemplate = () => {
    navigator.clipboard.writeText(TEMPLATE_BODY).then(() => {
      setCopied(true)
      toast.success('Template copiado — cole no seu app de e-mail')
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const mailto =
    `mailto:pizzasplanalto@gmail.com` +
    `?subject=${encodeURIComponent(TEMPLATE_SUBJECT)}` +
    `&body=${encodeURIComponent(TEMPLATE_BODY)}`

  return (
    <AnimatedPage>
      <LegalPageLayout
        title="Exclusão de Dados"
        lastUpdated="16 de maio de 2026"
      >
        <p>
          Você pode pedir, a qualquer momento, a exclusão dos seus dados
          pessoais armazenados pela <strong>Pizzaria e Sorveteria Planalto</strong>.
          Esta página explica como, o que será excluído e o que precisamos manter
          por obrigação legal.
        </p>

        <h2>1. Como solicitar</h2>
        <p>
          Envie um e-mail para{' '}
          <a href="mailto:pizzasplanalto@gmail.com">
            pizzasplanalto@gmail.com
          </a>{' '}
          informando seu <strong>nome completo</strong> e o{' '}
          <strong>número de WhatsApp</strong> que você usa para fazer pedidos.
          Se preferir, use o botão abaixo para abrir um e-mail pré-preenchido:
        </p>

        <div
          className="rounded-2xl p-5 mt-3"
          style={{ background: 'var(--c-offwhite)', border: '1px solid var(--c-slate-line)' }}
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href={mailto}
              className="btn-primary text-center px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{ flex: 1 }}
            >
              Abrir e-mail pré-preenchido
            </a>
            <button
              onClick={copyTemplate}
              className="btn-secondary px-4 py-2.5 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-1.5"
              style={{ flex: 1 }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copiado' : 'Copiar texto do e-mail'}
            </button>
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--c-slate-muted)' }}>
            Não consegue enviar e-mail? Mande mensagem pelo WhatsApp{' '}
            <strong>(17) 99128-9777</strong> com a mesma informação.
          </p>
        </div>

        <h2>2. O que será excluído</h2>
        <ul>
          <li>Seu cadastro no portal (e-mail, senha, telefone, endereços salvos)</li>
          <li>Histórico de conversas com o assistente do WhatsApp</li>
          <li>Preferências e dados de contato (nome, CPF, observações)</li>
          <li>Coordenadas calculadas a partir dos seus endereços</li>
        </ul>

        <h2>3. O que precisamos manter</h2>
        <p>
          A legislação fiscal brasileira (art. 174 do CTN) nos obriga a guardar
          alguns dados por <strong>5 anos</strong>, mesmo após sua solicitação:
        </p>
        <ul>
          <li>Notas fiscais emitidas em seu nome</li>
          <li>Registros de pedidos pagos (valor, data, itens, forma de pagamento)</li>
          <li>Documentos relacionados a eventuais disputas em curso</li>
        </ul>
        <p>
          Esses registros ficam isolados, sem ligação com o seu perfil ativo, e
          são automaticamente expurgados após o prazo legal.
        </p>

        <h2>4. Prazo</h2>
        <p>
          A LGPD nos dá até <strong>15 dias</strong> para responder à sua
          solicitação. A exclusão efetiva acontece em até{' '}
          <strong>30 dias</strong> a partir da confirmação. Nesse prazo:
        </p>
        <ul>
          <li>Confirmamos por e-mail que recebemos o pedido</li>
          <li>Validamos sua identidade (responder do mesmo número/e-mail cadastrado já basta)</li>
          <li>Executamos a exclusão e enviamos confirmação por escrito</li>
        </ul>

        <h2>5. Consequências</h2>
        <ul>
          <li>Você perde acesso ao portal e ao histórico de pedidos</li>
          <li>Próximos pedidos precisarão de novo cadastro</li>
          <li>Pontos de fidelidade (quando existirem) também são apagados</li>
        </ul>

        <h2>6. Reativação</h2>
        <p>
          Após a exclusão, se quiser voltar a usar nosso serviço, basta fazer
          um novo cadastro normalmente — sem prejuízo nenhum.
        </p>

        <h2>7. Outros direitos LGPD</h2>
        <p>
          Além da exclusão, você pode pedir{' '}
          <strong>acesso, correção, portabilidade, anonimização</strong>{' '}
          ou{' '}
          <strong>revogação de consentimento</strong>. Use o mesmo e-mail{' '}
          <a href="mailto:pizzasplanalto@gmail.com">pizzasplanalto@gmail.com</a>{' '}
          descrevendo o que precisa. Detalhes completos na{' '}
          <a href="/privacidade">Política de Privacidade</a>.
        </p>

        <h2>8. Encarregado (DPO)</h2>
        <p>
          O ponto único de contato para questões de proteção de dados é o
          mesmo e-mail acima. Caso não fique satisfeito(a) com a resposta,
          você pode recorrer à{' '}
          <a href="https://www.gov.br/anpd" target="_blank" rel="noreferrer">
            ANPD — Autoridade Nacional de Proteção de Dados
          </a>.
        </p>
      </LegalPageLayout>
    </AnimatedPage>
  )
}
