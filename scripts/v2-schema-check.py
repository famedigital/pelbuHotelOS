#!/usr/bin/env python3
"""Check apps/api Supabase queries against supabase/migrations.
Usage: python scripts/v2-schema-check.py . apps/api   (must print TOTAL 0)"""
import re,sys,glob,collections
root=sys.argv[1]; target=sys.argv[2] if len(sys.argv)>2 else "apps/api"
sql="\n".join(open(f,errors="ignore").read() for f in sorted(glob.glob(root+"/supabase/migrations/*.sql")))
L=sql.lower()
tables=set(re.findall(r'create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?',L))
views=set(re.findall(r'create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?(\w+)',L))
funcs=set(re.findall(r'create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)',L))
cols=collections.defaultdict(set)
for m in re.finditer(r'create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?\s*\((.*?)\n\s*\);',L,re.S):
    for line in m.group(2).split("\n"):
        w=re.match(r'\s*"?(\w+)"?\s+\w',line)
        if w: cols[m.group(1)].add(w.group(1))
for m in re.finditer(r'alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?(\w+)(.*?);',L,re.S):
    for c in re.findall(r'add\s+column\s+(?:if\s+not\s+exists\s+)?"?(\w+)"?',m.group(2)): cols[m.group(1)].add(c)
    for a,b in re.findall(r'rename\s+column\s+(\w+)\s+to\s+(\w+)',m.group(2)): cols[m.group(1)].add(b)
probs=[]
for f in glob.glob(root+"/"+target+"/**/*.ts",recursive=True)+glob.glob(root+"/"+target+"/**/*.tsx",recursive=True):
    s=open(f).read(); rel=f[len(root)+1:]
    for r in re.findall(r'\.rpc\(\s*"(\w+)"',s):
        if r not in funcs: probs.append((rel,"RPC",r))
    # chain: from("t") followed by method calls until ; or await
    for m in re.finditer(r'\.from\(\s*"(\w+)"\s*\)',s):
        t=m.group(1)
        if t not in tables and t not in views: probs.append((rel,"TABLE",t)); continue
        if t in views or t not in cols: continue
        # grab chain text up to next statement end
        rest=s[m.end():m.end()+1500]
        end=re.search(r';\s*\n|\n\s*\]\);|\n\s*\),\n\s*ctx\.|\n\s*ctx\.admin',rest)
        chain=rest[:end.start()] if end else rest
        found=set()
        sel=re.search(r'^\s*\.select\(\s*([`"])(.*?)\1',chain,re.S)
        if sel:
            txt=re.sub(r'\w+\s*:\s*\w+!?\w*\(.*?\)','',sel.group(2),flags=re.S)  # alias:rel(...)
            txt=re.sub(r'\w+(!\w+)?\s*\([^()]*(\([^()]*\))*[^()]*\)','',txt,flags=re.S)  # embedded rel(...)
            for c in txt.split(","):
                c=c.strip()
                if not c or c=="*": continue
                c=c.split(":")[-1].strip().split()[0]
                found.add(c)
        for c in re.findall(r'\.(?:eq|neq|gt|gte|lt|lte|in|is|ilike|like|order|not)\(\s*"(\w+)"',chain): found.add(c)
        ins=re.search(r'^\s*\.(?:insert|update|upsert)\(\s*\{(.*?)\}\s*[,)]',chain,re.S)
        if ins:
            for c in re.findall(r'^\s*(\w+)\s*:',ins.group(1),re.M): found.add(c)
        for c in found:
            if c not in cols[t]: probs.append((rel,"COL",t+"."+c))
seen=set()
for p in sorted(probs):
    if p in seen: continue
    seen.add(p); print(*p)
print("TOTAL",len(seen))
