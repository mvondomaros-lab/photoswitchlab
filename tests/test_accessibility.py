"""Check shared scientific identities and equivalent protocol packaging."""

from zipfile import ZipFile
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
