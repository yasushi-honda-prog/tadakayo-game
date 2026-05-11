#!/usr/bin/env bash
# Player 専用ダンスポーズ sprite 4 枚を nano-banana で生成。
# 既存キャラ (赤い和風ジャケット + 赤い短パン + 赤いスニーカー + 黄色ショート + ピンクヘッドフォン)
# のスタイルを維持しつつ、4 種のダンスポーズを front view で生成する。
#
# 生成先: generated-images/tadakayo-front-dance-{1..4}.png (raw)
# その後 scripts/remove-checker-bg.py で透明化 → public/assets/images/ へ配置
#
# 使い方:
#   bash scripts/generate-dance-sprites.sh
set -euo pipefail

mkdir -p generated-images

# 共通スタイル指定: PR #26 後の赤靴版で統一
STYLE='Anime-style chibi character: young girl with short bright yellow hair, pink wireless over-ear headphones, smiling with thin closed eyes (cheerful), wearing a red Japanese-style jacket (and-style, with cherry-blossom or simple modern pattern), red short pants, red sneakers with bold black outline, white socks. Full body, facing the camera (front view). Cel-shaded with soft pastel highlights. PNG with FULLY transparent background (no checkerboard, no background pattern, no white background, just alpha=0 outside the character). Centered composition, character occupies about 70% of vertical frame, no shadow on ground.'

POSE_1='Pose: Both arms raised high above her head in a joyful celebration, slight jump motion (feet just barely off ground), big happy grin. Body facing forward.'
POSE_2='Pose: Twisting her hips slightly to the right, left arm raised diagonally upward, right hand on her hip, head tilted left in a playful dance motion. Body facing forward.'
POSE_3='Pose: Twisting her hips slightly to the left, right arm raised diagonally upward, left hand on her hip, head tilted right in a playful dance motion. Body facing forward.'
POSE_4='Pose: Both hands on her hips in a confident pose, knees slightly bent, smiling cheerfully. Body facing forward.'

generate_one() {
  local idx="$1"
  local pose="$2"
  local out="generated-images/tadakayo-front-dance-${idx}.png"
  local prompt="${STYLE} ${pose}"

  echo "=== [${idx}/4] generating ${out} ==="

  local payload
  payload=$(jq -n --arg prompt "$prompt" '{
    contents: [{role: "user", parts: [{text: $prompt}]}],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {aspectRatio: "1:1"}
    }
  }')

  local max_retry=3
  local delay=10
  local success=false
  for i in $(seq 1 $max_retry); do
    curl -s -X POST \
      "https://aiplatform.googleapis.com/v1/projects/gemini-api-454714/locations/global/publishers/google/models/gemini-3.1-flash-image-preview:generateContent" \
      -H "Authorization: Bearer $(gcloud auth print-access-token --account=hy.unimail.11@gmail.com 2>/dev/null)" \
      -H "Content-Type: application/json" \
      -d "$payload" > /tmp/nb2-response.json

    local http_error
    http_error=$(python3 -c "
import json
try:
    with open('/tmp/nb2-response.json') as f:
        data = json.load(f)
    print(data.get('error',{}).get('code',''))
except Exception:
    print('')
" 2>/dev/null || echo "")

    if [ "$http_error" = "429" ] || [ "$http_error" = "503" ]; then
      echo "  Rate limited (attempt $i/$max_retry). Waiting ${delay}s..."
      sleep $delay
      delay=$((delay * 2))
    else
      success=true
      break
    fi
  done

  if [ "$success" = false ]; then
    echo "  ERROR: 3 retries exhausted for ${out}"
    return 1
  fi

  python3 - <<PY
import json, base64, sys
with open('/tmp/nb2-response.json') as f:
    data = json.load(f)
if 'error' in data:
    print(f"  ERROR [{data['error']['code']}]: {data['error']['message']}")
    sys.exit(1)
parts = data['candidates'][0]['content']['parts']
saved = False
for part in parts:
    if 'inlineData' in part:
        img = base64.b64decode(part['inlineData']['data'])
        with open('${out}', 'wb') as f:
            f.write(img)
        print(f"  Saved: ${out} ({len(img):,} bytes)")
        saved = True
        break
if not saved:
    for part in parts:
        if 'text' in part:
            print(f"  Text-only response: {part['text'][:200]}")
    sys.exit(1)
PY
}

generate_one 1 "$POSE_1"
sleep 12
generate_one 2 "$POSE_2"
sleep 12
generate_one 3 "$POSE_3"
sleep 12
generate_one 4 "$POSE_4"

echo ""
echo "=== All 4 dance sprites generated ==="
ls -la generated-images/tadakayo-front-dance-*.png
