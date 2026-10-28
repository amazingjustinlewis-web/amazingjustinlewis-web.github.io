# Zero to Phi Arcade Showcase: ambient loops v1
All material is original and seeded/generative, so it contains no existing melodies. It uses NES-style voices: polyBLEP pulse, a 4-bit triangle, LFSR noise and 4-bit envelopes, adapted from bh_v1.
Each loop is rendered into a wrapping buffer of an exact bar count, so tails fold back to the start and the loop is seamless.
Render: `python3 render_showcase_v1.py` (numpy + scipy, 48 kHz stereo). It refuses to overwrite existing WAVs.
Encodes: ogg/ is Vorbis at 96 kbps, mp3/ is 112 kbps, and wav/ holds the masters.

| file | length | BPM | bars | key | place / mood |
|---|---|---|---|---|---|
| showcase_street_music | 53.333 s | 108 | 24 | C Mixolydian | Ross St, outdoors: easy small-town stroll, light skank, walking triangle bass |
| showcase_street_ambience | 64.000 s | – | – | non-tonal (60 Hz hum) | street bed: soft wind, neon hum, distant cars, footsteps, murmured chatter, a faint arcade bloop (subtle, -6 dBFS peak) |
| showcase_arcade | 54.857 s | 140 | 32 | E minor | Pixel Depot Arcade: upbeat attract-mode energy, driving arps, lead + harmony |
| showcase_cafe | 54.545 s | 88 | 20 | F major (maj9/m9) | Morning Ember Coffee: cozy, swung shaker/brushes, rolled soft chords |
| showcase_bar | 56.842 s | 76 | 18 | D Dorian | Rusty Puck bar: dim late-night lounge, walking bass, hazy pads, echoing muted lead |

Preview: showcase_v1_preview.mp3 (46 s). It plays 10 s of each loop in this order: street music, ambience, arcade, café, bar, with 1 s crossfades.
