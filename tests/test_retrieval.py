import json
import fitz
import pytest
from fastapi.testclient import TestClient
from app.main import app
from rag import ingest

@pytest.fixture
def corpus(tmp_path, monkeypatch):
    monkeypatch.setattr(ingest, 'DATA', tmp_path / 'index')
    monkeypatch.delenv('TUTOR_EMBED_MODEL', raising=False)
    monkeypatch.delenv('TUTOR_LLM_MODEL', raising=False)
    books = json.loads(ingest.MANIFEST.read_text())
    for grade, subject, text in [(11,'Chemistry','Chapter 1\nIonization energy is the energy required to remove an electron from a gaseous atom.'),(9,'Computer','Chapter 1\nA computer processes data using hardware and software.')]:
        book = next(b for b in books if b['grade']==grade and b['subject']==subject)
        book = {k:v for k,v in book.items() if k not in ['size','chapter_starts']}
        doc = fitz.open(); page=doc.new_page(); page.insert_text((72,72),text)
        path=tmp_path / (subject+'.pdf'); doc.save(path); doc.close()
        assert ingest.ingest(path,book)=='indexed'
        assert ingest.ingest(path,book)=='unchanged'
    return TestClient(app), books

def test_filtered_evidence(corpus):
    client, books=corpus
    book=next(b for b in books if b['grade']==11 and b['subject']=='Chemistry')
    query={'grade':11,'subject':'Chemistry','textbook':book['id'],'chapter':'1','query':'What is ionization energy?'}
    result=client.post('/api/v1/chat',json=query).json()
    assert result['grounded'] and result['citations'][0]['page']==1
    assert 'electron' in result['answer']
    assert not client.post('/api/v1/chat',json={**query,'chapter':'99'}).json()['grounded']
    assert not client.post('/api/v1/chat',json={**query,'query':'Who won the football world cup?'}).json()['grounded']
    assert client.post('/api/v1/search',json={**query,'subject':'Computer'}).status_code==422
    assert client.post('/api/v1/search',json={**query,'textbook':'missing'}).status_code==404
    assert client.post('/api/v1/search',json={**query,'query':'   '}).status_code==422

def test_other_grade_subject(corpus):
    client, books=corpus
    book=next(b for b in books if b['grade']==9 and b['subject']=='Computer')
    result=client.post('/api/v1/chat',json={'grade':9,'subject':'Computer','textbook':book['id'],'chapter':'1','query':'computer hardware'}).json()
    assert result['grounded'] and all(c['book_id']==book['id'] for c in result['citations'])
