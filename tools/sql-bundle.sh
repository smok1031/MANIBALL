#!/usr/bin/env bash
# 운영 Supabase에 한 번에 실행할 SQL 묶음을 만든다: 한 덩어리(트랜잭션)라 하나라도 실패하면 전부 되돌아간다.
#   tools/sql-bundle.sh <운영에 마지막으로 반영한 커밋> [스키마]
# 그 커밋 뒤에 생긴 supabase/update-*.sql 을 날짜 순으로 묶고, 점검 상태 SQL(update-2026-11-18-maint.sql)을 맨 끝에 한 번 더 넣는다
# (예전 점검 SQL이 점검 판단 함수를 덮어써도 마지막에 다시 맞춘다). 스키마를 주면 public. 을 그 스키마로 바꾼다(테스트 서버: maniball)
set -euo pipefail
cd "$(dirname "$0")/.."
from=${1:?운영에 마지막으로 반영한 커밋}; schema=${2:-public}
files=$(for f in supabase/update-*.sql; do git cat-file -e "$from:$f" 2>/dev/null || echo "$f"; done | sort)
{
  echo "-- 매니볼 운영 반영 SQL 묶음 ($(git rev-parse --short HEAD), $(date +%F)). 한 덩어리로 실행: 실패하면 전부 되돌아감"
  echo "begin;"
  for f in $files; do echo; echo "-- ===== $f"; cat "$f"; done
  echo; echo "-- ===== 점검 상태 다시 맞춤"; cat supabase/update-2026-11-18-maint.sql
  echo; echo "commit;"
} | if [ "$schema" = public ]; then cat; else sed -e "s/public\./$schema./g" -e "s/search_path = public/search_path = $schema/g" -e "s/schema public/schema $schema/g"; fi
