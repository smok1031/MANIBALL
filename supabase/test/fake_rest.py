"""시험용 가짜 Supabase (REST와 로그아웃만). 실제 Postgres에서 schema.sql의 권한 규칙을 그대로 거친다.
supabase-js가 웹 앱에서 쓰는 요청 모양만 흉내 낸다. 서명 검증이 없으니 시험에만 쓰세요.
Usage: python3 fake_rest.py PORT "host=/var/tmp/pgt port=5499 user=postgres dbname=t2"
"""
import sys, json, re, base64
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qsl
import psycopg2, psycopg2.extras

PORT, DSN = int(sys.argv[1]), sys.argv[2]
COLS = {"docs": {"team_id", "coll", "id", "data", "updated_at", "updated_by"},
        "members": {"team_id", "user_id", "role", "display_name", "joined_at"},
        "teams": {"id", "name", "invite_code", "created_by", "created_at"}}
FNS = {"create_team", "team_by_code", "join_team", "set_my_name", "set_member_role", "remove_member", "new_invite_code", "doc_patch", "my_name"}
IDENT = re.compile(r"^[a-z_]+$")

def claims(h):
    a = h.get("Authorization", "")
    tok = a[7:] if a.startswith("Bearer ") else ""
    parts = tok.split(".")
    if len(parts) != 3: return None
    try:
        p = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * (-len(parts[1]) % 4)))
    except Exception:
        return None
    return p if p.get("role") == "authenticated" and p.get("sub") else None

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
        self.send_header("Access-Control-Expose-Headers", "Content-Range")
    def reply(self, code, body=None):
        raw = b"" if body is None else json.dumps(body, default=str).encode()
        self.send_response(code); self.cors()
        if body is not None: self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw))); self.end_headers(); self.wfile.write(raw)
    def do_OPTIONS(self): self.reply(204)
    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"null") if n else None

    def run(self, fn):
        c = claims(self.headers)
        conn = psycopg2.connect(DSN)
        try:
            with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("set local role " + ("authenticated" if c else "anon"))
                cur.execute("select set_config('request.jwt.claims', %s, true), set_config('request.jwt.claim.sub', %s, true)", (json.dumps(c or {}), (c or {}).get("sub", "")))
                return fn(cur)
        except psycopg2.Error as e:
            code = e.pgcode or ""
            status = 403 if code == "42501" else 404 if code == "P0002" else 400
            self.reply(status, {"code": code, "message": (e.diag.message_primary if e.diag else str(e)), "details": None, "hint": None})
            return None
        finally:
            conn.close()

    def route(self):
        u = urlparse(self.path); parts = u.path.strip("/").split("/")
        q = parse_qsl(u.query, keep_blank_values=True)
        if parts[:2] == ["auth", "v1"]:
            self.reply(204 if parts[-1] == "logout" else 400, None if parts[-1] == "logout" else {"error": "not_supported"}); return None
        if parts[:2] != ["rest", "v1"]: self.reply(404, {"message": "not found"}); return None
        return parts[2:], q

    def where(self, table, q):
        sql, args, order, limit, offset, sel = [], [], [], None, None, "*"
        for k, v in q:
            if k == "select": sel = v; continue
            if k == "order":
                for o in v.split(","):
                    col, _, d = o.partition(".")
                    assert col in COLS[table]
                    order.append(col + (" desc" if d.startswith("desc") else " asc"))
                continue
            if k == "limit": limit = int(v); continue
            if k == "offset": offset = int(v); continue
            if k in ("on_conflict", "columns"): continue
            assert k in COLS[table], k
            op, _, val = v.partition(".")
            if op == "eq": sql.append(f"{k}::text = %s"); args.append(val)
            elif op == "in": sql.append(f"{k}::text = any(%s)"); args.append([x.strip('"') for x in val.strip("()").split(",") if x])
            else: raise AssertionError(op)
        cols = [c.strip() for c in sel.split(",")] if sel != "*" else ["*"]
        for c in cols: assert c == "*" or c in COLS[table], c
        tail = (" order by " + ", ".join(order) if order else "") + (f" limit {limit}" if limit is not None else "") + (f" offset {offset}" if offset is not None else "")
        return ", ".join(cols), (" where " + " and ".join(sql) if sql else ""), args, tail

    def shape(self, rows):
        if "vnd.pgrst.object" in self.headers.get("Accept", ""):
            if len(rows) != 1: self.reply(406, {"code": "PGRST116", "message": "JSON object requested, multiple (or no) rows returned"}); return
            self.reply(200, rows[0]); return
        self.reply(200, rows)

    def do_GET(self):
        r = self.route()
        if not r: return
        path, q = r; t = path[0]
        if t not in COLS: return self.reply(404, {"message": "no table"})
        cols, w, args, tail = self.where(t, q)
        rows = self.run(lambda cur: (cur.execute(f"select {cols} from public.{t}{w}{tail}", args), cur.fetchall())[1])
        if rows is not None: self.shape(rows)

    def do_POST(self):
        r = self.route()
        if not r: return
        path, q = r; b = self.body()
        if path[0] == "rpc":
            fn = path[1]
            if fn not in FNS: return self.reply(404, {"message": "no fn"})
            keys = list((b or {}).keys()); assert all(IDENT.match(k) for k in keys)
            call = f"select * from public.{fn}(" + ", ".join(f"{k} => %s" for k in keys) + ")"
            vals = [json.dumps(b[k]) if isinstance(b[k], (dict, list)) else b[k] for k in keys]
            def go(cur):
                cur.execute(call, vals); rows = cur.fetchall()
                if fn == "team_by_code": return ("ok", [dict(x) for x in rows])
                return ("ok", list(rows[0].values())[0] if rows else None)
            res = self.run(go)
            if res is not None: self.reply(200, res[1])
            return
        t = path[0]; assert t == "docs"
        rows = b if isinstance(b, list) else [b]
        sel = dict(q).get("select", "*")
        merge = "merge-duplicates" in self.headers.get("Prefer", "")
        def go(cur):
            out = []
            for row in rows:
                cols = list(row.keys()); assert all(c in COLS["docs"] for c in cols)
                vals = [json.dumps(row[c]) if c == "data" else row[c] for c in cols]
                conflict = " on conflict (team_id, coll, id) do update set " + ", ".join(f"{c} = excluded.{c}" for c in cols if c not in ("team_id", "coll", "id")) if merge else ""
                cur.execute(f"insert into public.docs ({', '.join(cols)}) values ({', '.join(['%s'] * len(cols))}){conflict} returning {sel}", vals)
                out += cur.fetchall()
            return out
        res = self.run(go)
        if res is not None: self.shape(res)

    def do_DELETE(self):
        r = self.route()
        if not r: return
        path, q = r; t = path[0]; assert t == "docs"
        cols, w, args, _ = self.where(t, q)
        assert w, "delete without filter"
        res = self.run(lambda cur: (cur.execute(f"delete from public.docs{w} returning {cols}", args), cur.fetchall())[1])
        if res is not None: self.shape(res)

ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
