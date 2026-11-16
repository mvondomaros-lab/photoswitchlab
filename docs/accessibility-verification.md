# Accessibility verification with assistive technology

Automated checks (unit tests, axe-core, headless Chrome) cannot show whether a blind
or low-vision student can complete the course. This checklist covers what has never
been tested: real screen readers, Braille output, magnification software, and the
students themselves. It is sized for one instructor session of about two hours plus
one session with each student before the course.

Record every check in the log at the end. A check passes when the student-facing
outcome is reached without sighted help; awkward but workable behavior is a note,
not a failure.

## Setup

| Tool | Where | Purpose |
|---|---|---|
| NVDA (free) with Chrome and Firefox | Windows PC or VM | Main screen-reader run |
| NVDA Braille Viewer (Tools menu) | same | Approximates what a Braille display shows |
| JAWS demo (40-minute sessions) with Chrome | same | The blind student's screen reader |
| Windows Magnifier and a contrast theme | same | Low-vision run |
| VoiceOver with Safari | Mac | Secondary check, including Safari audio |
| Word with JAWS or NVDA | same Windows machine | Protocol template |
| Headphones | | Sonification |

Use the deployed course server, not localhost, so that latency and session timeout
match the course. Start every run in the accessible mode via the header switch;
check once that the choice persists across a reload.

## Instructor run with NVDA, then JAWS

Run the whole list with NVDA first. Repeat the items marked **J** with JAWS, since
JAWS and NVDA differ most in live regions, select menus and virtual-cursor handling.

### Orientation

1. **J** Heading navigation (H, 1–3) reaches the task list, the step panel, the
   structure section and the results in a sensible order.
2. **J** Switching between the three steps announces the new step and moves focus to
   its heading.
3. Opening the task panel, opening one task and returning to the workspace works
   with the keyboard alone.

### Task 1: configurations

4. **J** Creating cis- and trans-azobenzene announces success; the structure select
   lists both entries.
5. The structure report reads composition, connectivity and geometry as text and
   tables; table navigation (Ctrl+Alt+arrows) reads row and column headers.

### Task 2: symmetry

6. The position text alternative and the substituent selects identify positions
   2–6 and 2′–6′; the prime is spoken or shown in Braille (check the Braille Viewer:
   ′ may appear as an apostrophe or as a dot pattern).

### Task 3: minimum structures

7. **J** Starting an optimization announces the start and the end once each, with no
   repeated progress chatter; focus stays where it was.
8. **J** Energy, C–N=N–C dihedral and ring distance are readable for start and minimum
   structure; numbers keep their decimal commas and units in speech and Braille.
9. **J** The grouped structure select: groups are spoken or at least do not disrupt
   selection; each option is unambiguous on its own.
10. The unit converter converts an energy difference to kJ/mol.

### Task 4: steric effects

11. **J** The closest-contacts list reads short chemical names (for example
    “H der Methoxygruppe an C6 und H der Methoxygruppe an C6′ im zweiten Ring:
    267 pm”); choosing an entry announces the distance.
12. After the optimization, the chosen pair reads its distance in both start and
    minimum structure in one sentence.

### Task 5: reaction path

13. **J** The transition-structure search announces its result and the connection
    check; the key-value table gives ΔE and dihedral for start, maximum and end.
14. **J** The audible energy profile steps from path structure to path structure,
    speaks dihedral and ΔE in kJ/mol, and the pitch peaks at the maximum.

### Task 6: spectra

15. **J** The spectrum section reads Emax, assignment to UV or visible range,
    predicted color and weighted transmission.
16. **J** Sonification with headphones: focus the plot, arrow keys step through
    energies, the screen reader speaks energy, wavelength and absorption, the
    pitch follows absorption. Check also that H (help) and the escape from the plot
    work under JAWS, where the virtual cursor may intercept arrow keys.
17. The absorption comparison of cis and trans at the same energies is readable as
    a table.
18. Safari with VoiceOver: sonification plays sound on the first key press.

### Protocol and website

19. **J** The text protocol template opens in Word; headings and tables are navigable
    and the required entries can be filled in.
20. Website: pages read in heading order; formulas in the light and energy chapters
    are spoken as words and whole numbers (for example “2,5” not “2 comma 5” split
    across tokens); the position text alternative on the structure page is found.
21. Website practice field on the light page: in accessible mode the sonification
    works as in the app; in graphical mode no sound element exists.

## Low-vision run

22. Windows Magnifier at 200% and 400%: focus following keeps the focused control in
    view in each step; the focus ring is visible on every control type.
23. Browser zoom at 200% and 400% (reflow): no horizontal scrolling in the accessible
    mode; tables scroll within their own box.
24. Windows contrast theme (forced colors): the selected cis/trans segment, the
    selected working mode, focus rings and input borders remain visible; charts and
    the 3D view need not adapt, since the text results replace them.
25. Larger browser default font (Chrome settings, “very large”): text scales and
    nothing is clipped in the step panels.
26. Explanation popovers stay open while scrolling a little under magnification.

## Student sessions

Hold one short session with each student well before the first lab day, on their own
device and assistive technology. Ask them to work through task 1 and the first half
of task 3 while thinking aloud; intervene only when they are stuck for several
minutes. Ask afterwards:

- Which step took longest, and why?
- Was any announcement missing, repeated or confusing?
- Do they prefer the text protocol or the regular template?
- For the blind student: is the Braille output of numbers, primes and units
  readable? Is the sonification useful or distracting?
- For the low-vision student: do they work in the graphical or the accessible mode,
  and at which magnification?

Fix blocking issues before the course; collect the rest for after it.

## External help

The blista (Deutsche Blindenstudienanstalt) in Marburg advises on accessible
teaching materials and can check workflows with experienced screen-reader and
Braille users. Contacting them is worthwhile if the student sessions reveal problems
in Braille output or in reading formulas.

## Log

| # | Tool and browser | Date | Result | Note |
|---|---|---|---|---|
| | | | | |
