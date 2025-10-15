import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '../services/firebase';

export default function DisplayScreen(){
  const [auction,setAuction]=useState<any>(null);
  const [player,setPlayer]=useState<any>(null);

  useEffect(()=>{
    const offA = onValue(ref(db,'auction'), s=>setAuction(s.val()));
    return ()=>offA();
  },[]);
  useEffect(()=>{
    if(!auction?.currentPlayerId) return;
    return onValue(ref(db,`players/${auction.currentPlayerId}`), s=>setPlayer(s.val()));
  },[auction?.currentPlayerId]);

  if(!auction||!player) return <div className="p-10 text-2xl">Preparing display…</div>;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="h-[10vh] flex items-center justify-between px-8">
        <div className="text-xl font-bold">College Name</div>
        <div className="text-3xl font-extrabold">CRICKET AUCTION 2025</div>
        <div className={`text-2xl ${auction.status==='running'?'text-green-400':'text-yellow-400'}`}>{auction.status.toUpperCase()}</div>
      </header>

      <main className="h-[80vh] grid grid-cols-2 gap-6 px-8">
        <section className="flex flex-col items-center justify-center">
          <img src={player.photoUrl||''} alt={player.name} className="w-80 h-80 rounded-2xl object-cover ring-4 ring-white/20"/>
          <h1 className="mt-4 text-4xl font-black drop-shadow">{player.name}</h1>
          <div className="mt-1 text-xl">{player.role}</div>
        </section>
        <section className="flex flex-col items-center justify-center">
          <div className="text-xl tracking-widest opacity-80">CURRENT BID</div>
          <div className="text-6xl font-mono mt-2">₹ {player.currentBid?.toLocaleString()}</div>
          {/* TODO: Top 3 podium + ticker */}
        </section>
      </main>

      <footer className="h-[10vh] flex items-center px-8 text-lg opacity-90">
        {/* TODO: purse ticker & recent sales */}
        <div>Loading ticker…</div>
      </footer>
    </div>
  );
}
