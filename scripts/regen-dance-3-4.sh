#!/usr/bin/env bash
# dance-3 / dance-4 を再生成 (白インナーを除去)
set -euo pipefail
mkdir -p generated-images

STYLE='Anime-style chibi character: young girl with short bright yellow hair, pink wireless over-ear headphones, smiling with thin closed eyes (cheerful), wearing a red Japanese-style jacket (and-style, with small white cherry-blossom pattern), red short pants, red sneakers with bold black outline, white socks. IMPORTANT: red jacket is worn DIRECTLY over the body — absolutely NO white inner shirt, NO undershirt, NO white t-shirt visible at the chest or collar. The jacket front is closed showing only red fabric. Full body, facing the camera (front view). Cel-shaded with soft pastel highlights. PNG with FULLY transparent background (no checkerboard, no background pattern, no white background, just alpha=0 outside the character). Centered composition, character occupies about 70% of vertical frame, no shadow on ground.'

POSE_3='Pose: Twisting her hips slightly to the left, right arm raised diagonally upward, left hand on her hip, head tilted right in a playful dance motion. Body facing forward.'
POSE_4='Pose: Both hands on her hips in a confident pose, knees slightly bent, smiling cheerfully. Body facing forward.'

generate_one() {
  local idx="$1"
  local pose="$2"
  local out="generated-images/tadakayo-front-dance-${idx}.png"
  local prompt="${STYLE} ${pose}"
  echo "=== regenerating ${out} ==="
  local payload
  payload=$(jq -n --arg prompt "$prompt" '{
    contents:[{role:"user",parts:[{text:$prompt}]}],
    generationConfig:{responseModalities:["TEXT","IMAGE"],imageConfig:{aspectRatio:"1:1"}}
  }')
  curl -s -X POST \
    "https://aiplatform.googleapis.com/v1/projects/gemini-api-454714/locations/global/publishers/google/models/gemini-3.1-flash-image-preview:generateContent" \
    -H "Authorization: Bearer $(gcloud auth print-access-token --account=hy.unimail.11@gmail.com 2>/dev/null)" \
    -H "Content-Type: application/json" \
    -d "$payload" > /tmp/nb2-response.json
  python3 - <<PY
import json, base64, sys
with open('/tmp/nb2-response.json') as f:
    data = json.load(f)
if 'error' in data:
    print(f"  ERROR [{data['error']['code']}]: {data['error']['message']}")
    sys.exit(1)
parts = data['candidates'][0]['content']['parts']
for part in parts:
    if 'inlineData' in part:
        img = base64.b64decode(part['inlineData']['data'])
        with open('${out}', 'wb') as f:
            f.write(img)
        print(f"  Saved: ${out} ({len(img):,} bytes)")
        break
PY
}

generate_one 3 "$POSE_3"
sleep 10
generate_one 4 "$POSE_4"
echo "=== done ==="
