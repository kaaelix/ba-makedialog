import os
import sys
import gdown

print("gdown version:", gdown.__version__)

# Inspect backgrounds folder
bg_url = "https://drive.google.com/drive/folders/1lZSWYJAQ_jHVsxksC21zyL0g8YoqmYwm"
ch_url = "https://drive.google.com/drive/folders/1nlfhqo-laGOEbbPHDhG43fw8mQQZ1iHF"

print("Listing background folder...")
try:
    bg_files = gdown.download_folder(bg_url, output="/tmp/bg_inspect", quiet=False, use_cookies=False, remaining_ok=True)
    print(f"Background files downloaded: {len(bg_files) if bg_files else 0}")
except Exception as e:
    print(f"Error inspecting backgrounds: {e}")

