// ---- bodies and poses for the D gate's enemies ----
// EFIG maps an enemy type to a function that returns its finished figure
// (makeEnemyFig calls it first). EPOSE maps a type to { pose(e) }, which
// replaces poseEnemy's body (the dummy still goes first), or { after(e) },
// called at the end of poseEnemy just before the glow is set.
const EFIG = {};
const EPOSE = {};
