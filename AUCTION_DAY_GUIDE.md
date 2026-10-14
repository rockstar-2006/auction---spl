# SPL Season 2 (2026) - Mega Cricket Auction Guide

---

## 🚀 Quick Access URLs

- **TV / Projector Screen**: `http://localhost:5173/display`
- **Admin Control Room**: `http://localhost:5173/admin/login`
- **Team Manager Mobile Console**: `http://localhost:5173/owner/login`

---

## 🛡️ Admin Login Credentials

- **Email**: `admin@spl.com`
- **Password**: `spl#admin2026`
- *(Or click the "Autofill Default Admin Credentials" button on the admin login page)*

---

## 👥 12 Team Login Credentials

Each team starts with **₹1,00,000** demo purse and a target of **15 players**.

| # | Team Name | Short | Manager Email | Initial Password | Badge |
|---|---|---|---|---|---|
| 1 | **Royal Thunderbolts** | RTB | `thunderbolts@spl.com` | `spl#thunder2026` | ⚡ |
| 2 | **Shadow Warriors** | SHW | `warriors@spl.com` | `spl#warrior2026` | ⚔️ |
| 3 | **Blaze Titans** | BLT | `titans@spl.com` | `spl#titans2026` | 🔥 |
| 4 | **Storm Breakers** | STB | `breakers@spl.com` | `spl#breakers2026` | 🌊 |
| 5 | **Venom Vipers** | VNV | `vipers@spl.com` | `spl#vipers2026` | 🐍 |
| 6 | **Inferno Kings** | IFK | `kings@spl.com` | `spl#kings2026` | 👑 |
| 7 | **Night Raiders** | NTR | `raiders@spl.com` | `spl#raiders2026` | 🌙 |
| 8 | **Iron Panthers** | IRP | `panthers@spl.com` | `spl#panthers2026` | 🐾 |
| 9 | **Crimson Crushers** | CRC | `crushers@spl.com` | `spl#crushers2026` | 🥊 |
| 10 | **Phoenix Strikers** | PHS | `strikers@spl.com` | `spl#strikers2026` | 🦅 |
| 11 | **Desert Wolves** | DSW | `wolves@spl.com` | `spl#wolves2026` | 🐺 |
| 12 | **Thunder Hawks** | THH | `hawks@spl.com` | `spl#hawks2026` | ⚡ |

*(On mobile, team managers can also simply pick their team from the dropdown and type their password)*.

---

## 📋 Auction Day Checklist (5 Minutes Setup)

### Step 1: Start the App
Run your normal dev server:
```bash
npm run dev
```

### Step 2: Initialize Teams
1. Login to **Admin Dashboard** (`/admin/login`).
2. Go to the **"12 Teams"** tab.
3. Click **"Reset All 12 Teams (₹1 Lakh)"** to create all 12 teams in Cloud Firestore with starting purse ₹1,00,000 and 0 players.

### Step 3: Upload the 154-Player Excel Sheet
1. In Admin Dashboard, switch to the **"Players"** tab.
2. Click **"Choose Excel File"** and select:
   `C:\Users\User\Downloads\SPL-S2_2026-final-player-list.xlsx`
3. Inspect the live preview table (names, roles, styles, base price ₹1,000).
4. Click **"Import 154 Players Now"**. All players are saved into Firestore instantly.

### Step 4: Open the TV Display
Open `http://localhost:5173/display` on the laptop connected to the projector/TV and press `F11` for fullscreen mode.

### Step 5: Team Managers Join on Phones
1. Connect mobile phones to the same Wi-Fi network (or host via IP address).
2. Open `http://<YOUR_LAPTOP_IP>:5173/owner/login`.
3. Managers select their team and log in.

### Step 6: Start the Auction!
1. Admin selects the first player from the queue and clicks **"Bring to Auction"**.
2. Teams tap **"BID ₹X"** buttons on their phones.
3. When the highest bid is reached:
   - Admin announces *"Going once..."*, *"Going twice..."*.
   - Admin clicks **"SOLD!"**.
   - Winning team’s purse is automatically deducted.
   - Player is added to their squad.
   - TV plays celebratory fanfare and bursts confetti!
