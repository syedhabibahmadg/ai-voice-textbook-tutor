"""Resumable authorized local-PDF importer. Run: python -m rag.ingest --pdf-dir data/raw."""
import argparse
import hashlib
import json
import os
import re
import sqlite3
from pathlib import Path
import fitz

ROOT = Path(__file__).resolve().parents[1]
DATA = Path(os.getenv('TUTOR_DATA', str(ROOT / 'data/processed')))
MANIFEST = ROOT / 'rag/manifest.json'

def connect():
    DATA.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DATA / 'catalog.sqlite3', timeout=15)
    db.row_factory = sqlite3.Row
    db.executescript('''CREATE TABLE IF NOT EXISTS books(id TEXT PRIMARY KEY, metadata TEXT, fingerprint TEXT);
    CREATE TABLE IF NOT EXISTS chunks(id TEXT PRIMARY KEY, book_id TEXT, chapter TEXT, page INTEGER, text TEXT);
    CREATE INDEX IF NOT EXISTS chunk_book ON chunks(book_id, chapter);''')
    return db

def extract(path, book):
    doc = fitz.open(path)
    pages, scanned = [], []
    toc = [(page, str(number)) for number, (_, title, page) in enumerate(doc.get_toc(), 1)]
    if book.get('chapter_starts'):
        toc = [(page, str(i)) for i, page in enumerate(book['chapter_starts'], 1)]
    chapter = 'unassigned'
    for number, page in enumerate(doc, 1):
        text = page.get_text('text', sort=False)
        if len(re.sub(r'\s', '', text)) < 40:
            scanned.append(number)
            # OCR is opt-in and uses installed Tesseract language data only.
            if os.getenv('TUTOR_OCR_LANG'):
                text = page.get_text(textpage=page.get_textpage_ocr(language=os.environ['TUTOR_OCR_LANG']))
        for start, ch in toc:
            if start == number:
                chapter = ch
        match = re.search(r'(?im)^\s*(?:chapter|unit)\s+(\d+)\b', text)
        if match:
            chapter = match.group(1)
        if not toc and not match:
            section = re.search(r'(?m)^\s*(\d{1,2})\.\d+(?:\.\d+)?\s+[A-Z][A-Z ]{4,}', text)
            if section:
                chapter = section.group(1)
        lines = [line.strip() for line in text.splitlines() if not re.fullmatch(r'\s*\d+\s*', line) and not re.search(r'Web version of PECTAA|Not for Sale|www\.taleem360\.com', line)]
        pages.append((number, chapter, '\n'.join(lines)))
    count = len(doc)
    doc.close()
    if not count:
        raise ValueError('PDF contains no readable pages; verify the completed download')
    return pages, scanned, count

def ingest(path, book):
    if book.get('size') and path.stat().st_size != book['size']:
        raise ValueError('Incomplete PDF download; size differs from Drive metadata')
    fingerprint = hashlib.sha256(path.read_bytes() + b'extraction-v4' + json.dumps(book.get('chapter_starts')).encode() + os.getenv('TUTOR_OCR_LANG','').encode()).hexdigest()
    db = connect()
    old = db.execute('SELECT fingerprint FROM books WHERE id=?', (book['id'],)).fetchone()
    if old and old[0] == fingerprint:
        db.close()
        return 'unchanged'
    cache = DATA / (fingerprint + '.json')
    if cache.exists():
        pages, scanned, count = json.loads(cache.read_text(encoding='utf8'))
    else:
        pages, scanned, count = extract(path, book)
        cache.write_text(json.dumps([pages, scanned, count], ensure_ascii=False), encoding='utf8')
    rows = []
    for page, chapter, text in pages:
        if page in scanned and not os.getenv('TUTOR_OCR_LANG'):
            continue
        words = text.split()
        for offset in range(0, len(words), 150):
            chunk = ' '.join(words[offset:offset + 180]).strip()
            if len(chunk) >= 40:
                rows.append((f"{book['id']}:{page}:{offset}", book['id'], chapter, page, chunk))
    meta = {**book, 'page_count': count, 'scanned_pages': scanned, 'status': ('ocr_pending' if not rows else 'partial_ocr_pending') if scanned and not os.getenv('TUTOR_OCR_LANG') else 'indexed', 'chunk_count': len(rows), 'chapter_mapping': 'reviewed' if book.get('chapter_starts') else 'inferred_needs_review'}
    # Commit a book atomically: an interrupted run never exposes half a book.
    with db:
        db.execute('DELETE FROM chunks WHERE book_id=?', (book['id'],))
        db.executemany('INSERT INTO chunks VALUES(?,?,?,?,?)', rows)
        db.execute('INSERT OR REPLACE INTO books VALUES(?,?,?)', (book['id'], json.dumps(meta), fingerprint))
    db.close()
    return meta['status']

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pdf-dir', type=Path, required=True, help='PDFs named <Drive file ID>.pdf')
    args = parser.parse_args()
    report = []
    for book in json.loads(MANIFEST.read_text(encoding='utf8')):
        path = args.pdf_dir / (book['id'] + '.pdf')
        try:
            status = ingest(path, book) if path.exists() else 'awaiting_download'
            report.append({'id': book['id'], 'status': status})
        except Exception as exc:
            report.append({'id': book['id'], 'status': 'error', 'error': str(exc)})
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / 'ingestion-report.json').write_text(json.dumps(report, indent=2), encoding='utf8')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
