// 분반 편성 순수 로직 (autoSection에서 사용, 단위 테스트 대상)

/** 확정 인원을 분반 정원으로 나눈 분반 수 (최소 1) */
export function sectionCount(confirmed: number, perSection: number): number {
  if (confirmed <= 0) return 0;
  return Math.max(1, Math.ceil(confirmed / Math.max(1, perSection)));
}

/** 항목을 n개 분반에 라운드로빈으로 균등 분배 */
export function roundRobin<T>(items: T[], n: number): T[][] {
  const buckets: T[][] = Array.from({ length: Math.max(1, n) }, () => []);
  items.forEach((it, i) => buckets[i % buckets.length].push(it));
  return buckets;
}
