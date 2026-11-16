// Phones and tablets for the touch tests. Sizes and pixel ratios of the
// descriptor-based entries come from Playwright's own device list, so they
// follow it. ins is what the test fakes for the safe area insets; a side that
// is missing is 0. The custom entries are devices Playwright has no
// descriptor for.
const { devices } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const Z = { l: 0, r: 0, t: 0, b: 0 };
const fromPw = (id, name, desc, ins = {}) => {
  const d = devices[desc + " landscape"];
  if (!d) throw new Error("no Playwright device " + desc + " landscape");
  return {
    id,
    name,
    w: d.viewport.width,
    h: d.viewport.height,
    dpr: d.deviceScaleFactor,
    ins: { ...Z, ...ins },
    isMobile: true,
    hasTouch: true,
  };
};
const custom = (id, name, w, h, dpr, ins = {}) => ({
  id,
  name,
  w,
  h,
  dpr,
  ins: { ...Z, ...ins },
  isMobile: true,
  hasTouch: true,
});
const notch = { l: 47, r: 47, t: 0, b: 21 };
export default [
  fromPw("iphone-se", "iPhone SE (3rd gen)", "iPhone SE (3rd gen)"),
  fromPw("iphone-16", "iPhone 16", "iPhone 16", notch),
  fromPw("iphone-16-pro-max", "iPhone 16 Pro Max", "iPhone 16 Pro Max", notch),
  fromPw("pixel-9", "Pixel 9", "Pixel 9"),
  fromPw("pixel-5", "Pixel 5", "Pixel 5"),
  fromPw("galaxy-s24", "Galaxy S24", "Galaxy S24"),
  fromPw("fold-7-cover", "Galaxy Z Fold 7 Cover", "Galaxy Z Fold 7 Cover"),
  fromPw("moto-g4", "Moto G4", "Moto G4"),
  fromPw("ipad-pro-11", "iPad Pro 11", "iPad Pro 11", { b: 20 }),
  custom("oneplus-13", "OnePlus 13", 905, 412, 3.5),
  custom("ipad-mini", "iPad mini", 1133, 744, 2, { b: 20 }),
  custom("ipad-pro-13", "iPad Pro 13", 1376, 1032, 2, { b: 20 }),
];
