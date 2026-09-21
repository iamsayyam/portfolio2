/**
 * Everything you see on the site lives in this file.
 * Replace the placeholder text below with your own and redeploy.
 */

export type PlaceId = 'about' | 'projects' | 'skills' | 'contact';

export const site = {
  name: 'Muhammad Sayyam Sharif',
  role: 'Full-stack developer',
  description:
    'Portfolio of Muhammad Sayyam Sharif, a full-stack developer who builds fast, well-designed web products.',
  email: 'sayyam.chaudhry1@gmail.com',
  socials: [
    { label: 'GitHub', href: 'https://github.com/iamsayyam' },
    { label: 'LinkedIn', href: 'https://pk.linkedin.com/in/muhammad-sayyam-sharif-b8898b364' },
    { label: 'Instagram', href: 'https://www.instagram.com/sayyam.official' },
  ],
};

export const places: { id: PlaceId; name: string; title: string }[] = [
  { id: 'about', name: 'About', title: 'Hi, I build for the web' },
  { id: 'projects', name: 'Projects', title: 'Things I have built' },
  { id: 'skills', name: 'Skills', title: 'What I work with' },
  { id: 'contact', name: 'Contact', title: 'Let’s talk' },
];

export const about = [
  'Write two or three sentences here about who you are and what you build. Say what kind of problems you like solving and who you usually solve them for.',
  'Add one sentence about how you work: how you collaborate, what you care about in the details, or what you are learning right now.',
];

export const projects = [
  {
    title: 'Project one',
    href: '#',
    description:
      'Replace this with one sentence on what it does and who it is for, then one sentence on what you did.',
    tags: ['Next.js', 'TypeScript', 'Tailwind CSS'],
  },
  {
    title: 'Project two',
    href: '#',
    description:
      'Describe the problem it solves and the result. Numbers help: users, speed-ups, hours saved.',
    tags: ['React', 'Node.js', 'PostgreSQL'],
  },
  {
    title: 'Project three',
    href: '#',
    description:
      'Link to the live site or the repository, and name the part you are proudest of.',
    tags: ['Python', 'FastAPI', 'Docker'],
  },
];

export const skills = [
  { group: 'Front end', items: ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Next.js', 'Tailwind CSS'] },
  { group: 'Back end', items: ['Node.js', 'Python', 'REST APIs', 'PostgreSQL', 'MongoDB'] },
  { group: 'Tools', items: ['Git', 'GitHub', 'Vercel', 'Figma', 'Linux'] },
];

export const contactIntro =
  'I am open to freelance projects and full-time roles. The quickest way to reach me is email; I reply within a couple of days.';
