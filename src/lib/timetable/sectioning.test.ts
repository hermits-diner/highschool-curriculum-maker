import { describe, expect, it } from "vitest";
import { roundRobin, sectionCount } from "./sectioning";

describe("sectionCount", () => {
  it("인원 0이면 분반 0", () => {
    expect(sectionCount(0, 28)).toBe(0);
  });
  it("정원 이하면 1분반", () => {
    expect(sectionCount(20, 28)).toBe(1);
    expect(sectionCount(28, 28)).toBe(1);
  });
  it("정원 초과면 올림으로 분반 수 증가", () => {
    expect(sectionCount(29, 28)).toBe(2);
    expect(sectionCount(56, 28)).toBe(2);
    expect(sectionCount(57, 28)).toBe(3);
  });
});

describe("roundRobin", () => {
  it("균등 분배(잔여는 앞 분반부터)", () => {
    const buckets = roundRobin([1, 2, 3, 4, 5], 2);
    expect(buckets).toEqual([
      [1, 3, 5],
      [2, 4],
    ]);
  });
  it("분반 수만큼 배열 생성, 인원 수 보존", () => {
    const items = Array.from({ length: 57 }, (_, i) => i);
    const n = sectionCount(57, 28);
    const buckets = roundRobin(items, n);
    expect(buckets).toHaveLength(3);
    expect(buckets.flat().sort((a, b) => a - b)).toEqual(items);
    // 최대·최소 분반 인원 차이는 1 이하 (균형)
    const sizes = buckets.map((b) => b.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });
});
