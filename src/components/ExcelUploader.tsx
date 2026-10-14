import React, { useState } from 'react';
import { Player } from '../types/player.types';
import { importPlayersToFirestore } from '../services/auction.service';
import { convertGoogleDriveUrl } from '../utils/playerPhotoResolver';
import toast from 'react-hot-toast';
import { Upload, FileSpreadsheet, CheckCircle } from 'lucide-react';

declare global {
  interface Window {
    XLSX?: any;
  }
}

interface Props {
  onSuccess?: (count: number) => void;
}

export default function ExcelUploader({ onSuccess }: Props) {
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewPlayers, setPreviewPlayers] = useState<Player[]>([]);
  const [fileName, setFileName] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.XLSX) {
      toast.error('Excel library is still loading. Please retry in 2 seconds.');
      return;
    }

    setFileName(file.name);
    setParsing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = window.XLSX.read(bstr, { type: 'binary' });

        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];

        const rawRows: Record<string, any>[] = window.XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawRows || rawRows.length === 0) {
          toast.error('The selected Excel sheet has no data rows!');
          setParsing(false);
          return;
        }

        const parsed: Player[] = rawRows.map((row, idx) => {
          const keys = Object.keys(row);

          const findVal = (keywords: string[]) => {
            const match = keys.find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
            return match ? String(row[match]).trim() : '';
          };

          const name = findVal(['name', 'player']) || `Player ${idx + 1}`;
          const role = findVal(['role', 'skill', 'specialization', 'type']) || 'All-Rounder';
          const battingStyle = findVal(['batting', 'bat']) || 'Right Hand';
          const bowlingStyle = findVal(['bowling', 'bowl']) || 'Right Arm';
          const contact = findVal(['mobile', 'phone', 'contact', 'no', 'number']) || '';
          const category = findVal(['year', 'grade', 'group', 'set', 'tier']) || 'Standard';
          const rawPhoto = findVal(['photo', 'image', 'picture', 'pic', 'url']) || null;
          const photoUrl = convertGoogleDriveUrl(rawPhoto);
          const serialNo = findVal(['serial', 'sr', 's.no', 'id', 'sl', 'no']) || (idx + 1);
          const rawBasePrice = findVal(['base', 'price']);
          const basePrice = rawBasePrice ? (parseInt(rawBasePrice.replace(/[^0-9]/g, '')) || 1000) : 1000;

          return {
            id: `spl_${String(idx + 1).padStart(3, '0')}`,
            serialNo,
            name,
            role,
            category,
            battingStyle,
            bowlingStyle,
            contact,
            photoUrl,
            basePrice,
            currentBid: basePrice,
            status: 'waiting',
            auctionOrder: idx + 1,
            createdAt: Date.now()
          };
        });

        setPreviewPlayers(parsed);
        toast.success(`Parsed ${parsed.length} players from Excel!`);
      } catch (err: any) {
        console.error('Failed to parse excel:', err);
        toast.error('Error reading Excel file: ' + err.message);
      } finally {
        setParsing(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleImportToFirebase = async () => {
    if (previewPlayers.length === 0) return;
    setUploading(true);
    try {
      const count = await importPlayersToFirestore(previewPlayers);
      toast.success(`Successfully saved ${count} players to Firebase Firestore!`);
      if (onSuccess) onSuccess(count);
      setPreviewPlayers([]);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to upload players to Firestore: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white border-2 border-[#cfa027]/40 rounded-3xl p-6 shadow-card">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-display font-black text-[#540816] flex items-center gap-2">
            <FileSpreadsheet className="text-[#cfa027] w-6 h-6" />
            Upload SPL 2026 Player List (.xlsx / .csv)
          </h2>
          <p className="text-xs text-[#645d57] mt-1 font-medium">
            Select <strong className="text-[#1c1917] font-mono">SPL-S2_2026-final-player-list.xlsx</strong> from your downloads to populate all 154 players into Firestore.
          </p>
        </div>

        <label className="cursor-pointer bg-[#540816] hover:bg-[#6e0b1f] text-[#ffd700] border border-[#cfa027] font-display font-black text-xs uppercase tracking-wider px-5 py-3 rounded-xl shadow-md flex items-center gap-2 transition active:scale-95">
          <Upload className="w-4 h-4" />
          <span>{parsing ? 'Reading Excel...' : 'Choose Excel File'}</span>
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            className="hidden"
            onChange={handleFileUpload}
            disabled={parsing || uploading}
          />
        </label>
      </div>

      {fileName && (
        <div className="text-xs text-[#1c1917] bg-[#f8f6f0] p-3 rounded-xl border border-[#e5ded1] flex items-center justify-between mb-4">
          <span>Selected File: <strong className="text-[#540816] font-mono">{fileName}</strong></span>
          <span className="font-bold text-emerald-700">{previewPlayers.length} players found</span>
        </div>
      )}

      {/* Preview Table */}
      {previewPlayers.length > 0 && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" /> Ready to Import {previewPlayers.length} Players (Base Opening: ₹1,000)
            </div>
            <button
              onClick={handleImportToFirebase}
              disabled={uploading}
              className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {uploading ? 'Importing to Firestore...' : `Import ${previewPlayers.length} Players Now`}
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto rounded-xl border border-[#e5ded1] bg-white">
            <table className="w-full text-left text-xs text-[#1c1917]">
              <thead className="bg-[#540816] text-[#ffd700] uppercase tracking-wider sticky top-0 border-b border-[#cfa027]">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Player Name</th>
                  <th className="p-2.5">Role</th>
                  <th className="p-2.5">Batting</th>
                  <th className="p-2.5">Bowling</th>
                  <th className="p-2.5">Base Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5ded1]">
                {previewPlayers.slice(0, 15).map((p, i) => (
                  <tr key={p.id} className="hover:bg-[#f8f6f0]">
                    <td className="p-2.5 font-mono font-bold text-[#540816]">{p.serialNo || i + 1}</td>
                    <td className="p-2.5 font-bold text-[#1c1917]">{p.name}</td>
                    <td className="p-2.5">
                      <span className="bg-[#f4efe6] text-[#540816] border border-[#cfa027]/40 px-2 py-0.5 rounded text-[11px] font-bold">
                        {p.role}
                      </span>
                    </td>
                    <td className="p-2.5 text-[#645d57]">{p.battingStyle || '-'}</td>
                    <td className="p-2.5 text-[#645d57]">{p.bowlingStyle || '-'}</td>
                    <td className="p-2.5 font-mono text-emerald-700 font-bold">₹ 1,000</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewPlayers.length > 15 && (
              <div className="p-2.5 text-center text-xs text-[#540816] bg-[#f8f6f0] font-semibold border-t border-[#e5ded1]">
                ... and {previewPlayers.length - 15} more players from Excel
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
