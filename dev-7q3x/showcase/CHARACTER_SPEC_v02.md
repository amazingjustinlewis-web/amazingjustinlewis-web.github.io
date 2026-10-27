# Showcase character swap slot v02 (proxy guy -> Justin's rigged .glb)
Code: makePerson(opts) + setPose(p,pose) + slideTo() in showcase_v02.js. Movement is a SLIDE (no walk clip needed).
- glb: one armature, metres, faces +Z, feet y=0, ~1.6-1.75 m. Circle/sphere head with a mesh/material named `Face` (texture swap per person).
- Recolourable materials named `Shirt`, `Pants`, `Shoes` (code sets opts.shirt/pants/shoes).
- Phone parented to bone `Hand_R`; phone screen material `PhoneScreen` (code draws static game + glow in player colour); optional finger bone `Index_R` (code bobs it).
- Poses (short loops or held poses, pop between them): `stand_idle` (stand), `sit_idle` (sit, pelvis 0.46 m coffee chairs / 0.73 m bar stools), `sit_phone` (phone), `stand_scan` (standPhone, phone raised ~1.4 m).
