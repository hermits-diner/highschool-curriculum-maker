// data/*.json → supabase/seed.sql 생성 (재실행 안전한 upsert)
// 실행: node scripts/gen-seed.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const subjects = JSON.parse(
  readFileSync(join(root, "data", "subjects-2022.json"), "utf8")
).subjects;
const rules = JSON.parse(
  readFileSync(join(root, "data", "prerequisites-2022.json"), "utf8")
).rules;

const esc = (s) => s.replaceAll("'", "''");

let sql = "-- 자동 생성 파일: node scripts/gen-seed.mjs (직접 수정 금지)\n\n";

sql += "insert into public.subjects (code, name, subject_group, subject_type, default_credits, min_credits, max_credits, sort_order) values\n";
sql += subjects
  .map(
    (s, i) =>
      `('${esc(s.code)}', '${esc(s.name)}', '${esc(s.group)}', '${esc(s.type)}', ${s.credits}, ${s.min}, ${s.max}, ${i})`
  )
  .join(",\n");
sql += `
on conflict (code) do update set
  name = excluded.name,
  subject_group = excluded.subject_group,
  subject_type = excluded.subject_type,
  default_credits = excluded.default_credits,
  min_credits = excluded.min_credits,
  max_credits = excluded.max_credits,
  sort_order = excluded.sort_order;

`;

for (const r of rules) {
  sql += `insert into public.prerequisite_rules (subject_id, prerequisite_subject_id, enforcement)
select s.id, p.id, '${r.enforcement}' from public.subjects s, public.subjects p
where s.code = '${esc(r.subject)}' and p.code = '${esc(r.prerequisite)}'
on conflict (subject_id, prerequisite_subject_id) do update set enforcement = excluded.enforcement;
`;
}

writeFileSync(join(root, "supabase", "seed.sql"), sql, "utf8");
console.log(
  `seed.sql 생성 완료: 과목 ${subjects.length}개, 선수규칙 ${rules.length}개`
);
