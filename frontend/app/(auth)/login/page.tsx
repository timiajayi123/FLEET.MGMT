'use client';
import { apiMessage, readApiJson } from '@/lib/api-response';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react';
export default function LoginPage(){
 const router=useRouter();const [error,setError]=useState(''),[loading,setLoading]=useState(false);
 useEffect(()=>{const params=new URLSearchParams(window.location.search);if(!params.has('loginError'))return;window.history.replaceState({},'',window.location.pathname);const timer=window.setTimeout(()=>setError('The email address or password is incorrect.'),0);return()=>window.clearTimeout(timer)},[]);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setLoading(true);setError('');const data=Object.fromEntries(new FormData(e.currentTarget));try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const p=await readApiJson<{user?:unknown}>(r,'Sign in failed.');if(!r.ok)throw new Error(apiMessage(p.message,'Sign in failed.'));router.push('/dashboard');router.refresh()}catch(err){setError(err instanceof Error?err.message:'Sign in failed.')}finally{setLoading(false)}}
 return <div className="auth-card"><div className="mobile-auth-brand"><span className="brand-mark">FM</span><strong>NMDPRA Fleet</strong></div><header><span>Secure access</span><h1>Welcome back</h1><p>Sign in with your official NMDPRA account.</p></header><form action="/login-submit" method="post" onSubmit={submit}><label><span>Email address</span><div className="input-with-icon"><Mail size={18}/><input autoComplete="username" name="email" type="email" placeholder="name@nmdpra.gov.ng" required/></div></label><label><span>Password</span><div className="input-with-icon"><LockKeyhole size={18}/><input autoComplete="current-password" name="password" type="password" placeholder="Enter your password" required minLength={8}/></div></label><div className="auth-options"><span/>
 <Link href="/forgot-password">Forgot password?</Link></div>{error&&<p className="alert error">{error}</p>}<button className="auth-submit" disabled={loading}>{loading?'Signing in…':<>Sign in <ArrowRight size={17}/></>}</button></form><p className="auth-help">Access is restricted to authorized personnel. Contact ICT support if you need assistance.</p></div>
}
