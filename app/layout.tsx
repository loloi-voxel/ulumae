// ./app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';
import MfaChallengeGate from '@/components/MfaChallengeGate';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'ULUMAE — Every life, an indelible mark',
  description:
    'Permanent memorials for generations. Preserve life stories, photos, and memories on the Arweave blockchain with a 200-year endowment. Not a social network — a legacy.',
  keywords: ['digital memorial', 'legacy', 'permanent preservation', 'Arweave', 'family archive', 'estate planning', 'digital legacy'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/ulumae_logo_v3.svg" type="image/svg+xml" />
        <link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900&family=Cinzel:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <style>{`
          :root {
            --font-inter: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            --font-serif-alpha: 'Cinzel', Georgia, serif;
            --font-serif-num: 'Bodoni Moda', Georgia, serif;
          }
        `}</style>
      </head>
      <body className="bg-surface-low text-warm-dark">
        <AuthProvider>
          {children}
          <MfaChallengeGate />
          <Footer />
          <Toaster position="bottom-right" />
        </AuthProvider>
      </body>
    </html>
  );
}

function Footer() {
  return (
    <footer id="site-footer" className="border-t border-warm-border/30 bg-surface-low">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-12">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-2">
            <p className="font-serif text-lg text-warm-dark">
              ULUMAE
            </p>
            <p className="text-xs text-warm-muted">
              Architecture of a lasting memory.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-widest text-warm-outline">
              Navigation
            </p>
            <div className="mt-1 flex flex-col gap-1 text-sm text-warm-muted">
              <a href="/how-it-works" className="hover:text-warm-dark transition-colors">
                How It Works
              </a>
              <a href="/learn-more" className="hover:text-warm-dark transition-colors">
                Learn More
              </a>
              <a href="/choice-pricing" className="hover:text-warm-dark transition-colors">
                Pricing
              </a>
              <a href="/faq" className="hover:text-warm-dark transition-colors">
                FAQ
              </a>
              <a href="/contact" className="hover:text-warm-dark transition-colors">
                Contact
              </a>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-widest text-warm-outline">
              Contact
            </p>
            <p className="text-sm text-warm-muted">
              First conversation offered, discreet and without obligation.
            </p>
            <a
              href="mailto:contact@ulumae.com"
              className="text-sm text-warm-muted underline underline-offset-4 hover:text-warm-dark transition-colors"
            >
              contact@ulumae.com
            </a>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between text-[11px] text-warm-outline">
          <span>© {new Date().getFullYear()} ULUMAE</span>
          <span className="hidden md:inline">
            Transmission is not an instant act. It is a process.
          </span>
        </div>
      </div>
    </footer>
  );
}
