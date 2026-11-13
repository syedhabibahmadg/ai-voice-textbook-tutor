"""Live API smoke test against the same endpoints used by the mobile app."""
import argparse
import json
import urllib.request


def run(base):
    def api(path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(base + path, data=data, headers={'Content-Type':'application/json'})
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)
    assert api('/health')['status'] == 'ok'
    assert 11 in api('/api/v1/grades')
    assert 'Chemistry' in api('/api/v1/subjects?grade=11')
    books = api('/api/v1/textbooks?grade=11&subject=Chemistry')
    book = next(b for b in books if b.get('chunk_count', 0) > 0)
    assert any(ch['id'] == '1' for ch in api('/api/v1/chapters?textbook=' + book['id']))
    query = {'grade':11,'subject':'Chemistry','textbook':book['id'],'chapter':'1','query':'What is ionization energy?'}
    result = api('/api/v1/chat',query)
    assert result['grounded'] and result['citations'][0]['page'] == 12
    assert 'remove one electron' in result['answer']
    assert all(c['book_id'] == book['id'] and c['chapter'] == '1' for c in result['citations'])
    assert not api('/api/v1/chat',{**query,'query':'Who won the football world cup?'})['grounded']
    print('PASS: live catalog -> Chemistry -> Chapter 1 -> answer -> PDF page 12; unknown-question abstention')

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--base',default='http://127.0.0.1:8000')
    run(parser.parse_args().base.rstrip('/'))
