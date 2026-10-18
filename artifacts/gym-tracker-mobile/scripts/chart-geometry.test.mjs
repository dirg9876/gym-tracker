import assert from "node:assert/strict";
import { test } from "node:test";
import { lineChartGeometry } from "../lib/chartGeometry.ts";

test("chart uses elapsed dates rather than equally spacing irregular sessions", () => {
  const geometry = lineChartGeometry([{ date: "2026-10-01", value: 20 }, { date: "2026-10-02", value: 25 }, { date: "2026-10-11", value: 30 }], 320, 180);
  assert.equal(geometry.coordinates[0].x, geometry.left);
  assert.equal(geometry.coordinates[2].x, geometry.right);
  assert.ok(Math.abs((geometry.coordinates[1].x - geometry.left) / (geometry.right - geometry.left) - 0.1) < 1e-9);
});

test("one point, zero values and equal timestamps always produce finite unclipped geometry", () => {
  for (const points of [[{ date: "2026-10-01", value: 0 }], [{ date: "2026-10-01", value: 20 }, { date: "2026-10-01", value: 20 }]]) {
    const geometry = lineChartGeometry(points, 240, 180);
    for (const point of geometry.coordinates) {
      assert.ok(Number.isFinite(point.x) && point.x >= geometry.left && point.x <= geometry.right);
      assert.ok(Number.isFinite(point.y) && point.y >= 14 && point.y <= geometry.bottom);
    }
    assert.equal(geometry.coordinates.length, points.length);
    if (points.length === 1) assert.equal(geometry.coordinates[0].x, (geometry.left + geometry.right) / 2);
  }
});

test("invalid or unmeasured layouts never emit SVG NaN or negative width", () => {
  for (const width of [0, 50, -1, Infinity, NaN]) assert.equal(lineChartGeometry([{ date: "2026-10-01", value: 20 }], width, 180), null);
  assert.equal(lineChartGeometry([], 320, 180), null);
  assert.equal(lineChartGeometry([{ date: "bad", value: 20 }], 320, 180), null);
  assert.equal(lineChartGeometry([{ date: "2026-10-01", value: NaN }], 320, 180), null);
});
