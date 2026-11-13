#!/usr/bin/env bash
# 매니볼 배포 스크립트
#   tools/release.sh test     지금 main을 테스트 사이트(/kei-fc/test/)에 올린다. 테스트용 Supabase를 쓴다 (tools/stage.env)
#   tools/release.sh approve  지금 테스트 사이트에 올라간 버전을 "승인"으로 표시한다 (approved 브랜치)
#   tools/release.sh prod     승인된 버전이 운영과 다르면 운영 사이트(/kei-fc/)에 올린다. test/ 폴더는 건드리지 않는다
# 운영 서버(Supabase)용 SQL이 새로 생겼으면 알려만 준다. SQL은 사람이 Supabase SQL 편집기에서 직접 실행한다
set -euo pipefail
cd "$(dirname "$0")/.."
REPO=$(pwd); GHP=${GHP:-/var/tmp/ghp}; MODE=${1:-}
[ -d "$GHP/.git" ] || git worktree add "$GHP" gh-pages
git -C "$GHP" fetch -q origin gh-pages && git -C "$GHP" reset -q --hard origin/gh-pages
publish() { # $1: 빌드 폴더, $2: gh-pages 안의 대상 폴더 ("" 이면 맨 위)
  local src=$1 dst="$GHP/${2:-}"; mkdir -p "$dst"
  if [ -n "${2:-}" ]; then find "$dst" -mindepth 1 -delete; else find "$dst" -mindepth 1 -maxdepth 1 ! -name .git ! -name test ! -name .nojekyll -exec rm -rf {} +; fi
  cp -r "$src"/. "$dst"/
}
case "$MODE" in
  test)
    [ -f tools/stage.env ] || { echo "tools/stage.env 가 없어요 (테스트용 Supabase 주소와 공개 키)"; exit 1; }
    set -a; . tools/stage.env; set +a
    VITE_STAGE=test npm run build >/dev/null
    publish dist test
    sha=$(git rev-parse --short HEAD)
    echo "$sha" > "$GHP/test/version.txt"
    git -C "$GHP" add -A && git -C "$GHP" commit -q -m "테스트 사이트: $sha" && git -C "$GHP" push -q origin HEAD:gh-pages
    git push -q -f origin HEAD:refs/heads/testing
    echo "테스트 사이트에 올림: $sha" ;;
  approve)
    t=$(git ls-remote origin refs/heads/testing | cut -f1); [ -n "$t" ] || { echo "테스트에 올린 버전이 없어요"; exit 1; }
    git push -q -f origin "$t:refs/heads/approved"; echo "승인: ${t:0:7}" ;;
  prod)
    git fetch -q origin approved live 2>/dev/null || git fetch -q origin approved
    a=$(git rev-parse -q --verify origin/approved || true); l=$(git rev-parse -q --verify origin/live || true)
    [ -n "$a" ] || { echo "승인된 버전이 없어요"; exit 0; }
    [ "$a" != "$l" ] || { echo "새로 승인된 버전이 없어요. 운영은 그대로예요"; exit 0; }
    tmp=$(mktemp -d); git worktree add -q "$tmp" "$a"
    (cd "$tmp" && ln -s "$REPO/node_modules" node_modules && npm run build >/dev/null)
    publish "$tmp/dist" ""
    echo "${a:0:7}" > "$GHP/version.txt"
    git -C "$GHP" add -A && git -C "$GHP" commit -q -m "운영 배포: ${a:0:7}" && git -C "$GHP" push -q origin HEAD:gh-pages
    sql=$( [ -n "$l" ] && git diff --name-only "$l" "$a" -- 'supabase/update-*.sql' || true )
    git push -q -f origin "$a:refs/heads/live"; git worktree remove --force "$tmp"
    echo "운영에 올림: ${a:0:7}"; [ -z "$sql" ] || echo "운영 Supabase에서 실행할 SQL: $sql" ;;
  *) echo "사용법: tools/release.sh test | approve | prod"; exit 1 ;;
esac
