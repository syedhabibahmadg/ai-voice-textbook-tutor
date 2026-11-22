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
    monkeypatch.setenv('AI_PROVIDER','extractive')
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


def test_whole_book_searches_other_chapters_without_crossing_books(corpus):
    client, books = corpus
    book = next(b for b in books if b['grade'] == 11 and b['subject'] == 'Chemistry')
    with ingest.connect() as db:
        db.execute('INSERT INTO chunks VALUES(?,?,?,?,?)', ('whole-book:2', book['id'], '2', 7, 'A covalent bond forms when atoms share electrons in a molecule.'))
    query = {'grade': 11, 'subject': 'Chemistry', 'textbook': book['id'], 'chapter': None, 'query': 'covalent bond'}
    result = client.post('/api/v1/chat', json=query).json()
    assert result['grounded']
    assert result['citations'][0]['page'] == 7
    assert all(c['book_id'] == book['id'] for c in result['citations'])
    assert not client.post('/api/v1/chat', json={**query, 'chapter': '1'}).json()['grounded']


def test_conversational_whole_book_question(corpus):
    client, books = corpus
    book = next(b for b in books if b['grade'] == 11 and b['subject'] == 'Chemistry')
    result = client.post('/api/v1/chat', json={'grade':11,'subject':'Chemistry','textbook':book['id'],'chapter':None,'query':'Can you please tell me about ionization energy?'}).json()
    assert result['grounded'] and result['citations'][0]['page'] == 1


def test_reviewed_chapter_ranges_override_mentions_and_separate_backmatter(tmp_path,monkeypatch):
    monkeypatch.delenv('TUTOR_OCR_LANG',raising=False)
    path=tmp_path/'mapped.pdf'
    doc=fitz.open()
    for text in ['Chapter 1 Introductory concepts and their detailed explanation.','Chapter 9 is referenced here but this page still belongs to chapter one.','Chapter 2 Second chapter concepts and detailed explanation.','Answers for all chapters and additional reference material.']:
        page=doc.new_page();page.insert_text((72,72),text)
    doc.save(path);doc.close()
    pages,_,_=ingest.extract(path,{'chapter_starts':[1,3],'chapter_end':3})
    assert [p[1] for p in pages]==['1','1','2','backmatter']


def test_reviewed_class11_catalog_ranges_are_complete_and_valid():
    books=json.loads(ingest.MANIFEST.read_text(encoding='utf-8'))
    expected={'Biology':12,'Computer':9,'English':14,'Physics':12,'Math':14,'Chemistry':16}
    for subject,count in expected.items():
        book=next(b for b in books if b['grade']==11 and b['subject']==subject)
        starts=book['chapter_starts']
        assert len(starts)==count and starts==sorted(set(starts))
        assert 1<=starts[0]<=starts[-1]<=book.get('chapter_end',book['page_count'])<=book['page_count']
        if book.get('chapter_titles'):assert len(book['chapter_titles'])==count
