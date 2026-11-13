# supabase/schema.sql 을 다른 스키마(기본 maniball)용으로 바꾼다.
# 다른 용도로 쓰는 Supabase 프로젝트에 매니볼을 넣을 때 쓴다. public 스키마의 기존 표와 함수는 건드리지 않는다.
#   python3 tools/schema-for.py maniball > /tmp/maniball-schema.sql
import re, sys
S = sys.argv[1] if len(sys.argv) > 1 else "maniball"
assert re.fullmatch(r"[a-z_][a-z0-9_]*", S) and S != "public"
src = open("supabase/schema.sql").read()
src = src.replace("create extension if not exists pgcrypto;\n", "")  # gen_random_uuid 는 기본 함수라 필요 없고, 남의 public 에 확장을 깔지 않는다
out = src.replace("public.", S + ".")                                   # 표, 함수 이름 (역할 public 은 점이 없어 그대로)
out = out.replace("set search_path = public", f"set search_path = {S}, public")
out = out.replace("in schema public", f"in schema {S}")
out = out.replace("schemaname = 'public'", f"schemaname = '{S}'")
head = (f"-- 매니볼 ({S} 스키마 전용). public 스키마의 기존 표와 함수는 바꾸지 않는다\n"
        f"create schema if not exists {S};\n"
        f"grant usage on schema {S} to anon, authenticated, service_role;\n")
tail = (f"\n-- 서비스 역할(관리 화면)은 전부 볼 수 있게\n"
        f"grant all on all tables in schema {S} to service_role;\n"
        f"grant all on all functions in schema {S} to service_role;\n"
        f"grant all on all sequences in schema {S} to service_role;\n")
# 남은 public 참조 검사: 역할 이름(from public, ...) 말고는 없어야 한다
left = [l for l in out.splitlines() if re.search(r"\bpublic\b", l) and not re.search(r"from public, anon|search_path = " + S + ", public", l)]
assert not left, left
sys.stdout.write(head + out + tail)
