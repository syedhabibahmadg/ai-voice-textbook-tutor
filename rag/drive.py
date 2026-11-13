"""Authorized Drive discovery/download CLI using a caller-provided short-lived OAuth token.

Token needs drive.readonly scope and access to the supplied root folder.
No credentials or signed URLs are written to disk.
"""
import argparse
import json
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path
from .ingest import MANIFEST

API = 'https://www.googleapis.com/drive/v3/files'

def request(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'Authorization': 'Bearer ' + os.environ['GOOGLE_DRIVE_ACCESS_TOKEN']}), timeout=120)

def children(folder):
    token = None
    while True:
        params = {'q': f"'{folder}' in parents and trashed=false", 'fields': 'nextPageToken,files(id,name,mimeType,modifiedTime,size,md5Checksum)', 'pageSize': 100, 'supportsAllDrives': 'true', 'includeItemsFromAllDrives': 'true'}
        if token:
            params['pageToken'] = token
        with request(API + '?' + urllib.parse.urlencode(params)) as response:
            page = json.load(response)
        yield from page.get('files', [])
        token = page.get('nextPageToken')
        if not token:
            break

def discover(root):
    found, seen = [], set()
    def walk(folder, grade=None):
        if folder in seen:
            return
        seen.add(folder)
        for item in children(folder):
            match = re.search(r'(?i)class\s*(9|10|11|12)\b', item['name'])
            level = int(match.group(1)) if match else grade
            if item['mimeType'] == 'application/vnd.google-apps.folder':
                walk(item['id'], level)
            elif item['mimeType'] == 'application/pdf' and level:
                subject = re.sub(r'(?i)\.pdf$', '', item['name'])
                found.append({'id':item['id'], 'drive_file_id':item['id'], 'grade':level, 'subject':subject, 'title':item['name'], 'page_count':None, 'status':'discovered', 'modified':item.get('modifiedTime'), 'size':int(item.get('size',0)), 'md5':item.get('md5Checksum')})
    walk(root)
    return found

def download(book, directory):
    import hashlib
    target = directory / (book['id'] + '.pdf')
    if target.exists():
        size_ok = not book.get('size') or target.stat().st_size == book['size']
        md5_ok = not book.get('md5') or hashlib.md5(target.read_bytes()).hexdigest() == book['md5']
        if size_ok and md5_ok:
            return 'cached'
    temporary = target.with_suffix('.part')
    with request(API + '/' + urllib.parse.quote(book['id'], safe='') + '?alt=media&supportsAllDrives=true') as response, temporary.open('wb') as output:
        while block := response.read(1024 * 1024):
            output.write(block)
    if book.get('size') and temporary.stat().st_size != book['size']:
        raise ValueError('Incomplete download')
    if book.get('md5') and hashlib.md5(temporary.read_bytes()).hexdigest() != book['md5']:
        raise ValueError('Download checksum mismatch')
    temporary.replace(target)
    return 'downloaded'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True, help='Authorized Drive root folder ID')
    parser.add_argument('--download-dir', type=Path)
    args = parser.parse_args()
    prior = {b['id']:b for b in json.loads(MANIFEST.read_text(encoding='utf8'))}
    found = discover(args.root)
    for book in found:
        if book['id'] in prior:
            book.update({key:value for key,value in prior[book['id']].items() if key in ['chapter_starts','subject']})
        prior[book['id']] = book
    MANIFEST.write_text(json.dumps(list(prior.values()), ensure_ascii=False, indent=2), encoding='utf8')
    if args.download_dir:
        args.download_dir.mkdir(parents=True, exist_ok=True)
        for book in found:
            try:
                print(book['id'], download(book, args.download_dir), flush=True)
            except Exception as exc:
                # Do not log HTTP request URLs/headers containing credentials.
                print(book['id'], 'download_error', type(exc).__name__, flush=True)
    print(f'Discovered {len(found)} PDFs. Review subject/edition assignments before ingestion.')

if __name__ == '__main__':
    main()
