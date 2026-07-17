import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'NMDPRA Fleet Management',
    template: '%s | NMDPRA Fleet Management',
  },
  description: 'Enterprise fleet operations and administration platform for NMDPRA.',
  icons: {
    icon: '/nmdpra-logo.png',
    shortcut: '/nmdpra-logo.png',
    apple: '/nmdpra-logo.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('fleet-theme');var d=t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
