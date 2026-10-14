// Comprehensive Player Photo Resolver & Mapping for SMVITM SPL Season 2
import { db } from '../services/firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { Player } from '../types/player.types';
import { mirrorPlayersBatch } from '../services/supabaseMirror.service';

// Map of Serial No and Normalized Player Name to public photo asset
export const PLAYER_PHOTO_MAP: Record<string, string> = {
  "003": "/players/003_Swaroop_M_S.png",
  "004": "/players/004_Guruganesh_N_Bhat.png",
  "005": "/players/005_Sathvik_S_Naik.png",
  "006": "/players/006_Mithul_Byndoor.png",
  "008": "/players/008_SUMAN_K_S.png",
  "009": "/players/009_Gautham_G_Prabhu.png",
  "010": "/players/010_Vedanth.png",
  "012": "/players/012_Sampath_nayak.png",
  "013": "/players/013_Shashank_udupa.png",
  "014": "/players/014_Chetan_nayak.png",
  "015": "/players/015_Akash.png",
  "016": "/players/016_Raviteja.png",
  "017": "/players/017_Rakshith_kulal.png",
  "018": "/players/018_ANUSH.png",
  "019": "/players/019_Vinayaka_Pai.png",
  "020": "/players/020_Manvith_v_shetty.png",
  "021": "/players/021_S_Adish_Kumar.png",
  "022": "/players/022_Mohammad_Naimuddin.png",
  "026": "/players/026_Yash_Shetty.png",
  "027": "/players/027_Shreyas_S_Bhat.png",
  "028": "/players/028_Tirumala_M_Naik.png",
  "029": "/players/029_Aryan_Y.png",
  "030": "/players/030_Rahul.png",
  "031": "/players/031_Pavan_H.png",
  "032": "/players/032_Ranganath_Reddy.png",
  "033": "/players/033_Adithya_G_Acharya.png",
  "034": "/players/034_Vineeth_G_Acharya.png",
  "035": "/players/035_Mohammed_Adnan.png",
  "036": "/players/036_Raju_hanamantappa_bennur.png",
  "037": "/players/037_Viraj.png",
  "038": "/players/038_Prashul_V_poojary.png",
  "039": "/players/039_Preethish_Dsouza.png",
  "040": "/players/040_Manish_Bhandary.png",
  "041": "/players/041_Ankit_choudary.png",
  "042": "/players/042_Rohan.png",
  "043": "/players/043_Abhinandan_A_Walvekar.png",
  "044": "/players/044_Sathwik_acharya.png",
  "045": "/players/045_Jambanna.png",
  "046": "/players/046_Srajan.png",
  "047": "/players/047_Shravan.png",
  "048": "/players/048_RANJAN_SHETTY.png",
  "049": "/players/049_Shodhan.png",
  "050": "/players/050_Sagar_B_Achar.png",
  "051": "/players/051_Mohammad_Raiz.png",
  "052": "/players/052_Huzaif.png",
  "053": "/players/053_Nithesh_kg.png",
  "054": "/players/054_Shreyas_S_Acharya.png",
  "055": "/players/055_Amogh_Naik.png",
  "057": "/players/057_Vighneshwara.png",
  "058": "/players/058_Vishal_R.png",
  "059": "/players/059_Shivaraja_s_k.png",
  "060": "/players/060_Harsha_Shetty.png",
  "061": "/players/061_Sathwik_C_Shetty.png",
  "062": "/players/062_Rijesh_s.png",
  "063": "/players/063_Rohan_mendon.png",
  "064": "/players/064_Adarsh.png",
  "065": "/players/065_Avinash_M.png",
  "066": "/players/066_Mohammad_yaseen.png",
  "068": "/players/068_Akhilesh.png",
  "069": "/players/069_Sagar.png",
  "070": "/players/070_Sathwik_b.png",
  "071": "/players/071_Pritam_shetty.png",
  "072": "/players/072_Akash_SM.png",
  "073": "/players/073_Prajwal_Amin.png",
  "074": "/players/074_Dhanush_S_Poojary.png",
  "075": "/players/075_P_SATHWIK_SHENOY.png",
  "076": "/players/076_Sagar_U_Suvarna.png",
  "077": "/players/077_Harshavardhan.png",
  "079": "/players/079_Sumesh_U_Puthran.png",
  "080": "/players/080_ATHMA.png",
  "081": "/players/081_Samarth_k_b.png",
  "082": "/players/082_Raju_Rathod.png",
  "083": "/players/083_Thanmay_U_Rao.png",
  "084": "/players/084_Arjun_P_Upadhya.png",
  "085": "/players/085_Preethish_shetty.png",
  "086": "/players/086_MOHAMMED_AFREED.png",
  "087": "/players/087_Ayush.png",
  "088": "/players/088_Nithesh_kanchan.png",
  "089": "/players/089_Mohammed_suhan.png",
  "090": "/players/090_Vaibhava_G.png",
  "091": "/players/091_Adarsh_G_Acharya.png",
  "092": "/players/092_Krishna.png",
  "093": "/players/093_Vishwesh_Devadiga.png",
  "094": "/players/094_Vaibhav_G_Acharya.png",
  "095": "/players/095_Milanraj.png",
  "096": "/players/096_Prakyath_P_Shetty.png",
  "097": "/players/097_Adithya__Poojary.png",
  "098": "/players/098_Pavan_Kumar_Karanth.png",
  "100": "/players/100_Manvith_M_S.png",
  "101": "/players/101_Vaibhav_Venkatesh_Kudtarkar.png",
  "102": "/players/102_Chandu_gp.png",
  "103": "/players/103_Shreyas_n_acharya.png",
  "104": "/players/104_Goutham_Shetty.png",
  "105": "/players/105_Poojith_s_Bhandary.png",
  "106": "/players/106_Abhishek_KN.png",
  "107": "/players/107_Dheeraj_Kumar_A_Hegde.png",
  "108": "/players/108_Dhanvish_Ravindra_shetty.png",
  "109": "/players/109_SHISHIR_RAMAMOORTHI.png",
  "110": "/players/110_Sathyendra_Bhat.png",
  "111": "/players/111_ARJUN_POOJARI_MADAVU.png",
  "112": "/players/112_Bharath_Kulal.png",
  "113": "/players/113_Narasimha_Khasnis.png",
  "114": "/players/114_Deepak.png",
  "115": "/players/115_Aditya_Thunga_K.png",
  "116": "/players/116_Goudappa.png",
  "117": "/players/117_Keerthan.png",
  "118": "/players/118_Srajan.png",
  "119": "/players/119_Nishanth_shetty.png",
  "120": "/players/120_Pranav_L_Kamath.png",
  "123": "/players/123_Nikhil_reddy.png",
  "124": "/players/124_Uthsav_n_shetty.png",
  "125": "/players/125_Shloag_Bant.png",
  "126": "/players/126_Shawn_Salis.png",
  "127": "/players/127_ROJAN_ACHARYA.png",
  "128": "/players/128_Shrisha_H_Hebbar.png",
  "129": "/players/129_A_Krishna_Bhat.png",
  "130": "/players/130_Gowtham.png",
  "131": "/players/131_Darshan.png",
  "132": "/players/132_Pavan_KB.png",
  "133": "/players/133_TANUSH_M.png",
  "134": "/players/134_Shivaraj.png",
  "135": "/players/135_Gourish_moger.png",
  "136": "/players/136_Shravan.png",
  "137": "/players/137_Shramanth_G_Shetty.png",
  "138": "/players/138_Hatshith_kumar.png",
  "139": "/players/139_Shreyas_Bhat.png",
  "140": "/players/140_Pavan_MG.png",
  "141": "/players/141_Prasanna.png",
  "142": "/players/142_Adithya.png",
  "143": "/players/143_Mohammed_hannan.png",
  "144": "/players/144_Nandan_k.png",
  "145": "/players/145_Rolson_lobo.png",
  "146": "/players/146_Sharan_S_H.png",
  "147": "/players/147_Agastya_Sharad_shetty.png",
  "148": "/players/148_Adarsha.png",
  "149": "/players/149_Swasthik_h_poojary.png"
};

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converts problematic Google Drive shareable URLs into direct, CORS-friendly image embeds
 */
export function convertGoogleDriveUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed.includes('drive.google.com')) {
    const match = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                  trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
  }
  return trimmed;
}

// 15 Female Player Distinctive Keynames (100% mutually exclusive from all boys)
export const FEMALE_DISTINCTIVE_MAP: Record<string, string> = {
  // 1. Medhaa D
  "medhaa": "/8d7d548f-a9e9-4166-a899-4d63e9039703 - MEDHAA D.jpeg",
  "medha": "/8d7d548f-a9e9-4166-a899-4d63e9039703 - MEDHAA D.jpeg",

  // 2. Sameeksha N Palan
  "sameeksha": "/20261011_151734 - SAMEEKSHA N PALAN (1).jpg",
  "samiksha": "/20261011_151734 - SAMEEKSHA N PALAN (1).jpg",

  // 3. Rakshitha R Nayak (strictly distinct from boy Rakshith)
  "rakshitha": "/1000018825_1_11zon - RAKSHITHA R NAYAK.jpg",

  // 4. Ananya Bhat
  "ananya": "/Ananya Bhat.jpg",

  // 5. Deekshitha N Naik
  "deekshitha": "/Deekshitha N Naik.jpg",
  "dikshitha": "/Deekshitha N Naik.jpg",

  // 6. Anushree P Tantry (strictly distinct from boy Anush)
  "anushree": "/IMG_20260904_204536 - ANUSHREE P TANTRY.jpg",

  // 7. Sinchana Sinchana
  "sinchana": "/IMG_20261011_150016 - SINCHANA SINCHANA.jpg",

  // 8. Chirashree Chirashree
  "chirashree": "/IMG-20250324-WA0003 - CHIRASHREE CHIRASHREE.jpg",

  // 9. Sanjana Desai
  "sanjana": "/IMG-20261007-WA0007 - SANJANA DESAI.jpg",

  // 10. Sukruti Jadhav
  "sukruti": "/IMG-20261011-WA0057 - SUKRUTI JADHAV.jpg",
  "sukruthi": "/IMG-20261011-WA0057 - SUKRUTI JADHAV.jpg",

  // 11. Varshashree B K
  "varshashree": "/InShot_20261011_175822174 - VARSHASHREE B K.jpg",
  "varsha": "/InShot_20261011_175822174 - VARSHASHREE B K.jpg",

  // 12. Samana G Rao (strictly distinct from boy Samarth)
  "samana": "/Samana G Rao.jpg",

  // 13. Rajiya Begam Surkod (strictly distinct from boy Raju)
  "rajiya": "/rajiya_pic - RAJIYA BEGAM SURKOD.jpeg",
  "raziya": "/rajiya_pic - RAJIYA BEGAM SURKOD.jpeg",

  // 14. Riya D Souza / Riya Dsouza (strictly distinct from boy Rijesh)
  "riya": "/Screenshot_20261011-151846~2 - RIYA D SOUZA.jpg",

  // 15. Pranali Mahadev Jankar / Pranali M Jankar (strictly distinct from boy Prajwal)
  "pranali": "/Snapchat-1477308136 - PRANALI M JANKAR.jpg"
};

// 15 Female Player Photos provided by user from public directory
export const FEMALE_PLAYER_PHOTO_MAP: Record<string, string> = {
  ...FEMALE_DISTINCTIVE_MAP,
  // 1. Medhaa D
  "medhaa d": "/8d7d548f-a9e9-4166-a899-4d63e9039703 - MEDHAA D.jpeg",

  // 2. Sameeksha N Palan
  "sameeksha n palan": "/20261011_151734 - SAMEEKSHA N PALAN (1).jpg",
  "sameeksha palan": "/20261011_151734 - SAMEEKSHA N PALAN (1).jpg",

  // 3. Rakshitha R Nayak
  "rakshitha r nayak": "/1000018825_1_11zon - RAKSHITHA R NAYAK.jpg",
  "rakshitha nayak": "/1000018825_1_11zon - RAKSHITHA R NAYAK.jpg",

  // 4. Ananya Bhat
  "ananya bhat": "/Ananya Bhat.jpg",

  // 5. Deekshitha N Naik
  "deekshitha n naik": "/Deekshitha N Naik.jpg",
  "deekshitha naik": "/Deekshitha N Naik.jpg",

  // 6. Anushree P Tantry
  "anushree p tantry": "/IMG_20260904_204536 - ANUSHREE P TANTRY.jpg",
  "anushree tantry": "/IMG_20260904_204536 - ANUSHREE P TANTRY.jpg",

  // 7. Sinchana Sinchana
  "sinchana sinchana": "/IMG_20261011_150016 - SINCHANA SINCHANA.jpg",

  // 8. Chirashree Chirashree
  "chirashree chirashree": "/IMG-20250324-WA0003 - CHIRASHREE CHIRASHREE.jpg",

  // 9. Sanjana Desai
  "sanjana desai": "/IMG-20261007-WA0007 - SANJANA DESAI.jpg",

  // 10. Sukruti Jadhav
  "sukruti jadhav": "/IMG-20261011-WA0057 - SUKRUTI JADHAV.jpg",

  // 11. Varshashree B K
  "varshashree b k": "/InShot_20261011_175822174 - VARSHASHREE B K.jpg",
  "varshashree bk": "/InShot_20261011_175822174 - VARSHASHREE B K.jpg",

  // 12. Samana G Rao
  "samana g rao": "/Samana G Rao.jpg",
  "samana rao": "/Samana G Rao.jpg",

  // 13. Rajiya Begam Surkod
  "rajiya begam surkod": "/rajiya_pic - RAJIYA BEGAM SURKOD.jpeg",
  "rajiya begam": "/rajiya_pic - RAJIYA BEGAM SURKOD.jpeg",

  // 14. Riya D Souza (supports both "Riya Dsouza" and "Riya D Souza")
  "riya d souza": "/Screenshot_20261011-151846~2 - RIYA D SOUZA.jpg",
  "riya dsouza": "/Screenshot_20261011-151846~2 - RIYA D SOUZA.jpg",
  "riya d'souza": "/Screenshot_20261011-151846~2 - RIYA D SOUZA.jpg",

  // 15. Pranali Mahadev Jankar (supports both "Pranali Mahadev Jankar" and "Pranali M Jankar")
  "pranali mahadev jankar": "/Snapchat-1477308136 - PRANALI M JANKAR.jpg",
  "pranali m jankar": "/Snapchat-1477308136 - PRANALI M JANKAR.jpg",
  "pranali jankar": "/Snapchat-1477308136 - PRANALI M JANKAR.jpg"
};

export function isFemalePlayer(player?: { name?: string; gender?: string } | null): boolean {
  if (!player) return false;
  if (player.gender === 'female') return true;
  if (player.gender === 'male') return false;
  if (!player.name) return false;
  const norm = normalizeString(player.name);
  const tokens = norm.split(' ');
  // Check exact full string match or any distinct female token (e.g. "pranali", "riya", etc.)
  return (
    tokens.some(t => Boolean(FEMALE_DISTINCTIVE_MAP[t])) ||
    Object.keys(FEMALE_PLAYER_PHOTO_MAP).some(fn => norm === fn)
  );
}

// Name-based mapping as primary intelligent key for boys (from PPT local collection)
const NAME_PHOTO_MAP: Record<string, string> = {};
Object.entries(PLAYER_PHOTO_MAP).forEach(([_, path]) => {
  const filename = path.replace('/players/', '').replace(/\.png$/i, '');
  // Format: 004_Guruganesh_N_Bhat -> clean name: guruganesh n bhat
  const cleanName = filename.replace(/^\d+_/, '').replace(/_/g, ' ');
  const normKey = normalizeString(cleanName);
  NAME_PHOTO_MAP[normKey] = path;
});

/**
 * Intelligent photo resolver:
 * 0. ABSOLUTE TOP PRIORITY: Explicitly uploaded custom image (Data URI or Blob) ALWAYS wins!
 * 1. Matches the 15 Female Players first to their exact user-provided photos in /public/
 * 2. Checks if photoUrl is ALREADY a valid female public asset
 * 3. PRIMARY FOR BOYS: Resolves from 138-player local archive by exact & fuzzy normalized name
 * 4. Checks serial number / auction order in PLAYER_PHOTO_MAP (only for boys)
 * 5. Only falls back to external HTTP URL if no local photo exists
 */
export function resolvePlayerPhoto(player?: {
  photoUrl?: string | null;
  serialNo?: any;
  auctionOrder?: any;
  name?: string;
  gender?: string;
} | null): string | null {
  if (!player) return null;

  // 0. ABSOLUTE TOP PRIORITY: User uploaded custom photo (Data URI / Blob)
  if (player.photoUrl && typeof player.photoUrl === 'string') {
    const trimmed = player.photoUrl.trim();
    if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) {
      return trimmed;
    }
  }

  // 1. TOP PRIORITY: 15 Female Players (matches exact user-provided photos in /public/)
  if (player.name) {
    const norm = normalizeString(player.name);
    const tokens = norm.split(' ');
    for (const token of tokens) {
      if (FEMALE_DISTINCTIVE_MAP[token]) {
        return FEMALE_DISTINCTIVE_MAP[token];
      }
    }
    for (const [key, path] of Object.entries(FEMALE_PLAYER_PHOTO_MAP)) {
      if (norm === key) {
        return path;
      }
    }
  }

  // 2. If photoUrl is ALREADY a valid female public asset or non-players asset, return immediately
  if (player.photoUrl && typeof player.photoUrl === 'string') {
    const trimmed = player.photoUrl.trim();
    if (trimmed.startsWith('/') && !trimmed.startsWith('/players/')) {
      return trimmed;
    }
  }

  // If this player is a female, don't fall back to male /players/ PPT photos
  if (isFemalePlayer(player)) {
    return null;
  }

  // 3. If photoUrl is ALREADY a valid local /players/ path, return
  if (player.photoUrl && typeof player.photoUrl === 'string') {
    const trimmed = player.photoUrl.trim();
    if (trimmed.startsWith('/players/')) {
      return trimmed;
    }
  }

  // 4. Name Lookup against local 138-player collection
  if (player.name) {
    const norm = normalizeString(player.name);
    if (norm) {
      // Direct exact match
      if (NAME_PHOTO_MAP[norm]) return NAME_PHOTO_MAP[norm];

      // Substring match (requires min 4 chars and word boundaries)
      for (const [key, path] of Object.entries(NAME_PHOTO_MAP)) {
        if (norm.length >= 4 && (key === norm || key.split(' ').includes(norm))) {
          return path;
        }
      }

      // Token match: check if key tokens match (e.g. "guruganesh" and "bhat")
      const normTokens = norm.split(' ').filter(t => t.length >= 3);
      if (normTokens.length > 0) {
        for (const [key, path] of Object.entries(NAME_PHOTO_MAP)) {
          const matchesAll = normTokens.every(t => key.includes(t));
          if (matchesAll) return path;
        }
      }
    }
  }

  // 5. Try Serial Number or Auction Order Lookup in PLAYER_PHOTO_MAP (only for boys)
  const srCandidates = [player.serialNo, player.auctionOrder].filter(Boolean);
  for (const sr of srCandidates) {
    const rawSr = String(sr).trim();
    const padSr = rawSr.padStart(3, '0');
    if (PLAYER_PHOTO_MAP[padSr]) return PLAYER_PHOTO_MAP[padSr];
    if (PLAYER_PHOTO_MAP[rawSr]) return PLAYER_PHOTO_MAP[rawSr];
  }

  // 6. Fallback to external photoUrl (auto-converting Google Drive links if any were pasted)
  if (player.photoUrl && typeof player.photoUrl === 'string') {
    const trimmed = player.photoUrl.trim();
    if (trimmed.startsWith('http')) {
      return convertGoogleDriveUrl(trimmed) || trimmed;
    }
  }

  return null;
}

/**
 * Syncs all player photo URLs and gender tags to Firestore in chunks
 */
export async function syncAllPlayerPhotosToFirestore(players: Player[]): Promise<number> {
  const chunkSize = 400;
  let updatedCount = 0;

  for (let i = 0; i < players.length; i += chunkSize) {
    const chunk = players.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    let chunkCount = 0;

    chunk.forEach((p, idx) => {
      const resolved = resolvePlayerPhoto(p);
      const isFemale = isFemalePlayer(p);
      const targetId = p.id || `spl_${String(i + idx + 1).padStart(3, '0')}`;
      if (targetId) {
        const ref = doc(db, 'players', targetId);
        const updates: any = {};
        if (resolved && p.photoUrl !== resolved) {
          updates.photoUrl = resolved;
        }
        if (p.gender !== (isFemale ? 'female' : 'male')) {
          updates.gender = isFemale ? 'female' : 'male';
        }
        if (Object.keys(updates).length > 0) {
          batch.update(ref, updates);
          chunkCount++;
        }
      }
    });

    if (chunkCount > 0) {
      await batch.commit();
      updatedCount += chunkCount;
    }
  }

  // Mirror updated photos & gender tags to Supabase
  mirrorPlayersBatch(players).catch(() => {});

  return updatedCount;
}


