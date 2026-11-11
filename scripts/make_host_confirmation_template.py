#!/usr/bin/env python3
"""Make the Word template for an STSM host's confirmation letter.

The grants application form (scripts/google-apps-script/grants/) links to the
result, assets/docs/eeg101-stsm-host-confirmation-template.docx. COST's own
template sits inside e-COST, which applicants only reach once their grant has
been accepted, so the application needs one of its own. It asks for what the
COST template asks for: who, where, what and when, and the host's agreement.

    python3 -m pip install python-docx
    python3 scripts/make_host_confirmation_template.py
"""

from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

OUT = Path(__file__).resolve().parent.parent / "assets/docs/eeg101-stsm-host-confirmation-template.docx"
BLUE = RGBColor(0x00, 0x00, 0x99)
MUTED = RGBColor(0x5A, 0x5A, 0x7A)


def shade(cell, colour):
    props = cell._tc.get_or_add_tcPr()
    fill = OxmlElement("w:shd")
    fill.set(qn("w:val"), "clear")
    fill.set(qn("w:color"), "auto")
    fill.set(qn("w:fill"), colour)
    props.append(fill)


def table(doc, rows):
    t = doc.add_table(rows=0, cols=2)
    t.style = "Table Grid"
    for label, hint in rows:
        cells = t.add_row().cells
        shade(cells[0], "F0EDE8")
        p = cells[0].paragraphs[0]
        p.add_run(label).bold = True
        if hint:
            r = p.add_run("\n" + hint)
            r.font.size = Pt(9)
            r.font.color.rgb = MUTED
        cells[1].paragraphs[0].add_run(" ")
    doc.add_paragraph()


def heading(doc, text):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.bold = True
    r.font.size = Pt(13)
    r.font.color.rgb = BLUE


def main():
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Arial"
    style.font.size = Pt(10.5)

    band = doc.add_table(rows=1, cols=1)
    cell = band.rows[0].cells[0]
    shade(cell, "000099")
    p = cell.paragraphs[0]
    r = p.add_run("EEG101 · Fundamentals of Open & Rigorous EEG Science")
    r.bold = True
    r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    r = p.add_run("\nCOST Action CA24148 · Short-Term Scientific Mission (STSM)")
    r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    doc.add_paragraph()

    title = doc.add_paragraph()
    r = title.add_run("Confirmation from the host")
    r.bold = True
    r.font.size = Pt(18)
    r.font.color.rgb = BLUE

    note = doc.add_paragraph()
    r = note.add_run(
        "To be completed and signed by the host (the academic lead at the host "
        "institution, or the named lead at the host organisation for an Industry "
        "STSM). The applicant uploads it as a PDF with their EEG101 grant "
        "application. Please use your institution's letterhead if you can."
    )
    r.font.color.rgb = MUTED
    r.font.size = Pt(9.5)

    heading(doc, "The applicant")
    table(doc, [
        ("Name", ""),
        ("Home institution and country", ""),
    ])

    heading(doc, "The host")
    table(doc, [
        ("Host institution or organisation", ""),
        ("Address and country", "Must be a different country from the applicant's home institution."),
        ("Name and position of the host", "The host must be a member of the EEG101 COST Action."),
        ("Email", ""),
    ])

    heading(doc, "The mission")
    table(doc, [
        ("Title of the STSM", ""),
        ("Start date", ""),
        ("End date", ""),
        ("Work to be carried out at the host", "In a few lines."),
    ])

    heading(doc, "Confirmation")
    doc.add_paragraph(
        "I confirm that the host institution or organisation named above agrees to "
        "receive the applicant for this Short-Term Scientific Mission on the dates "
        "given, and will give them access to the facilities, equipment and "
        "expertise the work needs. I am a member of the EEG101 COST Action "
        "(CA24148)."
    )
    doc.add_paragraph()
    table(doc, [
        ("Signature", ""),
        ("Name", ""),
        ("Date", ""),
    ])

    foot = doc.add_paragraph()
    foot.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = foot.add_run("www.eeg101.eu/grants/ · eeg101costaction@gmail.com")
    r.font.size = Pt(8.5)
    r.font.color.rgb = MUTED

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUT)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
