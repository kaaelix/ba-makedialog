# Blue Archive Scenario Studio & Generator API 

An open-source, deterministic Blue Archive scenario image generator and dialogue animation engine. Create authentic in-game dialogue stills (PNG) and fast animated sequences (GIF) through an interactive visual canvas or direct HTTP API.

## API Quick Reference

### Generate Still Image (PNG)
```bash
curl -X POST https://makedialogbluearchive.vercel.app/api/scenario/generate \
  -H "Content-Type: application/json" \
  -d '{
    "content": {
      "characterName": "Hoshino",
      "affiliation": "Abydos High School",
      "dialogue": "*Uhe~ Sensei, are you still awake?* Working this late isn'\''t good for your health, you know~"
    },
    "characters": [{ "name": "Hoshino", "x": 0, "y": 0, "scale": 1.0 }]
  }'
```

### Generate Animated Sequence (GIF)
```bash
curl -X POST https://makedialogbluearchive.vercel.app/api/scenario/animate \
  -H "Content-Type: application/json" \
  -d '{
    "content": {
      "characterName": "Aru",
      "affiliation": "Problem Solver 68",
      "dialogue": "All according to my brilliant plan! What could possibly go wrong?!"
    },
    "characters": [{ "name": "Aru", "x": 0, "y": 0, "scale": 1.0 }]
  }'
```

## Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` to launch the interactive editor.

## Credits & Assets

- Assets & inspiration: [YouTube reference](https://youtu.be/rASdAmW_P3w?si=72yCKbQ4onmenBlk)
- Engine core inspired by [jozsefsallai/ba-tools](https://github.com/jozsefsallai/ba-tools)
- Blue Archive assets and character designs are trademarks and copyrights of **Nexon Games Co., Ltd.** & **Yostar, Inc.**

Enjoy creating your custom Kivotos moments! :3
