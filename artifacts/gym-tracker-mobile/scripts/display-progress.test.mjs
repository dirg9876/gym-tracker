import assert from "node:assert/strict";
import { test } from "node:test";
import colors from "../constants/colors.ts";
import { progressRatio, countdownLabel } from "../lib/displayProgress.ts";

test("visual progress clamps actual values without changing their meaning", () => {
  assert.equal(progressRatio(3, 80), 3 / 80);
  assert.equal(progressRatio(3, 3), 1);
  assert.equal(progressRatio(20, 10), 1);
  assert.equal(progressRatio(-10, 20), 0);
  assert.equal(progressRatio(0, 20), 0);
});

test("missing or invalid measurements never produce invalid view dimensions", () => {
  for (const pair of [[NaN, 80], [Infinity, 80], [20, NaN], [20, Infinity], [0, 0], [20, -1]]) assert.equal(progressRatio(...pair), 0);
});

test("countdown rounds up and does not show completion early", () => {
  assert.equal(countdownLabel(60001), "1:01");
  assert.equal(countdownLabel(1000), "0:01");
  assert.equal(countdownLabel(1), "0:01");
  assert.equal(countdownLabel(0), "0:00");
});

test("paused, long and invalid countdowns have stable minute and second labels", () => {
  assert.equal(countdownLabel(120000), "2:00");
  assert.equal(countdownLabel(3600000), "60:00");
  for (const value of [-100, NaN, Infinity]) assert.equal(countdownLabel(value), "0:00");
});

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

test("body, muted and semantic labels remain readable on all main surfaces", () => {
  const c = colors.dark;
  for (const foreground of [c.foreground, c.mutedForeground, c.primary, c.accent, c.success, c.destructive]) {
    for (const background of [c.background, c.card, c.secondary]) assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background}`);
  }
});

test("filled action buttons have readable labels rather than white on bright orange", () => {
  const c = colors.dark;
  for (const [foreground, background] of [[c.primaryForeground, c.primary], [c.destructiveForeground, c.destructive], [c.accentForeground, c.accent]]) assert.ok(contrast(foreground, background) >= 7, `${foreground} on ${background}: ${contrast(foreground, background)}`);
});
