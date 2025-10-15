import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function OwnerLogin(){
  const { login } = useAuth();
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [loading,setLoading]=useState(false);
  const submit=async(e:React.FormEvent)=>{e.preventDefault(); setLoading(true);
    try{ await login(email,password); window.location.href='/owner/auction'; }
    catch{ toast.error('Login failed'); } finally{ setLoading(false); }
  }
  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-b from-primary/5 to-secondary/5">
      <form onSubmit={submit} className="w-full max-w-sm bg-white p-6 rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-4">Team Owner Login</h1>
        <input className="w-full border p-3 rounded mb-3" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-full border p-3 rounded mb-4" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button disabled={loading} className="w-full h-10 rounded bg-primary text-white">{loading?'Signing in…':'Login'}</button>
      </form>
    </main>
  );
}
