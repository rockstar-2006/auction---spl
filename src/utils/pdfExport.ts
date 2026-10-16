// ==============================================================================
// SMVITM SPL SEASON 2: OFFICIAL TEAM ROSTER VECTOR PDF EXPORT ENGINE
// Uses jsPDF & AutoTable to generate 100% crisp, vector PDF documents
// Guaranteed ZERO blank pages, perfect tables, sequential 1,2,3... count
// ==============================================================================

import { TeamInfo } from '../data/teamsData';
import { Player } from '../types/player.types';
import { isFemalePlayer } from './playerPhotoResolver';
import { buildTeamDocumentHtml, getTeamSquadPlayers } from './wordExport';

/**
 * Ensures jsPDF and AutoTable plugins are loaded in browser
 */
async function ensureJsPdf(): Promise<boolean> {
  const hasJsPdf = () => {
    const w = window as any;
    return !!(w.jspdf?.jsPDF || w.jsPDF);
  };

  const hasAutoTable = () => {
    const w = window as any;
    const jsPdfClass = w.jspdf?.jsPDF || w.jsPDF;
    return !!(jsPdfClass && jsPdfClass.prototype && jsPdfClass.prototype.autoTable);
  };

  if (hasJsPdf() && hasAutoTable()) {
    return true;
  }

  const loadScript = (src: string) => {
    return new Promise<boolean>((resolve) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  };

  if (!hasJsPdf()) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  }
  if (!hasAutoTable()) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
  }

  return hasJsPdf();
}

/**
 * Downloads an individual team's squad roster directly as a crisp vector PDF (.pdf) file.
 * Built directly with jsPDF AutoTable - completely eliminates canvas / blank page bugs!
 */
export async function downloadTeamSquadPdf(team: TeamInfo, squadPlayers: Player[]): Promise<void> {
  const cleanTeamName = team.name.replace(/\s+/g, '_');
  const fileName = `${cleanTeamName}_SPL2026_Squad.pdf`;

  const ready = await ensureJsPdf();
  const w = window as any;
  const JsPdfClass = w.jspdf?.jsPDF || w.jsPDF;

  if (ready && JsPdfClass) {
    // 1. Initialize A4 Landscape PDF (297mm x 210mm)
    const doc = new JsPdfClass({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const girlsCount = squadPlayers.filter(p => isFemalePlayer(p)).length;
    const boysCount = squadPlayers.length - girlsCount;
    const totalSpent = squadPlayers.reduce((acc, p) => acc + (p.soldPrice || p.currentBid || 0), 0);
    const remainingPurse = team.purseRemaining ?? Math.max(0, 100000 - totalSpent);

    const cleanBadge = (team.shortName || team.badge || '')
      .replace(/http[^\s]+/gi, '')
      .replace(/data:image[^\s]+/gi, '')
      .replace(/[^\w\s-]/gi, '')
      .trim();

    // ================= TOP HEADER BANNER (Maroon & Gold) =================
    doc.setFillColor(84, 8, 22); // Deep Maroon
    doc.rect(10, 8, 277, 21, 'F');

    doc.setDrawColor(207, 160, 39); // Gold accent line
    doc.setLineWidth(0.6);
    doc.line(10, 29, 287, 29);

    // Header Title 1: Institution
    doc.setTextColor(250, 204, 21); // Light Gold
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('SHRI MADHWA VADIRAJA INSTITUTE OF TECHNOLOGY & MANAGEMENT, BANTAKAL', 148.5, 13.5, { align: 'center' });

    // Header Title 2: League
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('SMVITM PREMIER LEAGUE (SPL) — SEASON 2 (2026)', 148.5, 19.5, { align: 'center' });

    // Header Title 3: Subtitle
    doc.setTextColor(254, 240, 138);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('OFFICIAL TEAM SQUAD ROSTER & PLAYER REGISTRATION RECORD', 148.5, 25, { align: 'center' });

    // ================= TEAM SUMMARY & FINANCIAL OVERVIEW CARD =================
    // Outer Box
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.rect(10, 31, 277, 14, 'FD');

    // Sub-bar for team name
    doc.setFillColor(255, 255, 255);
    doc.rect(10, 31, 277, 6.5, 'FD');

    doc.setTextColor(84, 8, 22);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`TEAM: ${team.name.toUpperCase()} ${cleanBadge ? `(${cleanBadge})` : ''}`, 13, 35.5);

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Franchise Manager: ${team.email || 'Official Team'}`, 284, 35.5, { align: 'right' });

    // Financial 4 stats row
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');

    // Labels
    doc.text('STARTING PURSE:', 14, 41.5);
    doc.text('TOTAL SPENT:', 78, 41.5);
    doc.text('REMAINING PURSE:', 145, 41.5);
    doc.text('SQUAD FILLED:', 215, 41.5);

    // Values
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Rs. 1,00,000', 44, 41.5);

    doc.setTextColor(185, 28, 28); // Red for spent
    doc.text(`Rs. ${totalSpent.toLocaleString()}`, 102, 41.5);

    doc.setTextColor(4, 120, 87); // Green for remaining
    doc.text(`Rs. ${remainingPurse.toLocaleString()}`, 177, 41.5);

    doc.setTextColor(84, 8, 22);
    doc.text(`${squadPlayers.length}/15 Players (${girlsCount} Female, ${boysCount} Male)`, 240, 41.5);

    // ================= PLAYERS ROSTER AUTOTABLE =================
    const tableHeaders = [
      ['Sl. No.', 'Player Name', 'Gender', 'Playing Role', 'Category / Year', 'Batting Style', 'Bowling Style', 'Base Price', 'Sold Price', 'USN / Contact']
    ];

    const tableRows = squadPlayers.length > 0
      ? squadPlayers.map((p, idx) => {
          const isGirl = isFemalePlayer(p);
          const cleanContact = (p.contact || '—').replace(/http[^\s]+/gi, '').trim();

          return [
            String(idx + 1),
            p.name,
            isGirl ? 'Female' : 'Male',
            p.role || 'All-Rounder',
            p.category || '4th Year',
            p.battingStyle || 'Right Hand',
            p.bowlingStyle || 'Right Arm',
            `Rs. ${(p.basePrice || 1000).toLocaleString()}`,
            `Rs. ${(p.soldPrice || p.currentBid || 1000).toLocaleString()}`,
            cleanContact
          ];
        })
      : [
          [
            '—',
            'No players recruited yet by this team in the live auction.',
            '—',
            '—',
            '—',
            '—',
            '—',
            '—',
            'Rs. 0',
            '0 / 15'
          ]
        ];

    const tableFoot = [
      [
        '',
        'TOTAL SQUAD RECRUITMENT INVESTMENT:',
        '',
        '',
        '',
        '',
        '',
        '',
        `Rs. ${totalSpent.toLocaleString()}`,
        `${squadPlayers.length} / 15 Filled`
      ]
    ];

    (doc as any).autoTable({
      head: tableHeaders,
      body: tableRows,
      foot: tableFoot,
      startY: 47,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 1.6, bottom: 1.6, left: 1.2, right: 1.2 },
        textColor: [15, 23, 42],
        lineColor: [148, 163, 184],
        lineWidth: 0.2,
        valign: 'middle',
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [84, 8, 22],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center'
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [84, 8, 22],
        fontStyle: 'bold',
        fontSize: 8
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
        1: { halign: 'left', cellWidth: 44, fontStyle: 'bold' },
        2: { halign: 'center', cellWidth: 16 },
        3: { halign: 'left', cellWidth: 26, textColor: [84, 8, 22], fontStyle: 'bold' },
        4: { halign: 'center', cellWidth: 24 },
        5: { halign: 'center', cellWidth: 24 },
        6: { halign: 'center', cellWidth: 24 },
        7: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
        8: { halign: 'right', cellWidth: 32, fontStyle: 'bold', textColor: [4, 120, 87] },
        9: { halign: 'center', cellWidth: 49 }
      },
      margin: { left: 10, right: 10 }
    });

    // ================= SIGNATURES & OFFICIAL VERIFICATION =================
    const finalY = Math.min(185, (doc as any).lastAutoTable.finalY + 10);

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.3);

    // Line 1: Team Captain
    doc.line(25, finalY + 6, 75, finalY + 6);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Team Captain / Owner Signature', 50, finalY + 10, { align: 'center' });
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text(team.name, 50, finalY + 13.5, { align: 'center' });

    // Line 2: Chief Auctioneer
    doc.setDrawColor(15, 23, 42);
    doc.line(123.5, finalY + 6, 173.5, finalY + 6);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Chief Auctioneer Signature', 148.5, finalY + 10, { align: 'center' });
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text('SMVITM Premier League 2026', 148.5, finalY + 13.5, { align: 'center' });

    // Line 3: Governing Council
    doc.setDrawColor(15, 23, 42);
    doc.line(222, finalY + 6, 272, finalY + 6);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Governing Council Verification', 247, finalY + 10, { align: 'center' });
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Sports Department, SMVITM Bantakal', 247, finalY + 13.5, { align: 'center' });

    // Footer timestamp
    const generatedDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(6.5);
    doc.text(`Official SMVITM SPL Season 2 Document • Generated on ${generatedDate}`, 148.5, finalY + 18, { align: 'center' });

    // Save PDF directly to Downloads folder
    doc.save(fileName);
  } else {
    // Fallback: Browser native print window pre-configured for A4 Landscape "Save as PDF"
    printTeamSquadPdf(team, squadPlayers);
  }
}

/**
 * Opens a clean printable window with the official roster for instant Print / Save to PDF
 * Always produces 100% crisp, selectable vector text with zero blank pages
 */
export function printTeamSquadPdf(team: TeamInfo, squadPlayers: Player[]): void {
  const htmlContent = buildTeamDocumentHtml(team, squadPlayers);
  const printWindow = window.open('', '_blank', 'width=1150,height=800');

  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 300);
    };
  }
}

/**
 * Downloads all 12 teams as 12 SEPARATE PDF documents
 * Staggers downloads slightly to allow browser file streams to complete
 */
export async function downloadAllTeamsPdfSeparately(
  teams: TeamInfo[],
  allPlayers: Player[],
  onProgress?: (teamName: string, index: number, total: number) => void
): Promise<void> {
  for (let i = 0; i < teams.length; i++) {
    const t = teams[i];
    const squad = getTeamSquadPlayers(t, allPlayers);

    if (onProgress) {
      onProgress(t.name, i + 1, teams.length);
    }

    await downloadTeamSquadPdf(t, squad);

    // 400ms delay between PDF generations to allow browser file stream to complete
    if (i < teams.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
}
