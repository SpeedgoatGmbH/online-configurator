# Speedgoat Product Configurator

A Next.js-based product configurator prototype for Speedgoat.

## Tech Stack

- **Next.js 14+** with App Router
- **React 18+**
- **TypeScript**
- **Node.js**

## Getting Started

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```plaintext
├── app/                    # Next.js App Router directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # Reusable React components
├── public/                # Static assets
└── types/                 # TypeScript type definitions
```

## Development Guidelines

- Use TypeScript for all components and pages
- Follow Next.js App Router conventions
- Keep components modular and reusable
- Use modern React patterns (hooks, functional components)

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Deploy on Vercel

This project is configured for Vercel with `vercel.json`.

1. Install the Vercel CLI:

```bash
npm i -g vercel
```

2. Link the project:

```bash
vercel link
```

3. Deploy a preview:

```bash
vercel
```

4. Deploy to production:

```bash
vercel --prod
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
