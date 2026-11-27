/* Snapshot of RDRPeople.draw from solo_people_v04.js, taken before later TV
   wrappers (selfie ball, faces-react, etc.) replace it. Used by selfie_tv_v02
   so a marked selfie becomes a true bobblehead. */
(function (w) {
  'use strict';
  if (w.RDRPeople && typeof RDRPeople.draw === 'function') {
    w.RDRPeopleV04 = { draw: RDRPeople.draw };
  }
})(window);
