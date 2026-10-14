"""
SPL 2026 PPTX Player Extractor
Extracts player photos, names, roles, year of study, base price, and serial numbers
directly from SPL_2026_final-player-list.pptx without any extra dependencies.
Outputs:
  - Images saved to: public/players/<serial>_<name>.<ext>
  - CSV file saved to: spl_players.csv (ready to upload to SPL Auction Dashboard)
"""

import os
import re
import csv
import zipfile
import xml.etree.ElementTree as ET

PPTX_PATH = "SPL_2026_final-player-list.pptx"
OUTPUT_IMG_DIR = os.path.join("public", "players")
OUTPUT_CSV_PATH = "spl_players.csv"

def extract_players_from_pptx():
    if not os.path.exists(PPTX_PATH):
        print(f"[ERROR] Could not find '{PPTX_PATH}' in {os.getcwd()}")
        return

    os.makedirs(OUTPUT_IMG_DIR, exist_ok=True)
    print(f"[INFO] Opening {PPTX_PATH} ...")

    with zipfile.ZipFile(PPTX_PATH, 'r') as z:
        # Find all slide xml files
        slide_files = [f for f in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml', f)]
        # Sort slides by their numeric index (slide1.xml, slide2.xml, ..., slide10.xml)
        slide_files.sort(key=lambda s: int(re.search(r'slide(\d+)\.xml', s).group(1)))

        print(f"[INFO] Found {len(slide_files)} slides in presentation.")

        players_data = []

        for slide_file in slide_files:
            slide_num = int(re.search(r'slide(\d+)\.xml', slide_file).group(1))
            rels_file = f"ppt/slides/_rels/slide{slide_num}.xml.rels"

            # Parse slide XML
            try:
                slide_xml = z.read(slide_file)
                root = ET.fromstring(slide_xml)
            except Exception as e:
                print(f"[WARN] Error reading {slide_file}: {e}")
                continue

            # Extract all text elements in the order they appear
            namespaces = {
                'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
                'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
                'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
            }

            text_runs = []
            for t_elem in root.findall('.//a:t', namespaces):
                t = t_elem.text
                if t and t.strip():
                    text_runs.append(t.strip())

            # Skip title / cover / instruction slides that don't have player info
            full_text = " ".join(text_runs).upper()
            if "PLAYER" not in full_text and "ROLE" not in full_text:
                continue

            # Parse player attributes based on the layout:
            # Layout items:
            # "SPL 2026", "PLAYER PROFILE", "PLAYER", "<Name>", "PLAYER ROLE", "<Role>", "YEAR OF STUDY", "<Year>", "BASE PRICE", "<Price>", "<Serial>"
            name = ""
            role = "All-Rounder"
            year = ""
            base_price = 1000
            serial_no = f"{slide_num:03d}"

            # Helper to search following token
            for i, item in enumerate(text_runs):
                item_upper = item.strip().upper()
                if item_upper == "PLAYER" and i + 1 < len(text_runs):
                    candidate = text_runs[i + 1].strip()
                    if candidate.upper() not in ["ROLE", "PLAYER ROLE", "PROFILE"]:
                        name = candidate
                elif ("ROLE" in item_upper or item_upper == "PLAYER ROLE") and i + 1 < len(text_runs):
                    candidate = text_runs[i + 1].strip()
                    if candidate.upper() not in ["YEAR", "YEAR OF STUDY", "BASE PRICE"]:
                        role = candidate
                elif ("YEAR" in item_upper or item_upper == "YEAR OF STUDY") and i + 1 < len(text_runs):
                    candidate = text_runs[i + 1].strip()
                    if candidate.upper() not in ["BASE PRICE", "PLAYER"]:
                        year = candidate
                elif ("BASE PRICE" in item_upper or "PRICE" in item_upper) and i + 1 < len(text_runs):
                    candidate = text_runs[i + 1].strip().replace("₹", "").replace(",", "")
                    digits = re.findall(r'\d+', candidate)
                    if digits:
                        base_price = int("".join(digits))
                # Check for 3-digit serial number like "003"
                elif re.match(r'^\d{2,4}$', item.strip()):
                    serial_no = item.strip()

            # Fallback if name wasn't detected after 'PLAYER' tag
            if not name:
                filtered_texts = [
                    t for t in text_runs
                    if t.upper() not in [
                        "SPL 2026", "PLAYER PROFILE", "PLAYER", "PLAYER ROLE",
                        "YEAR OF STUDY", "BASE PRICE", "₹1,000", "1,000", "1000"
                    ] and not re.match(r'^\d+$', t)
                ]
                if filtered_texts:
                    name = filtered_texts[0]

            if not name:
                name = f"Player {slide_num}"

            # Clean name for filename
            clean_name = re.sub(r'[^\w\-_]', '_', name)

            # Find player photo relationship in rels
            photo_url = ""
            if rels_file in z.namelist():
                rels_xml = z.read(rels_file)
                rels_root = ET.fromstring(rels_xml)
                image_targets = []
                for rel in rels_root:
                    target = rel.attrib.get('Target', '')
                    rel_type = rel.attrib.get('Type', '')
                    if 'image' in rel_type.lower() or target.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                        image_targets.append(target)

                # Usually the player photo is the largest image or the first non-logo image
                for target in image_targets:
                    # Target path is like ../media/image1.jpeg -> ppt/media/image1.jpeg
                    clean_target = target.replace('../', 'ppt/')
                    if not clean_target.startswith('ppt/'):
                        clean_target = f"ppt/{clean_target}"

                    if clean_target in z.namelist():
                        img_data = z.read(clean_target)
                        # Skip tiny images (like small logos / icons under 8KB)
                        if len(img_data) > 8000:
                            ext = os.path.splitext(clean_target)[1] or '.jpg'
                            out_filename = f"{serial_no}_{clean_name}{ext}"
                            out_path = os.path.join(OUTPUT_IMG_DIR, out_filename)
                            with open(out_path, 'wb') as img_out:
                                img_out.write(img_data)
                            photo_url = f"/players/{out_filename}"
                            break

            # If no large photo was found, try any available image from the slide
            if not photo_url and rels_file in z.namelist():
                for target in image_targets:
                    clean_target = target.replace('../', 'ppt/')
                    if not clean_target.startswith('ppt/'):
                        clean_target = f"ppt/{clean_target}"
                    if clean_target in z.namelist():
                        img_data = z.read(clean_target)
                        ext = os.path.splitext(clean_target)[1] or '.jpg'
                        out_filename = f"{serial_no}_{clean_name}{ext}"
                        out_path = os.path.join(OUTPUT_IMG_DIR, out_filename)
                        with open(out_path, 'wb') as img_out:
                            img_out.write(img_data)
                        photo_url = f"/players/{out_filename}"
                        break

            # Determine Batting / Bowling based on role
            role_clean = role.strip()
            batting_style = "Right Hand"
            bowling_style = "Right Arm Medium"
            if "BOWL" in role_clean.upper():
                batting_style = "Right Hand"
                bowling_style = "Right Arm Fast"
            elif "BAT" in role_clean.upper():
                batting_style = "Right Hand"
                bowling_style = "Right Arm Off-Spin"
            elif "KEEPER" in role_clean.upper() or "WK" in role_clean.upper():
                role_clean = "Wicket-Keeper"
                bowling_style = "N/A (WK)"

            players_data.append({
                "Serial No": serial_no,
                "Name": name,
                "Role": role_clean,
                "Year / Category": year,
                "Batting Style": batting_style,
                "Bowling Style": bowling_style,
                "Base Price": base_price,
                "Photo URL": photo_url
            })

            print(f"[OK] #{serial_no} | {name} | {role_clean} | {year} | Base: ₹{base_price} | Photo: {photo_url}")

        # Write to CSV
        fieldnames = ["Serial No", "Name", "Role", "Year / Category", "Batting Style", "Bowling Style", "Base Price", "Photo URL"]
        with open(OUTPUT_CSV_PATH, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(players_data)

        print(f"\n[SUCCESS] Extracted {len(players_data)} players successfully!")
        print(f"  - Photos saved in: {OUTPUT_IMG_DIR}")
        print(f"  - Player table saved to: {OUTPUT_CSV_PATH}")
        print("  - You can now upload 'spl_players.csv' directly in the Chief Auctioneer Admin Dashboard!")

if __name__ == "__main__":
    extract_players_from_pptx()
