# Red Deer Rescue v0.1 (blockout, unlisted)
Downtown Red Deer -> Capstone -> CPR bridge -> Bower Ponds, built from OpenStreetMap (data/map.json, © OpenStreetMap contributors).
- TV: index.html (`?local=1&room=ABCD` same-browser test transport, `?tod=0.9` fixed time, `?q=0..4` lock quality, `?sim=N` test speed, `?cam=overview`, keys: O overview, N skip time)
- Phone: controller.html?room=ABCD (name or initials -> a hero; vote destinations; call a huddle; huddle chat)
- Data model: `RESCUE.layout.buildings[]` = { footprint, height, floors, kind, anchors:{roof, doors[], stairs}, skin } so scenarios can reskin the same town.
- Map extraction: /workspace/hero-crawler/research/extract_rescue.py
