import Image from 'next/image';

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="auth-layout">
      <section className="auth-brand-panel">
        <div className="auth-brand">
          <Image className="brand-logo large" src="/nmdpra-logo.png" alt="NMDPRA logo" width={120} height={120} priority />
          <div>
            <strong>NMDPRA</strong>
            <span>Fleet Management System</span>
          </div>
        </div>
        <div className="auth-message">
          <span>Enterprise Fleet Operations</span>
          <h1>Accountable mobility for public service.</h1>
          <p>
            One secure platform for transport requests, fleet operations, compliance, and insight.
          </p>
        </div>
        <small>© 2026 Nigerian Midstream and Downstream Petroleum Regulatory Authority</small>
      </section>
      <section className="auth-form-panel">{children}</section>
    </main>
  );
}
