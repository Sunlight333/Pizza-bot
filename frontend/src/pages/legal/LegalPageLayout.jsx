import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/**
 * Shared wrapper for the three legal pages (Privacidade, Termos, Exclusão
 * de dados). Lives inside CustomerLayout so the cream + Playfair brand
 * carries over, but uses a constrained max-w-3xl reading column and
 * typography helpers that aren't worth dragging into the global CSS.
 *
 * Why three separate routes instead of one combined "Legal" page:
 *   - Meta's App Review needs each URL submitted separately
 *     (Privacy policy URL, Terms of Service URL, Data deletion URL)
 *   - LGPD/GDPR best practice is to keep them logically separate so
 *     users can link to the specific concern without scroll-hunting
 */
export default function LegalPageLayout({ title, lastUpdated, children }) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm mb-6 hover:underline"
        style={{ color: 'var(--c-slate-muted)' }}
      >
        <ArrowLeft size={14} /> Voltar
      </Link>

      <h1 className="font-display text-3xl md:text-4xl leading-tight mb-2">
        {title}
      </h1>
      {lastUpdated && (
        <p className="text-sm mb-8" style={{ color: 'var(--c-slate-muted)' }}>
          Última atualização: {lastUpdated}
        </p>
      )}

      <div className="legal-prose space-y-5 leading-relaxed">{children}</div>

      <hr className="my-10" style={{ borderColor: 'var(--c-slate-line)' }} />
      <p className="text-xs text-center" style={{ color: 'var(--c-slate-muted)' }}>
        © {new Date().getFullYear()} Pizzaria e Sorveteria Planalto · CNPJ a definir
      </p>

      {/* Page-local typography rules — kept here instead of customer.css
          because they only ever apply to these three pages. */}
      <style>{`
        .legal-prose h2 {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 1.4rem;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
        }
        .legal-prose h3 {
          font-weight: 600;
          font-size: 1.05rem;
          margin-top: 1rem;
          margin-bottom: 0.25rem;
        }
        .legal-prose p { font-size: 0.95rem; }
        .legal-prose ul { list-style: disc; padding-left: 1.25rem; }
        .legal-prose ul li { margin: 0.25rem 0; font-size: 0.95rem; }
        .legal-prose strong { font-weight: 600; }
        .legal-prose a {
          color: var(--c-ovenred);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .legal-prose a:hover { color: var(--c-ovenred-deep); }
        .legal-prose code {
          background: rgba(31,24,21,0.06);
          padding: 0 0.35em;
          border-radius: 4px;
          font-size: 0.88em;
        }
      `}</style>
    </div>
  )
}
