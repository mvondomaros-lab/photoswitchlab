"""Build the editable German protocol from the app's task titles and outputs.

Requires python-docx and lxml in a document-authoring environment, not in the app.
Render and visually inspect the DOCX after running this script; see docs/development.md.
"""

from pathlib import Path
import argparse
import json
import re

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from lxml import html

ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "src/photoswitchlab/web/static"
OUTPUT = STATIC / "materials/protokollvorlage.docx"


def build(text_based=False):
    branding = json.loads((STATIC / "branding.json").read_text())
    course_subtitle = branding["subtitle"] + branding["course_suffixes"]["marburg"]
    source_name = "guide-accessible.html" if text_based else "guide.html"
    source = html.fromstring((STATIC / source_name).read_text())
    tasks = {el.get("id"): el for el in source.xpath('.//details[@class="task"]')}
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.top_margin = sec.bottom_margin = Cm(1.8)
    sec.left_margin = sec.right_margin = Cm(2)
    normal = doc.styles["Normal"]
    normal.font.name, normal.font.size = "Arial", Pt(10.5)
    normal.font.color.rgb = RGBColor.from_string("192D43")
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.12
    for name, size in [("Title", 25), ("Heading 1", 18), ("Heading 2", 13)]:
        style = doc.styles[name]
        style.font.name, style.font.size = "Arial", Pt(size)
        style.font.color.rgb = RGBColor(0, 0, 0)
        style.paragraph_format.space_before = Pt(12)
        style.paragraph_format.space_after = Pt(7)
    subtitle = doc.styles["Subtitle"]
    subtitle.font.name, subtitle.font.size = "Arial", Pt(14)
    subtitle.font.color.rgb = RGBColor(0, 0, 0)
    subtitle.paragraph_format.space_after = Pt(10)
    for border in doc.styles.element.xpath(".//w:pBdr"):
        border.getparent().remove(border)
    doc.core_properties.title = "Molekulare Photoschalter"
    doc.core_properties.subject = course_subtitle + " · Praktikumsprotokoll"
    doc.core_properties.author = branding["project_name"] + " · Universität Marburg"
    lang = OxmlElement("w:lang")
    lang.set(qn("w:val"), "de-DE")
    normal.element.get_or_add_rPr().append(lang)
    # The footer shows only the page number; the license travels in the metadata.
    doc.core_properties.comments = (
        "Vorlage: PhotoSwitchLab · Michael von Domaros · CC BY-SA 4.0 · "
        "https://mvondomaros-lab.github.io/photoswitchlab/lizenz/"
    )
    footer = sec.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    field = OxmlElement("w:fldSimple")
    field.set(qn("w:instr"), "PAGE")
    footer._p.append(field)
    number = footer.add_run("1")
    field.append(number._r)
    number.font.size = Pt(9)
    number.font.color.rgb = RGBColor.from_string("586B80")

    def formatted_text(para, text):
        for part in re.split(r"(E(?:trans|cis|TS|max)|ΔE(?:‡|max))", text):
            if part in ("Etrans", "Ecis", "ETS", "Emax"):
                para.add_run("E")
                para.add_run(part[1:]).font.subscript = True
            elif part == "ΔE‡":
                para.add_run("ΔE")
                para.add_run("‡").font.superscript = True
            elif part == "ΔEmax":
                para.add_run("ΔE")
                para.add_run("max").font.subscript = True
            else:
                para.add_run(part)
        return para

    def p(text, style=None):
        return formatted_text(doc.add_paragraph(style=style), text)

    def answer(text="[Ihre Antwort]"):
        para = p(text)
        for run in para.runs:
            run.font.color.rgb = RGBColor.from_string("586B80")

    def figure(text):
        answer(text)
        p("\n")

    def words(el):
        return " ".join(el.text_content().split())

    def own_words(li):
        # A list item's text without its nested list.
        copy = html.fromstring(html.tostring(li))
        for nested in copy.xpath("./ul|./ol"):
            nested.drop_tree()
        return words(copy)

    def task(task_id, *, new_page=False):
        el = tasks[task_id]
        heading = doc.add_heading(el.find("summary").text.strip(), 2)
        heading.paragraph_format.page_break_before = new_page
        for paragraph in el.xpath('./p[@class="task-question"]'):
            p(words(paragraph)).runs[0].font.italic = True
        if text_based:
            # The text protocol carries the full task, so it can be used on its own.
            for child in el.xpath("./p[not(@class)]|./ol"):
                if child.tag == "p":
                    p(words(child))
                    continue
                for number, step in enumerate(child.findall("li"), 1):
                    p(f"{number}. {own_words(step)}")
                    for item in step.xpath("./ul/li"):
                        p(words(item), "List Bullet 2")
        output = el.xpath('./div[@class="protocol-output"]')[0]
        label = p("Für Ihr Protokoll:")
        label.runs[0].font.bold = True
        label.paragraph_format.keep_with_next = True
        items = output.xpath("./ul/li")
        for index, item in enumerate(items):
            para = p(words(item), "List Bullet")
            para.paragraph_format.keep_together = True
            para.paragraph_format.keep_with_next = index < len(items) - 1

    def table(headers, rows, widths):
        t = doc.add_table(rows=1, cols=len(headers))
        t.autofit = False
        for col, width in zip(t.columns, widths):
            col.width = Cm(width)
        for c, name, width in zip(t.rows[0].cells, headers, widths):
            formatted_text(c.paragraphs[0], name)
            c.width = Cm(width)
        for row in rows:
            for c, value, width in zip(t.add_row().cells, row, widths):
                formatted_text(c.paragraphs[0], value)
                c.width = Cm(width)
        for i, row in enumerate(t.rows):
            trpr = row._tr.get_or_add_trPr()
            no_split = OxmlElement("w:cantSplit")
            trpr.append(no_split)
            if i == 0:
                trpr.append(OxmlElement("w:tblHeader"))
            for c in row.cells:
                pr = c._tc.get_or_add_tcPr()
                shade = OxmlElement("w:shd")
                shade.set(
                    qn("w:fill"),
                    "102238" if i == 0 else ("F3F6FA" if i % 2 else "FFFFFF"),
                )
                pr.append(shade)
                margins = OxmlElement("w:tcMar")
                for side in ("top", "left", "bottom", "right"):
                    margin = OxmlElement("w:" + side)
                    margin.set(qn("w:w"), "90")
                    margin.set(qn("w:type"), "dxa")
                    margins.append(margin)
                pr.append(margins)
                borders = OxmlElement("w:tcBorders")
                for side in ("top", "left", "bottom", "right"):
                    border = OxmlElement("w:" + side)
                    border.set(qn("w:val"), "single")
                    border.set(qn("w:sz"), "4")
                    border.set(qn("w:color"), "D9D9D9")
                    borders.append(border)
                pr.append(borders)
                align = OxmlElement("w:vAlign")
                align.set(qn("w:val"), "center")
                pr.append(align)
                for para in c.paragraphs:
                    para.paragraph_format.space_after = Pt(2)
                    para.paragraph_format.keep_with_next = i < len(t.rows) - 1
                    for run in para.runs:
                        run.font.size = Pt(9)
                        if i == 0:
                            run.font.bold = True
                            run.font.color.rgb = RGBColor(255, 255, 255)
        p("")

    substituents = ["CH₃", "OCH₃", "N(CH₃)₂", "CF₃", "CN", "NO₂"]
    attachments = "Anlagen: [Dateinamen der gespeicherten Ergebnisberichte]"

    doc.add_heading("Molekulare Photoschalter", 0)
    doc.add_paragraph(course_subtitle, "Subtitle")
    p("Praktikumsprotokoll" + (" ohne Abbildungen" if text_based else ""))
    p("Name: [Name]    Gruppe: [Gruppe]    Datum: [Datum]")
    if text_based:
        p(
            "Dokumentieren Sie Ihre Berechnungen und deren Interpretation. Die Überschriften entsprechen den "
            "Versuchsschritten und Aufgaben in der Webapp; die Aufgabentexte stehen jeweils dabei. Übertragen Sie "
            "die benötigten Werte aus der App und ergänzen Sie Ihre eigenen Deutungen. Wo eine Aufgabe Spektren "
            "verlangt, speichern Sie die Ergebnisberichte und geben sie als Anlage ab. Ersetzen Sie die Angaben "
            "in eckigen Klammern; die Felder erweitern sich beim Schreiben."
        )
    else:
        p(
            "Dokumentieren Sie Ihre Berechnungen und deren Interpretation. Die Überschriften entsprechen den "
            "Versuchsschritten und Aufgaben in der Webapp. Ersetzen Sie die Angaben in eckigen Klammern und fügen "
            "Sie gespeicherte Abbildungen mit Beschriftungen ein. Die Felder erweitern sich beim Schreiben."
        )
    p(
        "Speichern Sie die Datei regelmäßig. Laden Sie das ausgefüllte Protokoll"
        + (" mit den Anlagen" if text_based else "")
        + " in ILIAS hoch. Die Grundlagen finden Sie unter https://mvondomaros-lab.github.io/photoswitchlab/theory/."
    )

    doc.add_heading("Struktur erstellen", 1)
    task("task-compare-configurations")
    answer("Unterschied zwischen cis und trans: [höchstens zwei Sätze]")
    task("task-identify-symmetry")
    answer(
        "Anzahl chemisch verschiedener trans-Azobenzole mit genau einer Methoxygruppe: [Anzahl]\n"
        "Symmetrieäquivalente Auswahlpositionen: [Gruppen]\n"
        "Begründung anhand der Symmetrie: [höchstens zwei Sätze]"
    )

    doc.add_heading("Struktur optimieren", 1).paragraph_format.page_break_before = True
    task("task-compare-optimized-geometries")
    answer("Vermutung vor den Optimierungen: [Ihre Vermutung]")
    table(
        ["Struktur", "Elektronische Energie / eV", "C–N=N–C / °", "Ringabstand / pm"],
        [
            [label, "[Wert]", "[Wert]", "[Wert]"]
            for label in (
                "cis-Startstruktur",
                "trans-Startstruktur",
                "cis-Minimumstruktur",
                "trans-Minimumstruktur",
            )
        ],
        [5, 4, 4, 4],
    )
    answer(
        "ΔE = Etrans − Ecis / (kJ/mol): [Wert]\n"
        "Strukturänderungen und Deutung des Vorzeichens: [höchstens drei Sätze]"
    )

    task("task-examine-substituent-geometry", new_page=True)
    answer("Vermutung zur Änderung der Ringstellung: [Ihre Vermutung]")
    table(
        ["Struktur", "C–N=N–C / °", "Ringabstand / pm"],
        [
            [label, "[Wert]", "[Wert]"]
            for label in (
                "unsubstituierte trans-Minimumstruktur",
                "2,6,2′,6′-Tetramethoxy-Startstruktur",
                "2,6,2′,6′-Tetramethoxy-Minimumstruktur",
            )
        ],
        [8, 4.5, 4.5],
    )
    if text_based:
        table(
            ["Atompaar benachbarter Gruppen", "Startstruktur / pm", "Minimumstruktur / pm"],
            [["[Atome und Gruppen]", "[Wert]", "[Wert]"]],
            [8, 4.5, 4.5],
        )
    else:
        figure("Startstruktur: [gleich ausgerichtete 3D-Ansicht einfügen und beschriften]")
        figure("Minimumstruktur: [gleich ausgerichtete 3D-Ansicht einfügen und beschriften]")
    answer(
        "Sterischer Einfluss und Vergleich mit unsubstituiertem trans-Azobenzol: [höchstens vier Sätze]"
    )

    task("task-analyze-reaction-path", new_page=True)
    if text_based:
        table(
            ["Pfadstruktur", "ΔE zum Anfang / (kJ/mol)", "C–N=N–C / °"],
            [[label, "[Wert]", "[Wert]"] for label in ("Anfang", "Energiemaximum", "Ende")],
            [5, 6, 6],
        )
    else:
        figure("[Energieprofil einfügen und beschriften]")
    table(
        ["Richtung", "ΔE‡ / (kJ/mol)", "ΔE‡ / RT bei 298 K"],
        [["trans → cis", "[Wert]", "[Wert]"], ["cis → trans", "[Wert]", "[Wert]"]],
        [5, 6, 6],
    )
    answer("Pfad, Verbindungsprüfung, Barrieren- und RT-Vergleich: [höchstens drei Sätze]")

    doc.add_heading("Spektrum berechnen", 1).paragraph_format.page_break_before = True
    task("task-compare-isomer-spectra")
    table(
        ["Konfiguration", "Emax / eV", "UV oder sichtbar", "Farbvorhersage", "Lichtdurchlässigkeit / %"],
        [
            ["cis", "[Wert]", "[Bereich]", "[Farbe]", "[Wert]"],
            ["trans", "[Wert]", "[Bereich]", "[Farbe]", "[Wert]"],
        ],
        [2.8, 3.0, 3.1, 3.8, 4.3],
    )
    answer(
        "Energiebereich, stärker absorbierende Konfiguration und Grenze der Vorhersage: [höchstens drei Sätze]"
    )

    task("task-compare-substituent-spectra", new_page=True)
    answer("Zugeordnete Reihe: [4-X, 2-X, 3-X oder 4,4′-X₂]")
    table(
        ["X", "Emax / eV", "ΔEmax / eV", "Farbvorhersage"],
        [[label, "[Wert]", "[Wert]", "[Farbe]"] for label in substituents],
        [3, 4.5, 4.5, 5],
    )
    answer("Kleinstes und größtes ΔEmax: [Derivate und Werte]")
    if text_based:
        answer(attachments)
    else:
        figure("Spektrum zum kleinsten ΔEmax: [Abbildung einfügen und beschriften]")
        figure("Spektrum zum größten ΔEmax: [Abbildung einfügen und beschriften]")
    answer("Trend und Abweichung: [höchstens vier Sätze]")

    task("task-compare-substituent-series", new_page=True)
    table(
        ["X", "2-X / eV", "3-X / eV", "4-X / eV", "4,4′-X₂ / eV"],
        [[label, "[Wert]", "[Wert]", "[Wert]", "[Wert]"] for label in substituents],
        [2.0, 3.5, 3.5, 3.5, 4.5],
    )
    answer("Übergreifender Trend 1 mit konkreten Werten: [Trend und Belege]")
    answer("Übergreifender Trend 2 mit konkreten Werten: [Trend und Belege]")
    answer("Abweichung oder begrenzter Gültigkeitsbereich: [Beobachtung]")

    final_task_start = len(doc.paragraphs)
    task("task-plan-experiment-series", new_page=True)
    answer(
        "Positionen und Substituenten: [Auswahl]\n"
        "Ziel und Bezug zur systematischen Reihe: [Ziel und Begründung]\n"
        "Vermutung vor den Rechnungen: [Ihre Vermutung]"
    )
    table(
        ["Konfiguration", "Emax / eV", "Farbvorhersage", "Lichtdurchlässigkeit / %"],
        [["cis", "[Wert]", "[Farbe]", "[Wert]"], ["trans", "[Wert]", "[Farbe]", "[Wert]"]],
        [3.5, 4.0, 4.5, 5.0],
    )
    if text_based:
        answer(attachments)
    else:
        figure("cis: [Spektrum einfügen und beschriften]")
        figure("trans: [Spektrum einfügen und beschriften]")
    answer(
        "Prüfung der Vermutung: [Stützt das Ergebnis Ihre Vermutung, widerspricht es ihr "
        "oder ist keine eindeutige Aussage möglich?]"
    )
    table(
        ["Gruppenrekord", "Positionen und Substituenten", "Wert"],
        [
            ["Kleinstes Emax", "[Auswahl]", "[Emax und Konfiguration]"],
            [
                "Größter Unterschied zwischen cis und trans",
                "[Auswahl]",
                "[gewählte Photonenenergie, relative Absorption cis und trans]",
            ],
        ],
        [5, 5.5, 6.5],
    )
    if text_based:
        # Keep the final task and its compact results table on the same page.
        for para in doc.paragraphs[final_task_start:]:
            para.paragraph_format.space_after = Pt(4)
    output = OUTPUT.with_name("protokollvorlage-text.docx") if text_based else OUTPUT
    output.parent.mkdir(parents=True, exist_ok=True)
    doc.save(output)
    print(output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--text",
        action="store_true",
        help="Build the protocol without figures instead of the visual protocol.",
    )
    build(text_based=parser.parse_args().text)
