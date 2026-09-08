import os
import sys
import json
import re
import time
import requests
from concurrent.futures import ThreadPoolExecutor
from gdown.download_folder import _parse_embedded_folder_view

print("--- Starting Blue Archive Asset Catalog Builder ---")

# 1. Load background items from /tmp/gdrive_bg_items.json
with open('/tmp/gdrive_bg_items.json', 'r', encoding='utf-8') as f:
    bg_raw_items = json.load(f)

print(f"Loaded {len(bg_raw_items)} raw backgrounds.")

# 2. Load character folder items from /tmp/gdrive_ch_items.json
with open('/tmp/gdrive_ch_items.json', 'r', encoding='utf-8') as f:
    ch_raw_folders = json.load(f)

# 3. Load CharacterCodeMap.json
with open('/tmp/CharacterCodeMap.json', 'r', encoding='utf-8') as f:
    code_map = json.load(f)

# 4. Fetch SchaleDB students
try:
    r = requests.get('https://schaledb.com/data/en/students.min.json', timeout=15)
    schale_students = r.json()
    print(f"Loaded {len(schale_students)} students from SchaleDB.")
except Exception as e:
    print(f"Could not load SchaleDB: {e}")
    schale_students = {}

# Build index for SchaleDB by DevName and clean Name
schale_by_dev = {}
schale_by_name = {}
for s in schale_students.values():
    dev = s.get('DevName', '').lower()
    if dev:
        schale_by_dev[dev] = s
    nm = s.get('Name', '').lower()
    if nm:
        schale_by_name[nm] = s

# Build index for CharacterCodeMap
code_map_by_dir = {}
for entry in code_map:
    for d in entry.get('directory name', []):
        code_map_by_dir[d.lower()] = {
            'nameEn': entry.get('nameEn', '').strip(),
            'nameJp': entry.get('nameJp', '').strip(),
            'nameKr': entry.get('nameKr', '').strip(),
        }

# Process Backgrounds
backgrounds = []
for item in bg_raw_items:
    file_id = item['id']
    file_name = item['name']
    
    # Format a clean readable name
    # e.g. BG_AbandonedCorridor_Night.jpg -> Abandoned Corridor (Night)
    clean_name = re.sub(r'^(BG_|Arena_)', '', file_name, flags=re.IGNORECASE)
    clean_name = re.sub(r'\.(jpg|png|jpeg)$', '', clean_name, flags=re.IGNORECASE)
    clean_name = clean_name.replace('_', ' ')
    if 'night' in clean_name.lower() and not clean_name.endswith('(Night)'):
        clean_name = re.sub(r'\s*night\s*', ' (Night)', clean_name, flags=re.IGNORECASE)

    bg_id = f"bg_{re.sub(r'[^a-zA-Z0-9_]', '_', file_name.split('.')[0]).lower()}"
    cdn_url = f"https://lh3.googleusercontent.com/d/{file_id}"

    backgrounds.append({
        "id": bg_id,
        "name": clean_name.strip().title(),
        "type": "background",
        "category": "drive_background",
        "source": "google_drive",
        "url": cdn_url,
        "thumbnail": cdn_url,
        "metadata": {
            "fileName": file_name,
            "driveFileId": file_id,
            "folderId": "1lZSWYJAQ_jHVsxksC21zyL0g8YoqmYwm"
        }
    })

print(f"Formatted {len(backgrounds)} backgrounds.")

# Filter character folders (exclude meta folders)
valid_ch_folders = [
    item for item in ch_raw_folders
    if 'folder' in item.get('type', '')
    and item['name'] not in ['### Character Code Map ###', '__CBT__']
]

print(f"Found {len(valid_ch_folders)} valid character folders. Fetching sprite files in parallel...")

def resolve_character_metadata(raw_folder_name):
    clean = raw_folder_name.strip()
    lower = clean.lower()

    # Base without suffix
    base_lower = re.sub(r'(_dior[a-z_0-9]+|_mask[a-z_0-9]+|_bg|_robber|_noweapon)', '', lower, flags=re.IGNORECASE)
    suffix = ''
    if 'diorama' in lower or 'diorma' in lower:
        suffix = ' (Diorama)'
    elif 'mask' in lower:
        suffix = ' (Mask)'
    elif 'robber' in lower:
        suffix = ' (Robber)'
    elif 'noweapon' in lower:
        suffix = ' (No Weapon)'

    # 1. Direct or base in SchaleDB
    schale = schale_by_dev.get(lower) or schale_by_dev.get(base_lower)
    
    # 2. Check CharacterCodeMap
    map_entry = code_map_by_dir.get(lower) or code_map_by_dir.get(base_lower)

    # Name resolution
    if schale:
        base_name = schale.get('Name')
        school = schale.get('School', 'Kivotos')
        club = schale.get('Club', 'General')
    elif map_entry and map_entry['nameEn']:
        base_name = map_entry['nameEn']
        school = 'Kivotos'
        club = 'General'
    elif map_entry and map_entry['nameJp']:
        base_name = map_entry['nameJp']
        school = 'Kivotos'
        club = 'General'
    else:
        # Format from clean
        parts = clean.split('_')
        if len(parts) >= 2:
            base_name = f"{parts[0].capitalize()} ({' '.join(p.capitalize() for p in parts[1:])})"
        else:
            base_name = clean.capitalize()
        school = 'Kivotos'
        club = 'General'

    final_name = f"{base_name}{suffix}".strip()
    return final_name, school, club

def fetch_ch_folder_sprites(item):
    s = requests.Session()
    s.headers['User-Agent'] = 'Mozilla/5.0'
    f_id, f_name = item['id'], item['name']
    try:
        _, children = _parse_embedded_folder_view(sess=s, folder_id=f_id, verify=True)
        # Filter for png images
        pngs = [c for c in children if c[1].lower().endswith('.png')]
        return {
            "folderId": f_id,
            "folderName": f_name,
            "files": pngs
        }
    except Exception as e:
        return {
            "folderId": f_id,
            "folderName": f_name,
            "files": []
        }

start_t = time.time()
with ThreadPoolExecutor(max_workers=30) as ex:
    ch_results = list(ex.map(fetch_ch_folder_sprites, valid_ch_folders))

print(f"Fetched sprites for {len(ch_results)} character folders in {time.time() - start_t:.2f}s!")

characters = []
for res in ch_results:
    f_name = res['folderName']
    f_id = res['folderId']
    files = res['files']
    if not files:
        continue

    char_name, school, club = resolve_character_metadata(f_name)
    char_id = f"ch_{re.sub(r'[^a-zA-Z0-9_]', '_', f_name).lower()}"

    # Build expressions / sprites
    sprites = []
    for sf in files:
        s_id, s_file_name, _ = sf
        expr_name = re.sub(r'\.png$', '', s_file_name, flags=re.IGNORECASE)
        # Clean expression name
        # e.g. airi_default_01 -> Expression 1
        # e.g. CH0058_default_00 -> Default
        expr_label = expr_name.replace(f_name, '').replace('_default', '').replace('_', ' ').strip()
        if not expr_label or expr_label == '00':
            expr_label = "Default"
        else:
            expr_label = expr_label.title()

        cdn_url = f"https://lh3.googleusercontent.com/d/{s_id}"
        sprites.append({
            "name": expr_label,
            "fileName": s_file_name,
            "driveFileId": s_id,
            "url": cdn_url
        })

    default_sprite = sprites[0]['url'] if sprites else ""

    characters.append({
        "id": char_id,
        "name": char_name,
        "type": "character",
        "category": "student",
        "source": "google_drive",
        "url": default_sprite,
        "thumbnail": default_sprite,
        "metadata": {
            "folderName": f_name,
            "folderId": f_id,
            "school": school,
            "club": club,
            "spriteCount": len(sprites),
            "sprites": sprites
        }
    })

print(f"Compiled {len(characters)} characters with full sprite collections.")

# Combine into master catalog
catalog_data = {
    "version": "2.0.0",
    "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "sourceFolders": {
        "backgrounds": {
            "url": "https://drive.google.com/drive/u/0/mobile/folders/1lZSWYJAQ_jHVsxksC21zyL0g8YoqmYwm",
            "folderId": "1lZSWYJAQ_jHVsxksC21zyL0g8YoqmYwm",
            "count": len(backgrounds)
        },
        "characters": {
            "url": "https://drive.google.com/drive/folders/1nlfhqo-laGOEbbPHDhG43fw8mQQZ1iHF",
            "folderId": "1nlfhqo-laGOEbbPHDhG43fw8mQQZ1iHF",
            "count": len(characters)
        }
    },
    "statistics": {
        "totalAssets": len(backgrounds) + len(characters),
        "totalBackgrounds": len(backgrounds),
        "totalCharacters": len(characters),
        "totalCharacterSprites": sum(c['metadata']['spriteCount'] for c in characters)
    },
    "backgrounds": backgrounds,
    "characters": characters
}

out_path = "/data/data/com.termux/files/home/makedialog/src/lib/assets/data/catalog-data.json"
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(catalog_data, f, indent=2)

print(f"Wrote master catalog to {out_path} ({os.path.getsize(out_path) / 1024:.1f} KB).")
print(f"Summary: {len(backgrounds)} backgrounds, {len(characters)} characters with {catalog_data['statistics']['totalCharacterSprites']} total sprites.")
