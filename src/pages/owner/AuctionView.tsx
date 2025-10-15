import { useEffect, useState } from 'react';
import { db } from '../../services/firebase';
import { onValue, ref } from 'firebase/database';
import { placeBid } from '../../services/auction.service';
import toast from 'react-hot-toast';

export default function AuctionView(){
  const [auction,setAuction]=useState<any>(null);
  const [player,setPlayer]=useState<any>(null);
  const [team,setTeam]=useState<any>(null); // TODO: derive from logged-in user

  useEffect(()=>{
    const offA = onValue(ref(db,'auction'), s=>setAuction(s.val()));
    const offT = onValue(ref(db,'teams/team_xxx'), s=>setTeam(s.val())); // wire to your teamId
    return ()=>{offA(); offT();}
  },[]);
  useEffect(()=>{
    if(!auction?.currentPlayerId) return;
    return onValue(ref(db,`players/${auction.currentPlayerId}`), s=>setPlayer(s.val()));
  },[auction?.currentPlayerId]);

  if(!auction||!player||!team) return <div className="p-4">Loading…</div>;

  const nextAmount = (player.currentBid||player.basePrice) + 1000;
  const canBid = auction.status==='running' && auction.timerRemaining>0 &&
    team.purseRemaining >= nextAmount && team.squadSize < 15 && nextAmount <= 36000 && player.status==='bidding';

  return (
    <main className="min-h-screen bg-bg pb-24">
      <header className="sticky top-0 bg-white p-4 shadow flex justify-between">
        <div className="font-bold">{team.teamName}</div>
        <div className="font-mono">Purse: ₹ {team.purseRemaining.toLocaleString()}</div>
        <div className="font-mono">Squad: {team.squadSize}/15</div>
      </header>

      <section className="p-4 text-center">
        <img src={player.photoUrl||''} alt={player.name} className="w-40 h-40 rounded-full object-cover mx-auto border"/>
        <h1 className="text-2xl font-bold mt-3">{player.name}</h1>
        <div className="text-muted">{player.role}</div>
        <div className="mt-2 text-4xl font-mono">₹ {player.currentBid?.toLocaleString()}</div>
      </section>

      <button
        disabled={!canBid}
        onClick={async()=>{
          try{
            await placeBid(player.id, team.id, team.teamName, nextAmount);
            toast.success('Bid placed!');
          }catch{ toast.error('Bid failed'); }
        }}
        className={`fixed bottom-4 left-4 right-4 h-14 rounded-xl text-white font-semibold
          ${canBid?'bg-primary':'bg-muted cursor-not-allowed'}`}>
        {canBid ? `BID ₹ ${nextAmount.toLocaleString()}` : 'Bidding Closed / Not Eligible'}
      </button>
    </main>
  );
}
