import splBanner from '../../image.png';

export default function SPLHeader({ subtitle = "LIVE BIDDING CONSOLE" }: { subtitle?: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Official SMVITM & SPL Crest Banner */}
      <div className="relative mb-3 group">
        <div className="absolute -inset-1.5 bg-gradient-to-r from-[#d4af37] via-[#ffd700] to-[#d4af37] rounded-2xl blur-md opacity-40 group-hover:opacity-75 transition duration-500"></div>
        <img
          src={splBanner}
          alt="SMVITM SPL Season 2 Auction Event"
          className="relative w-72 sm:w-84 md:w-96 rounded-xl shadow-lg border border-[#cfa027]/40 object-contain bg-white"
        />
      </div>

      <div className="mt-1 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#540816]">
        <span className="w-8 h-[1px] bg-gradient-to-r from-transparent to-[#cfa027]"></span>
        <span>{subtitle}</span>
        <span className="w-8 h-[1px] bg-gradient-to-l from-transparent to-[#cfa027]"></span>
      </div>
      <div className="text-[10px] text-[#645d57] font-semibold tracking-wider mt-0.5">
        ONE LEAGUE • ONE TEAM • ONE FAMILY
      </div>
    </div>
  );
}
