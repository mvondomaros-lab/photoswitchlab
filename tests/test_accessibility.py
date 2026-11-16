"""Check shared scientific identities and equivalent protocol packaging."""

from zipfile import ZipFile
from html import unescape
import re
import xml.etree.ElementTree as ET

from fastapi.testclient import TestClient

from photoswitchlab import azobenzene
from photoswitchlab.web.server import STATIC, create_app
from photoswitchlab.web.worker import molecule


def test_atom_graph_exposes_all_ring_positions_without_changing_atom_order():
    template = azobenzene.Template(configuration="trans")
    record = molecule(template.atoms, "trans", mol=template.molh)
    graph = record["atom_graph"]
    assert len(graph) == record["atom_count"]
    assert [atom["number"] for atom in graph] == list(range(1, len(graph) + 1))
    assert {atom["position"] for atom in graph if atom["position"]} == {
        f"C{i}{suffix}" for suffix in ("", "′") for i in range(1, 7)
    }
    for atom in graph:
        for neighbor in atom["neighbors"]:
            reverse = graph[neighbor["number"] - 1]["neighbors"]
            assert {
                "number": atom["number"],
                "bond_order": neighbor["bond_order"],
            } in reverse


def test_both_protocols_available_in_course_with_same_task_headings():
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    headings = []
    for filename in ("protokollvorlage.docx", "protokollvorlage-text.docx"):
        with ZipFile(STATIC / "materials" / filename) as archive:
            tree = ET.fromstring(archive.read("word/document.xml"))
        headings.append(
            [
                "".join(p.itertext())
                for p in tree.findall(".//w:p", ns)
                if p.find("w:pPr/w:pStyle[@w:val='Heading2']", ns) is not None
            ]
        )
        assert tree.findall(".//w:tblHeader", ns)
        with TestClient(create_app(course="marburg")) as client:
            assert client.get(f"/static/materials/{filename}").status_code == 200
        with TestClient(create_app()) as client:
            assert client.get(f"/static/materials/{filename}").status_code == 404
    assert headings[0] == headings[1]
    assert len(headings[0]) == 9


def task_blocks(source):
    """Return (id, body) for each task, including nested hint details."""
    blocks = []
    for start in re.finditer(r'<details class="task" id="([^"]+)">', source):
        depth, position = 1, start.end()
        for tag in re.finditer(r"<(/?)details\b", source[position:]):
            depth += -1 if tag[1] else 1
            if not depth:
                blocks.append((start[1], source[position : position + tag.start()]))
                break
    return blocks


def test_autonomous_accessible_tasks_are_shared_with_text_protocol_and_course_filtered():
    source = (STATIC / "guide-accessible.html").read_text()
    tasks = task_blocks(source)
    assert len(tasks) == len({task_id for task_id, _ in tasks}) == 9
    with ZipFile(STATIC / "materials/protokollvorlage-text.docx") as archive:
        tree = ET.fromstring(archive.read("word/document.xml"))
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    document_text = " ".join(
        "".join(paragraph.itertext()) for paragraph in tree.findall(".//w:p", ns)
    )
    for _, task in tasks:
        # The hint stays in the app; question, steps and deliverables go into the protocol.
        printed = re.sub(r'<details class="task-hint">.*?</details>', "", task, flags=re.S)
        printed = re.sub(r"<li>([^<]*)<ul>.*?</ul>", r"<li>\1</li>", printed, flags=re.S)
        for paragraph in re.findall(r"<(?:p|li)[^>]*>(.*?)</(?:p|li)>", printed, re.S):
            wording = " ".join(unescape(re.sub(r"<[^>]+>", "", paragraph)).split())
            if wording != "Für Ihr Protokoll:":
                assert wording in document_text
        for unavailable_action in (
            "Strukturerkundung",
            "merken",
            "Dropdown",
            "Popup",
            "Abbildung einfügen",
            "tastbare",
            "ohne Bilder",
        ):
            assert unavailable_action not in task
    assert "gemerkten" not in document_text
    assert "Ergebnisberichte und geben sie als Anlage ab" in document_text
    # Both task routes name colors wherever spectra are compared; none is optional.
    for task_id, task in tasks:
        if task_id in {
            "task-compare-isomer-spectra",
            "task-compare-substituent-spectra",
            "task-plan-experiment-series",
        }:
            assert "Farb" in task
    assert "Pflichtabgaben" not in source
    assert "Farbabstand" not in source
    table_text = " ".join(
        "".join(table.itertext()) for table in tree.findall(".//w:tbl", ns)
    )
    assert table_text.count("Farbvorhersage") == 3
    assert table_text.count("Lichtdurchlässigkeit") == 2
    assert "Gruppenrekord" in table_text
    assert "relative Absorption cis und trans" in table_text
    with TestClient(create_app(course="marburg")) as client:
        course_response = client.get("/static/guide-accessible.html")
    assert course_response.status_code == 200
    assert "protokollvorlage-text.docx" in course_response.text
    assert "jeder Person" in course_response.text
    with TestClient(create_app()) as client:
        public_response = client.get("/static/guide-accessible.html")
    assert public_response.status_code == 200
    assert public_response.text.count('<details class="task"') == 9
    for course_only in (
        "Protokoll",
        "ILIAS",
        "jeder Person",
        "protocol-output",
        "course:marburg",
    ):
        assert course_only not in public_response.text
