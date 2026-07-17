import Link from 'next/link';
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  return (
    <div className="auth-card">
      <Link className="back-link" href="/login">
        <ArrowLeft size={16} /> Back to sign in
      </Link>
      <header>
        <span>Account recovery</span>
        <h1>Reset your password</h1>
        <p>Enter your official email address and we’ll send password reset instructions.</p>
      </header>
      <form>
        <label>
          <span>Email address</span>
          <div className="input-with-icon">
            <Mail size={18} />
            <input type="email" placeholder="name@nmdpra.gov.ng" required />
          </div>
        </label>
        <button type="submit" className="auth-submit">
          Send reset instructions <ArrowRight size={17} />
        </button>
      </form>
      <p className="auth-help">For security, reset instructions expire after a limited period.</p>
    </div>
  );
}
