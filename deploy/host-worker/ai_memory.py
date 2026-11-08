#!/usr/bin/env python3
"""Persistent local memory for AI Linux. Python stdlib only.
No automatic trust of stored text as instructions; use it as untrusted context.
"""
import argparse, json, os, sqlite3, sys
from pathlib import Path

AGENTS = ("system", "aria", "alex", "astyria", "aurelius")
DB = Path(os.environ.get("AI_LINUX_MEMORY_DB", str(Path.home()/".local/share/ai-linux/memory.sqlite3")))

def connect():
    DB.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    try: DB.chmod(0o600)
    except FileNotFoundError: pass
    con=sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("""CREATE TABLE IF NOT EXISTS memories(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner TEXT NOT NULL, scope TEXT NOT NULL,
        content TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""")
    con.execute("CREATE INDEX IF NOT EXISTS memory_owner ON memories(owner,id)")
    return con

def main():
    p=argparse.ArgumentParser(description="AI Linux local persistent memory")
    p.add_argument("action",choices=["add","list","search","delete"])
    p.add_argument("--owner",choices=AGENTS,default="system")
    p.add_argument("--scope",choices=["private","shared"],default="private")
    p.add_argument("--text",default="")
    p.add_argument("--id",type=int)
    p.add_argument("--limit",type=int,default=30)
    args=p.parse_args()
    with connect() as con:
        if args.action=="add":
            if not args.text.strip() or len(args.text)>20000: p.error("--text must be 1..20000 characters")
            cur=con.execute("INSERT INTO memories(owner,scope,content) VALUES(?,?,?)",(args.owner,args.scope,args.text))
            result={"id":cur.lastrowid,"stored":True}
        elif args.action=="delete":
            if args.id is None: p.error("--id is required")
            cur=con.execute("DELETE FROM memories WHERE id=? AND owner=?",(args.id,args.owner))
            result={"deleted":cur.rowcount}
        else:
            sql="SELECT id,owner,scope,content,created_at FROM memories WHERE (owner=? OR scope='shared')"
            params=[args.owner]
            if args.action=="search":
                if not args.text: p.error("--text is required for search")
                sql+=" AND instr(lower(content),lower(?))>0";params.append(args.text)
            sql+=" ORDER BY id DESC LIMIT ?";params.append(max(1,min(args.limit,200)))
            result=[dict(zip(("id","owner","scope","content","created_at"),row)) for row in con.execute(sql,params)]
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=="__main__": main()
