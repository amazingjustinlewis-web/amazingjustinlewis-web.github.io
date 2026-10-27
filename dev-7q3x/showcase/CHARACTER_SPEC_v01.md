# Showcase character spec v01 (for Justin's rigged figure)
One glb, one armature, metres, Y-up on export, character faces +Z, feet on y=0, ~1.75 m tall. Right-handed phone: phone is parented to bone `Hand_R` (screen facing the eyes in sit_phone / stand_scan).
Clips (glTF animation names; loop = L, one-shot = 1):
| clip | state | len | notes |
|---|---|---|---|
| stand_idle | idle | 2-3 s L | weight shift |
| walk | walk | 1.0 s L (2 steps) | in place (no root motion), ~1.3 m/s stride |
| sit_idle | sit | 2-3 s L | pelvis/seat at 0.46-0.48 m (chair seat top 0.49 m), thighs level, feet flat |
| sit_phone | phonePlay | 2-4 s L | both hands on phone ~0.30 m in front of chest, thumbs tapping, small reactions |
| stand_scan | scan | 1.5 s 1 + hold | right arm raises phone to ~1.4 m toward the code, hold |
| celebrate_jump | celebrate | 1.2 s L | jump ~0.35-0.45 m, arms up; starts/ends standing (game lifts from sit) |
| pod_enter | enterPod | 1.2 s 1 | step up/in, ends crouched seated (pod seat ~0.55 m) |
| pod_exit | exitPod | 1.0 s 1 | reverse of pod_enter |
Optional: sit_down / stand_up (0.8 s) transitions. Code mapping: CLIPS in showcase_v01.js.
