import { places, site } from '@/data/site';
import PlaceContent from './PlaceContent';

type Props = { active: boolean; hydrated: boolean; onExplore: () => void; canExplore: boolean };

/**
 * The plain scrolling version of the portfolio. It is always in the HTML
 * (so search engines and screen readers get real content) and is shown when
 * the visitor picks "Classic site", prefers reduced motion, or has no WebGL.
 */
export default function PageView({ active, hydrated, onExplore, canExplore }: Props) {
  return (
    <div
      data-page
      className={active ? 'min-h-screen bg-paper text-ink' : 'sr-only'}
      inert={hydrated && !active}
      aria-hidden={hydrated && !active}
    >
      <header className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 pt-8">
        <p className="font-display text-xl font-bold tracking-tight">
          {site.name}
          <span className="ml-0.5 inline-block h-2 w-2 rounded-full bg-sun ring-1 ring-ink/10" aria-hidden="true" />
        </p>
        {canExplore && (
          <button
            type="button"
            onClick={onExplore}
            className="rounded-full bg-sun px-4 py-2 font-display text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
          >
            Explore the 3D city
          </button>
        )}
        <nav aria-label="Sections" className="order-last flex w-full gap-5 font-display text-sm sm:order-none sm:w-auto">
          {places.map((p) => (
            <a key={p.id} href={`#${p.id}`} className="text-ink/60 transition-colors hover:text-ink">
              {p.name}
            </a>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-28 pt-20">
        <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl">{site.name}</h1>
        <p className="mt-4 font-display text-xl text-ink/60 sm:text-2xl">{site.role}</p>

        {places.map((p) => (
          <section key={p.id} id={p.id} className="mt-24 scroll-mt-8">
            <h2 className="font-display text-3xl font-semibold tracking-tight">{p.title}</h2>
            <div className="mt-6">
              <PlaceContent id={p.id} tone="light" />
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
