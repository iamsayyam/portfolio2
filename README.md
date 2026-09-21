# Portfolio City (3D)

A personal portfolio built as a small 3D city you can explore, made with Next.js, TypeScript, Tailwind CSS
and Three.js. Four yellow buildings are your sections (About, Projects, Skills, Contact). Click one to
walk into its room. There is also a plain scrolling version ("Classic site") that is used automatically for
visitors who prefer reduced motion or whose browser has no WebGL, and is what search engines read.

All artwork is generated in code (no image files, no external assets, no analytics, no network calls).

## Make it yours

All text lives in one file: `src/data/site.ts`. Change your name, role, email, links, projects and skills there.

| To change | Look in |
| --- | --- |
| Colours of the world | `src/world/palette.ts` |
| Streets, buildings, cars, where the four landmarks stand | `src/world/city.ts` |
| Room furniture and what you can click inside each room | `src/world/rooms.ts` |
| Camera, controls, transitions, hover bubble | `src/world/engine.ts` |
| Buttons, menus, info card, splash screen | `src/components/World.tsx`, `Splash.tsx` |

Rooms show up to 5 projects and 5 skill groups as things you can click. Extra ones still appear in the info card.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build check
```

## Deploy on Vercel

**Option A: from GitHub (recommended)**
1. Create a new GitHub repository and push this folder to it.
2. Go to vercel.com/new and import the repository.
3. Keep the defaults (Framework: Next.js) and click Deploy.
Every push to `main` then redeploys automatically.

**Option B: from the command line**
```bash
npx vercel        # first deploy, follow the prompts
npx vercel --prod # publish to production
```

## Controls

Desktop: drag to rotate, mouse wheel to zoom, Space + drag to pan, click a yellow building to enter.
Phone: drag to rotate, pinch to zoom, two fingers to pan, tap a building (or its bubble) to enter.
Settings (top right) has a Low graphics mode for slower devices.
