import { useEffect, useState } from 'react';
import { db } from '../../services/firebase';
import { onValue, ref } from 'firebase/database';
import { startTimer, pauseTimer, markSold } from '../../services/auction.service';
import toast from 'react-hot-toast';

export default function AdminDashboard(){
  const [auction,setAuction]=useState<any>(null);
  const [player,setPlayer]=useState<any>(null);
  const [teams,setTeams]=useState<Record<string,any>>({});

  useEffect(()=>{
    const off1 = onValue(ref(db,'auction'), s=>setAuction(s.val()));
    const off2 = onValue(ref(db,'teams'), s=>setTeams(s.val()||{}));
    return ()=>{ off1(); off2(); };
  },[]);

  useEffect(()=>{
    if(!auction?.currentPlayerId) return;
    return onValue(ref(db,`players/${auction.currentPlayerId}`), s=>setPlayer(s.val()));
  },[auction?.currentPlayerId]);

  if(!auction||!player) return <div className="p-6">Loading dashboard…</div>;

  const nextIndex = (auction.currentPlayerIndex ?? 0) + 1;

  return (
    <div className="min-h-screen grid md:grid-cols-2 gap-6 p-6 bg-bg">
      {/* Left: current player & actions */}
      <div className="space-y-4">
        <div className="bg-white p-5 rounded-xl shadow">
          <div className="flex gap-4 items-center">
            <img src={player.photoUrl||''} alt={player.name} className="w-24 h-24 rounded-full object-cover border"/>
            <div>
              <h2 className="text-2xl font-bold">{player.name}</h2>
              <div className="text-sm text-muted">{player.role}</div>
              <div className="mt-2 text-3xl font-mono">₹ {player.currentBid?.toLocaleString()}</div>
              <div className="text-sm">Leading: {teams[player.currentBidderId!]?.teamName || '-'}</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow grid grid-cols-2 gap-3">
          <button className="h-11 rounded bg-secondary text-white" onClick={()=>startTimer(auction.timerRemaining||30)}>Start Timer</button>
          <button className="h-11 rounded bg-accent text-white" onClick={()=>pauseTimer()}>Pause</button>
          <button className="h-11 rounded bg-danger text-white col-span-2"
            onClick={async()=>{
              const teamName = teams[player.currentBidderId!]?.teamName || 'Unknown';
              const nextId = null; // TODO: compute from your queue
              await markSold({
                playerId: player.id, currentBid: player.currentBid, currentBidderId: player.currentBidderId!,
                playerName: player.name, teamName, nextPlayerId: nextId, nextIndex, timerDuration: 30
              });
              toast.success('Player sold');
            }}>SOLD!</button>
        </div>
      </div>

      {/* Right: quick stats */}
      <div className="space-y-4">
        <div className="bg-white p-5 rounded-xl shadow flex items-center justify-between">
          <div>Status: <span className="font-semibold">{auction.status}</span></div>
          <div>Sold: <span className="font-mono">{auction.soldPlayers}/{auction.totalPlayers}</span></div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow">
          <h3 className="font-semibold mb-3">Teams</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {Object.values(teams).map((t:any)=>(
              <div key={t.id} className="border rounded-lg p-3">
                <div className="font-semibold">{t.teamName}</div>
                <div className="text-sm">Purse: ₹ {t.purseRemaining.toLocaleString()}</div>
                <div className="text-sm">Squad: {t.squadSize}/15</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
