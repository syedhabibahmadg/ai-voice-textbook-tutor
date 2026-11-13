import json
import re
import os
import math
from collections import Counter
from contextlib import closing
from rag.ingest import connect, MANIFEST

def books():
    with closing(connect()) as db:
        indexed = {r['id']: json.loads(r['metadata']) for r in db.execute('SELECT * FROM books')}
    return [indexed.get(b['id'], b) for b in json.loads(MANIFEST.read_text(encoding='utf8'))]

STOP = set('what is are the a an of in explain how why does do and to it kya hai hain ka ki ke ko mujhe samjhao'.split())
def tokens(text):
    for phrase in ['آئنائزیشن انرجی','آئنائزیشن توانائی','آئنائزیشن کی توانائی']:
        text=text.replace(phrase,'ionization energy')
    text=re.sub(r'(?i)ionisation','ionization',text)
    return set(re.findall(r'\w+', text.lower())) - STOP

def search(query, book_id, chapter=None, limit=5):
    if os.getenv('TUTOR_EMBED_MODEL'):
        from rag.vectors import search as semantic_search
        return semantic_search(query, book_id, chapter, limit)
    # Unicode lexical fallback works without keys, model downloads or paid services.
    terms = tokens(query)
    with closing(connect()) as db:
        sql = 'SELECT * FROM chunks WHERE book_id=?'
        params = [book_id]
        if chapter is not None:
            sql += ' AND chapter=?'
            params.append(chapter)
        rows = db.execute(sql, params).fetchall()
    ranked = []
    counts = [Counter(re.findall(r'\w+', r['text'].lower())) for r in rows]
    average = sum(sum(c.values()) for c in counts) / max(len(counts), 1)
    frequencies = {term: sum(term in c for c in counts) for term in terms}
    for row, count in zip(rows, counts):
        overlap = terms & tokens(row['text'])
        if overlap and len(overlap) / max(len(terms), 1) >= 0.5:
            score = sum(math.log(1 + (len(rows) - frequencies[t] + 0.5) / (frequencies[t] + 0.5)) * count[t] * 2.2 / (count[t] + 1.2 * (0.25 + 0.75 * sum(count.values()) / max(average, 1))) for t in overlap)
            if re.match(r'(?i)\s*(what is|define|what are)\b', query):
                phrase = r'\s+'.join(re.escape(t) for t in re.findall(r'\w+', query.lower()) if t not in STOP)
                if phrase and re.search(r'\b\d+(?:\.\d+)+\s+' + phrase + r'\b', row['text'], re.I):
                    score += 20
            ranked.append({**dict(row), 'score': score})
    return sorted(ranked, key=lambda r: r['score'], reverse=True)[:limit]
