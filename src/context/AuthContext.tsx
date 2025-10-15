import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, type User } from 'firebase/auth';
import { auth } from '../services/firebase';

type Ctx = { user: User|null; loading: boolean; login:(e:string,p:string)=>Promise<void>; logout:()=>Promise<void> };
const AuthContext = createContext<Ctx>({user:null,loading:true,login:async()=>{},logout:async()=>{}});
export const useAuth = ()=>useContext(AuthContext);

export function AuthProvider({children}:{children:React.ReactNode}) {
  const [user,setUser]=useState<User|null>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>onAuthStateChanged(auth, u=>{setUser(u); setLoading(false)}),[]);
  const login = (email:string, password:string)=>signInWithEmailAndPassword(auth,email,password).then(()=>{});
  const logout = ()=>signOut(auth);
  return <AuthContext.Provider value={{user,loading,login,logout}}>{children}</AuthContext.Provider>
}
