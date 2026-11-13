"""Optional local multilingual embeddings; never downloads model weights."""
import hashlib
import json
import os
from functools import lru_cache
from .ingest import DATA, connect

@lru_cache
def model():
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(os.environ['TUTOR_EMBED_MODEL'], local_files_only=True)

def collection():
    import chromadb
    identity = hashlib.sha256(os.environ['TUTOR_EMBED_MODEL'].encode()).hexdigest()[:12]
    return chromadb.PersistentClient(path=str(DATA / 'chroma')).get_or_create_collection('textbooks-' + identity, metadata={'hnsw:space': 'cosine'})

def index():
    col = collection()
    with connect() as db:
        rows = [dict(r) for r in db.execute('SELECT * FROM chunks')]
    # Reconcile deleted/replaced chunks as well as upserting stable IDs.
    current = {r['id'] for r in rows}
    stale = [i for i in col.get()['ids'] if i not in current]
    if stale:
        col.delete(ids=stale)
    for start in range(0, len(rows), 64):
        batch = rows[start:start + 64]
        vectors, missing = [None] * len(batch), []
        for position, row in enumerate(batch):
            key = hashlib.sha256((os.environ['TUTOR_EMBED_MODEL'] + row['text']).encode()).hexdigest()
            cache = DATA / ('embedding-' + key + '.json')
            if cache.exists():
                vectors[position] = json.loads(cache.read_text())
            else:
                missing.append((position, row['text'], cache))
        if missing:
            encoded = model().encode([item[1] for item in missing], batch_size=32, normalize_embeddings=True).tolist()
            for (position, _, cache), vector in zip(missing, encoded):
                vectors[position] = vector
                cache.write_text(json.dumps(vector))
        if batch:
            col.upsert(ids=[r['id'] for r in batch], documents=[r['text'] for r in batch], embeddings=vectors, metadatas=[{'book_id':r['book_id'], 'chapter':r['chapter'], 'page':r['page']} for r in batch])
    print(f'Indexed {len(rows)} semantic chunks')

def search(query, book, chapter, limit):
    col = collection()
    if not col.count():
        return []
    where = {'book_id': book} if chapter is None else {'$and': [{'book_id': book}, {'chapter': chapter}]}
    result = col.query(query_embeddings=[model().encode(query, normalize_embeddings=True).tolist()], where=where, n_results=min(limit,col.count()))
    return [{'id':i, 'text':text, **meta, 'score':1-distance} for i,text,meta,distance in zip(result['ids'][0],result['documents'][0],result['metadatas'][0],result['distances'][0]) if distance <= float(os.getenv('TUTOR_MAX_DISTANCE','0.35'))]

if __name__ == '__main__':
    index()
