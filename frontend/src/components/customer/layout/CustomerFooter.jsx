import { Link } from 'react-router-dom'

/**
 * Minimal customer-portal footer.
 *
 * Carries the legal links Meta's App Review requires (Privacidade /
 * Termos / Exclusão de dados) plus a small copyright row. Kept
 * intentionally lightweight — the customer portal is mobile-first and
 * we don't want a multi-column footer eating screen on /cardapio.
 *
 * Rendered by CustomerLayout. Hidden when the sticky cart bar would
 * collide with it on focused routes (handled by `hidden` prop).
 */
export default function CustomerFooter({ hidden = false }) {
  if (hidden) return null
  return (
    <footer
      className="border-t mt-8 py-6 px-4"
      style={{ borderColor: 'var(--c-slate-line)' }}
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <p style={{ color: 'var(--c-slate-muted)' }}>
          © {new Date().getFullYear()} Pizzaria e Sorveteria Planalto
        </p>
        <nav className="flex items-center gap-4">
          <Link to="/privacidade" className="hover:underline" style={{ color: 'var(--c-slate-muted)' }}>
            Privacidade
          </Link>
          <Link to="/termos" className="hover:underline" style={{ color: 'var(--c-slate-muted)' }}>
            Termos
          </Link>
          <Link to="/exclusao-dados" className="hover:underline" style={{ color: 'var(--c-slate-muted)' }}>
            Excluir dados
          </Link>
        </nav>
      </div>
    </footer>
  )
}
