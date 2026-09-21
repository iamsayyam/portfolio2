import { about, contactIntro, projects, site, skills, type PlaceId } from '@/data/site';

type Tone = 'dark' | 'light';

const T = {
  dark: {
    body: 'text-white/85',
    mute: 'text-white/55',
    head: 'text-white',
    link: 'decoration-sun/70 hover:decoration-sun',
    hi: 'border-sun bg-white/[0.06]',
    lo: 'border-transparent',
  },
  light: {
    body: 'text-ink/85',
    mute: 'text-ink/55',
    head: 'text-ink',
    link: 'decoration-ink/40 hover:decoration-ink',
    hi: 'border-gold bg-black/[0.04]',
    lo: 'border-transparent',
  },
} as const;

type Props = { id: PlaceId; tone?: Tone; activeKey?: string | null; compact?: boolean };

export default function PlaceContent({ id, tone = 'light', activeKey = null, compact = false }: Props) {
  const t = T[tone];
  const link = `underline underline-offset-4 transition-colors ${t.link}`;
  const text = compact ? 'text-[15px] leading-[1.6]' : 'text-[1.05rem] leading-[1.75]';
  const item = (key: string) =>
    `border-l-[3px] pl-3 -ml-3 transition-colors ${activeKey === key ? t.hi : t.lo}`;

  switch (id) {
    case 'about':
      return (
        <div className={`max-w-[62ch] space-y-3 ${text} ${t.body}`}>
          {about.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      );

    case 'projects':
      return (
        <ul className={compact ? 'space-y-5' : 'space-y-8'}>
          {projects.map((p, i) => (
            <li key={p.title} data-key={`project:${i}`} className={item(`project:${i}`)}>
              <h3 className={`font-display text-lg font-semibold ${t.head}`}>
                <a href={p.href} className={link}>
                  {p.title}
                </a>
              </h3>
              <p className={`mt-1 max-w-[62ch] ${text} ${t.body}`}>{p.description}</p>
              <p className={`mt-1.5 text-sm ${t.mute}`}>{p.tags.join(', ')}</p>
            </li>
          ))}
        </ul>
      );

    case 'skills':
      return (
        <dl className={compact ? 'space-y-4' : 'space-y-6'}>
          {skills.map((g, i) => (
            <div key={g.group} data-key={`skill:${i}`} className={item(`skill:${i}`)}>
              <dt className={`font-display text-lg font-semibold ${t.head}`}>{g.group}</dt>
              <dd className={`mt-1 max-w-[62ch] ${text} ${t.body}`}>{g.items.join(', ')}</dd>
            </div>
          ))}
        </dl>
      );

    case 'contact':
      return (
        <div className="max-w-[62ch] space-y-5">
          <p className={`${text} ${t.body}`}>{contactIntro}</p>
          <p className={`font-display text-xl font-semibold sm:text-2xl ${t.head}`}>
            <a href={`mailto:${site.email}`} className={link}>
              {site.email}
            </a>
          </p>
          <ul className={`flex flex-wrap gap-x-5 gap-y-2 font-display ${t.head}`}>
            {site.socials.map((s, i) => (
              <li key={s.label} data-key={`social:${i}`} className={item(`social:${i}`)}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className={link}>
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      );
  }
}
