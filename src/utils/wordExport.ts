// ==============================================================================
// SMVITM SPL SEASON 2: OFFICIAL TEAM ROSTER WORD DOCUMENT (.DOC) EXPORT ENGINE
// Clean, professional tables formatted for Microsoft Word and WPS Office
// NO images, NO logos, NO emojis, NO blue image links, sequential 1,2,3 counts
// ==============================================================================

import { TeamInfo } from '../data/teamsData';
import { Player } from '../types/player.types';
import { isFemalePlayer } from './playerPhotoResolver';

/**
 * Builds the pure inner HTML markup for the team squad roster (for Word, PDF, and Print)
 */
export function buildTeamBodyHtml(team: TeamInfo, squadPlayers: Player[]): string {
  const girlsCount = squadPlayers.filter(p => isFemalePlayer(p)).length;
  const boysCount = squadPlayers.length - girlsCount;
  const totalSpent = squadPlayers.reduce((acc, p) => acc + (p.soldPrice || p.currentBid || 0), 0);
  const remainingPurse = team.purseRemaining ?? Math.max(0, 100000 - totalSpent);

  // Clean short name: strictly text, no emojis or image urls
  const cleanBadge = (team.shortName || team.badge || '')
    .replace(/http[^\s]+/gi, '')
    .replace(/data:image[^\s]+/gi, '')
    .replace(/[^\w\s-]/gi, '')
    .trim();

  let playerRows = '';
  if (squadPlayers.length === 0) {
    playerRows = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 18px; color: #475569; font-style: italic; border: 1px solid #94a3b8;">
          No players currently recruited for this team.
        </td>
      </tr>
    `;
  } else {
    squadPlayers.forEach((p, idx) => {
      const isGirl = isFemalePlayer(p);
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const genderText = isGirl ? 'Female' : 'Male';

      // Clean contact/USN without any link formatting
      const cleanContact = (p.contact || '—').replace(/http[^\s]+/gi, '').trim();

      playerRows += `
        <tr style="background-color: ${rowBg};">
          <td style="text-align: center; font-weight: bold; border: 1px solid #94a3b8; padding: 5px 4px; font-size: 9pt;">
            ${idx + 1}
          </td>
          <td style="border: 1px solid #94a3b8; padding: 5px 8px; font-weight: bold; font-size: 9.5pt; color: #0f172a;">
            ${p.name}
          </td>
          <td style="text-align: center; border: 1px solid #94a3b8; padding: 5px 6px; font-size: 9pt; color: #1e293b;">
            ${genderText}
          </td>
          <td style="border: 1px solid #94a3b8; padding: 5px 6px; font-weight: 600; font-size: 9pt; color: #540816;">
            ${p.role || 'All-Rounder'}
          </td>
          <td style="border: 1px solid #94a3b8; padding: 5px 6px; font-size: 8.5pt; color: #334155; text-align: center;">
            ${p.category || '4th Year'}
          </td>
          <td style="border: 1px solid #94a3b8; padding: 5px 6px; font-size: 8.5pt; color: #334155;">
            ${p.battingStyle || 'Right Hand'}
          </td>
          <td style="border: 1px solid #94a3b8; padding: 5px 6px; font-size: 8.5pt; color: #334155;">
            ${p.bowlingStyle || 'Right Arm'}
          </td>
          <td style="border: 1px solid #94a3b8; padding: 5px 6px; font-weight: bold; color: #475569; text-align: right; font-size: 9pt;">
            Rs. ${(p.basePrice || 1000).toLocaleString()}
          </td>
          <td style="border: 1px solid #94a3b8; padding: 5px 8px; font-weight: 900; color: #047857; text-align: right; font-size: 9.5pt;">
            Rs. ${(p.soldPrice || p.currentBid || 1000).toLocaleString()}
          </td>
          <td style="border: 1px solid #94a3b8; padding: 5px 6px; font-size: 8.5pt; color: #475569; text-align: center;">
            ${cleanContact}
          </td>
        </tr>
      `;
    });
  }

  const generatedDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
  <!-- ================= INSTITUTION HEADER ================= -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 2px solid #540816;">
    <tr>
      <td style="background-color: #540816; color: #ffffff; padding: 10px 14px; text-align: center;">
        <div style="font-size: 10pt; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; color: #facc15;">
          SHRI MADHWA VADIRAJA INSTITUTE OF TECHNOLOGY &amp; MANAGEMENT, BANTAKAL
        </div>
        <div style="font-size: 16pt; font-weight: 900; letter-spacing: 1px; color: #ffffff; margin-top: 2px;">
          SMVITM PREMIER LEAGUE (SPL) — SEASON 2 (2026)
        </div>
        <div style="font-size: 9.5pt; font-weight: bold; color: #fef08a; margin-top: 2px;">
          OFFICIAL TEAM SQUAD ROSTER &amp; PLAYER REGISTRATION RECORD
        </div>
      </td>
    </tr>
  </table>

  <!-- ================= TEAM INFO & FINANCIAL OVERVIEW ================= -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1.5px solid #cbd5e1; background-color: #ffffff;">
    <tr style="background-color: #f1f5f9; border-bottom: 1.5px solid #cbd5e1;">
      <td colspan="4" style="padding: 6px 12px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td>
              <span style="font-size: 13pt; font-weight: 900; color: #540816; letter-spacing: 0.5px;">
                TEAM: ${team.name.toUpperCase()} ${cleanBadge ? `(${cleanBadge})` : ''}
              </span>
            </td>
            <td style="text-align: right; font-size: 9pt; font-weight: bold; color: #334155;">
              Franchise Manager: ${team.email || 'Official Team'}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr style="font-size: 9pt;">
      <td style="padding: 6px 10px; border: 1px solid #e2e8f0; width: 25%; text-align: center;">
        <div style="color: #64748b; font-size: 8pt; text-transform: uppercase; font-weight: bold;">Starting Purse</div>
        <div style="font-size: 10.5pt; font-weight: bold; color: #0f172a;">Rs. 1,00,000</div>
      </td>
      <td style="padding: 6px 10px; border: 1px solid #e2e8f0; width: 25%; text-align: center;">
        <div style="color: #64748b; font-size: 8pt; text-transform: uppercase; font-weight: bold;">Total Spent</div>
        <div style="font-size: 10.5pt; font-weight: bold; color: #b91c1c;">Rs. ${totalSpent.toLocaleString()}</div>
      </td>
      <td style="padding: 6px 10px; border: 1px solid #e2e8f0; width: 25%; text-align: center;">
        <div style="color: #64748b; font-size: 8pt; text-transform: uppercase; font-weight: bold;">Remaining Purse</div>
        <div style="font-size: 11pt; font-weight: 900; color: #047857;">Rs. ${remainingPurse.toLocaleString()}</div>
      </td>
      <td style="padding: 6px 10px; border: 1px solid #e2e8f0; width: 25%; text-align: center;">
        <div style="color: #64748b; font-size: 8pt; text-transform: uppercase; font-weight: bold;">Squad Filled</div>
        <div style="font-size: 10pt; font-weight: bold; color: #540816;">
          ${squadPlayers.length}/15 Players (${girlsCount} Female, ${boysCount} Male)
        </div>
      </td>
    </tr>
  </table>

  <!-- ================= PLAYERS ROSTER TABLE ================= -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; border: 1.5px solid #94a3b8;">
    <thead>
      <tr style="background-color: #540816; color: #ffffff;">
        <th style="border: 1px solid #540816; padding: 6px 4px; width: 45px; text-align: center; font-size: 9pt;">Sl. No.</th>
        <th style="border: 1px solid #540816; padding: 6px 8px; text-align: left; font-size: 9pt;">Player Name</th>
        <th style="border: 1px solid #540816; padding: 6px 6px; width: 70px; text-align: center; font-size: 9pt;">Gender</th>
        <th style="border: 1px solid #540816; padding: 6px 6px; width: 105px; text-align: left; font-size: 9pt;">Playing Role</th>
        <th style="border: 1px solid #540816; padding: 6px 6px; width: 85px; text-align: center; font-size: 9pt;">Category / Year</th>
        <th style="border: 1px solid #540816; padding: 6px 6px; width: 95px; text-align: left; font-size: 9pt;">Batting Style</th>
        <th style="border: 1px solid #540816; padding: 6px 6px; width: 95px; text-align: left; font-size: 9pt;">Bowling Style</th>
        <th style="border: 1px solid #540816; padding: 6px 6px; width: 85px; text-align: right; font-size: 9pt;">Base Price</th>
        <th style="border: 1px solid #540816; padding: 6px 8px; width: 95px; text-align: right; font-size: 9pt;">Sold Price</th>
        <th style="border: 1px solid #540816; padding: 6px 6px; width: 95px; text-align: center; font-size: 9pt;">USN / Contact</th>
      </tr>
    </thead>
    <tbody>
      ${playerRows}
    </tbody>
    <tfoot>
      <tr style="background-color: #f1f5f9; font-weight: bold;">
        <td colspan="8" style="border: 1px solid #94a3b8; padding: 6px 8px; text-align: right; font-size: 9pt; color: #540816;">
          TOTAL SQUAD RECRUITMENT INVESTMENT:
        </td>
        <td style="border: 1px solid #94a3b8; padding: 6px 8px; text-align: right; font-size: 10pt; color: #047857; font-weight: 900;">
          Rs. ${totalSpent.toLocaleString()}
        </td>
        <td style="border: 1px solid #94a3b8; padding: 6px 6px; text-align: center; font-size: 8.5pt; color: #475569;">
          ${squadPlayers.length} / 15 Players
        </td>
      </tr>
    </tfoot>
  </table>

  <!-- ================= SIGNATURES & OFFICIAL VERIFICATION ================= -->
  <table style="width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 8.5pt;">
    <tr>
      <td style="width: 33%; text-align: center; vertical-align: bottom; padding: 4px 10px;">
        <div style="border-top: 1.5px solid #0f172a; width: 85%; margin: 24px auto 3px auto; padding-top: 3px; font-weight: bold; color: #0f172a;">
          Team Captain / Owner Signature
        </div>
        <div style="font-size: 8pt; color: #64748b;">${team.name}</div>
      </td>
      <td style="width: 33%; text-align: center; vertical-align: bottom; padding: 4px 10px;">
        <div style="border-top: 1.5px solid #0f172a; width: 85%; margin: 24px auto 3px auto; padding-top: 3px; font-weight: bold; color: #0f172a;">
          Chief Auctioneer Signature
        </div>
        <div style="font-size: 8pt; color: #64748b;">SMVITM Premier League 2026</div>
      </td>
      <td style="width: 33%; text-align: center; vertical-align: bottom; padding: 4px 10px;">
        <div style="border-top: 1.5px solid #0f172a; width: 85%; margin: 24px auto 3px auto; padding-top: 3px; font-weight: bold; color: #0f172a;">
          Governing Council Verification
        </div>
        <div style="font-size: 8pt; color: #64748b;">Sports Department, SMVITM Bantakal</div>
      </td>
    </tr>
    <tr>
      <td colspan="3" style="text-align: center; font-size: 7.5pt; color: #94a3b8; padding-top: 8px;">
        Official SMVITM SPL Season 2 Document • Generated on ${generatedDate}
      </td>
    </tr>
  </table>
  `;
}

/**
 * Builds the complete standalone HTML string for a single team's squad roster.
 */
export function buildTeamDocumentHtml(team: TeamInfo, squadPlayers: Player[]): string {
  const bodyHtml = buildTeamBodyHtml(team, squadPlayers);

  return `<html xmlns:v="urn:schemas-microsoft-com:vml"
xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns:m="http://schemas.microsoft.com/office/2004/12/omml"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Microsoft Word 15">
<meta name="Originator" content="Microsoft Word 15">
<title>${team.name} - Squad Roster</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
@page {
  size: 297mm 210mm; /* A4 Landscape */
  margin: 10mm 12mm 10mm 12mm;
  mso-header-margin: 8mm;
  mso-footer-margin: 8mm;
}
body {
  font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
  color: #0f172a;
  background-color: #ffffff;
  margin: 0;
  padding: 0;
}
table {
  border-collapse: collapse;
  mso-table-lspace: 0pt;
  mso-table-rspace: 0pt;
}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

/**
 * Downloads a single team's squad roster as an individual Word Document (.doc)
 */
export function downloadTeamSquadWordDoc(team: TeamInfo, squadPlayers: Player[]): void {
  const htmlContent = buildTeamDocumentHtml(team, squadPlayers);
  // Prepend UTF-8 Byte Order Mark (\ufeff) to prevent "corrupted file" errors in Word/WPS
  const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword;charset=utf-8' });
  const cleanTeamName = team.name.replace(/\s+/g, '_');
  const fileName = `${cleanTeamName}_SPL2026_Squad.doc`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/**
 * Robustly matches players belonging to a team across Firestore and Supabase:
 * Checks direct playerIds array, soldToTeamId, and soldToTeamName (case-insensitive)
 */
export function getTeamSquadPlayers(team: TeamInfo, allPlayers: Player[]): Player[] {
  if (!team || !allPlayers) return [];

  const teamIdLower = (team.id || '').toLowerCase().trim();
  const teamNameLower = (team.name || '').toLowerCase().trim();
  const teamShortLower = (team.shortName || '').toLowerCase().trim();
  const playerIdsSet = new Set(team.playerIds || []);

  return allPlayers.filter(p => {
    // 1. Direct ID match in team's playerIds array
    if (playerIdsSet.has(p.id)) return true;

    // 2. soldToTeamId match
    if (p.soldToTeamId) {
      const pidLower = p.soldToTeamId.toLowerCase().trim();
      if (pidLower === teamIdLower) return true;
    }

    // 3. soldToTeamName match
    if (p.soldToTeamName) {
      const pnameLower = p.soldToTeamName.toLowerCase().trim();
      if (pnameLower === teamNameLower || pnameLower === teamShortLower) return true;
    }

    return false;
  });
}

/**
 * Downloads all 12 teams as 12 SEPARATE Word documents (not merged into one file).
 * Staggers downloads slightly to prevent browser blocking.
 */
export async function downloadAllTeamsSeparately(
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
    
    downloadTeamSquadWordDoc(t, squad);
    
    // 350ms delay between file downloads to ensure browser registers each individual file download
    if (i < teams.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 350));
    }
  }
}

// Backward compatibility alias: downloads separate files
export const downloadAllTeamsWordDoc = downloadAllTeamsSeparately;
