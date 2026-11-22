import json
import re
import os
import math
import sqlite3
from functools import lru_cache
from collections import Counter
from contextlib import closing
from rag.ingest import connect, MANIFEST

def books():
    with closing(connect()) as db:
        indexed = {r['id']: json.loads(r['metadata']) for r in db.execute('SELECT * FROM books')}
    return [indexed.get(b['id'], b) for b in json.loads(MANIFEST.read_text(encoding='utf8'))]

STOP = set('what is are the a an of in explain how why does do and to it kya hai hain ka ki ke ko mujhe samjhao tell me about please can you could would i want know understand give describe definition define briefly detail details with example examples from this that book textbook chapter according hota hoti hote kis kise kon sa se tha thi they their was were who which for on as at by be its meaning means difference between کیا ہے ہیں کیسے بتائیں کے بارے میں ہوتا ہوتی ہوتے ہو مجھے سمجھاؤ ذرا آسان لفظوں'.split())
ALIASES = {'کمپیوٹر':'computer','ہارڈویئر':'hardware','سافٹویئر':'software','میموری':'memory','الگورتھم':'algorithm','آکسیجن':'oxygen','ہائیڈروجن':'hydrogen','توانائی':'energy','ایٹم':'atom','کیمیائی':'chemical'}

def stem(word):
    if len(word)>5 and word.endswith('ies'): return word[:-3]+'y'
    if len(word)>5 and word.endswith('sses'): return word[:-2]
    if len(word)>4 and word.endswith('s') and not word.endswith(('ss','us','is')): return word[:-1]
    return word

@lru_cache(maxsize=16)
def _index(path, book_id, fingerprint):
    with closing(sqlite3.connect(path)) as db:
        db.row_factory=sqlite3.Row
        rows=[dict(r) for r in db.execute('SELECT * FROM chunks WHERE book_id=?',(book_id,))]
    counts=[Counter(stem(t) for t in re.findall(r'\w+', r['text'].lower())) for r in rows]
    lengths=[sum(c.values()) for c in counts]
    return rows,counts,lengths,sum(lengths)/max(len(rows),1)

def normalize_text(text):
    for phrase in ['آئنائزیشن انرجی','آئنائزیشن توانائی','آئنائزیشن کی توانائی']:
        text=text.replace(phrase,'ionization energy')
    text=re.sub(r'(?i)ionisation','ionization',text)
    for original, replacement in ALIASES.items(): text=text.replace(original,replacement)
    return text.lower()

def tokens(text):
    return {stem(t) for t in re.findall(r'\w+',normalize_text(text)) if t not in STOP}

def search(query, book_id, chapter=None, limit=5):
    if os.getenv('TUTOR_EMBED_MODEL'):
        from rag.vectors import search as semantic_search
        return semantic_search(query, book_id, chapter, limit)
    # Unicode lexical fallback works without keys, model downloads or paid services.
    terms = tokens(query)
    with closing(connect()) as db:
        path=db.execute('PRAGMA database_list').fetchone()[2]
        row=db.execute('SELECT fingerprint FROM books WHERE id=?',(book_id,)).fetchone()
    rows,counts,lengths,average=_index(path,book_id,row[0] if row else '')
    if chapter is not None:
        selected=[i for i,r in enumerate(rows) if r['chapter']==chapter]
        rows=[rows[i] for i in selected];counts=[counts[i] for i in selected];lengths=[lengths[i] for i in selected]
        average=sum(lengths)/max(len(lengths),1)
    ranked = []
    frequencies = {term: sum(term in c for c in counts) for term in terms}
    for row, count, length in zip(rows, counts, lengths):
        overlap = terms & count.keys()
        if len(overlap) >= (1 if len(terms)<=3 else 2):
            score = sum(math.log(1 + (len(rows) - frequencies[t] + 0.5) / (frequencies[t] + 0.5)) * count[t] * 2.2 / (count[t] + 1.2 * (0.25 + 0.75 * length / max(average, 1))) for t in overlap)
            if row['page']<=3: score*=0.3
            if re.search(r'(?i)(?:\b(?:what is|define|what are|explain|kya|tell me about)\b|کیا|بتائیں)', query):
                phrase = r'\s+'.join(re.escape(t) for t in re.findall(r'\w+', normalize_text(query)) if t not in STOP)
                if phrase and re.search(r'\b\d+(?:\.\d+)+\s+'+phrase+r's?\s+(?:[“\"\']|(?:The|An?|This|These|It|They)\b)',row['text'],re.I):
                    score+=35
                if phrase and len([t for t in re.findall(r'\w+',normalize_text(query)) if t not in STOP])==1:
                    matches=list(re.finditer(r'\b'+phrase+r's?\s+(?:is|are|refers|means)\b',row['text'],re.I))
                    for match in matches:
                        prefix=row['text'][max(0,match.start()-25):match.start()]
                        words=re.findall(r'\w+',prefix)
                        direct=match.group(0)[0].isupper() or not words or words[-1].lower() in ['a','an','the']
                        score+=25 if direct else 2
                        if direct:break
                elif phrase and re.search(r'\b'+phrase+r'\s+(?:is|are|refers|means|consists)\b',row['text'],re.I):
                    score+=20
            ranked.append({**dict(row), 'score': score})
    return sorted(ranked, key=lambda r: r['score'], reverse=True)[:limit]
