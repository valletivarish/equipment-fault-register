# UI plan — Equipment Fault Register

**Main task:** a workshop coordinator keeps track of faulty shared equipment until it is
repaired or written off. **Primary action:** "Report fault".

## Composition

```
+--------------------------------------------------------------------------+
| Fault register             4 open · 1 repaired            [Report fault] |  compact top bar
+------------------------------------------+-------------------------------+
| Tag        Equipment       Reported Status| Pillar drill                  |
|------------------------------------------| WS-DRILL-04                   |
|▌WS-DRILL-04 Pillar drill   20 Oct  In rep| Status   In repair            |
| WS-SAW-02  Band saw        18 Oct  Report| Reported 20 Oct 2026          |
| ...                                      | Chuck wobbles at high speed…  |
|                                          | [Edit fault] [Delete fault]   |
+------------------------------------------+-------------------------------+
        register (about 60%)                   detail / form panel (about 40%)
```

- **Navigation:** one compact top bar with the title, an open/repaired count and the
  "Report fault" button. No sidebar, no dashboard.
- **First screen:** the register table on the left, and on the right a panel that asks the user to
  pick a fault or report a new one.
- **Record view:** a search box and status filter chips sit above the register. Each fault is
  one table row: asset tag, equipment name, location, reported date, status. Column headings sort
  the register, and a footer pages through it ten rows at a time. Clicking a row opens its details in the side panel (`/faults/:id`). The selected
  row is highlighted in light blue.
- **Repair log:** under the fault's details, a one-line form adds a dated note; each note can be
  edited in place or deleted after an inline confirmation.
- **Create/edit placement:** the form opens in the same side panel (`/faults/new`,
  `/faults/:id/edit`), so the register stays visible while typing. Delete asks for confirmation
  inside the panel ("Delete this fault?" with Delete and Keep buttons), not in a browser pop-up.
- **Narrow screens (<820px):** the panel stacks below the register. When a fault or form is open,
  only the panel shows, with a "Back to register" link.

## Visual direction

Reference: "Opsen - Maintenance Dashboard" by Reshma on Dribbble
(https://dribbble.com/shots/26790557-Opsen-Maintenance-Dashboard). Its visual language is used:
a white header and panels, a light grey work area, thin borders and tinted status pills. Its
sidebar, stat cards and job-card grid are not used.

- **Surfaces:** page `#F7F8FA`, white header and panels, 1px `#E5E7EB` borders, 6px corners, no
  shadows or gradients.
- **Accent:** one blue `#1565D8` for the primary button, links, focus rings and the selected row
  (`#E8F0FC`). Red `#C81E1E` is used only for delete and errors.
- **Status:** a pill with a dot and the status word (Open red, In progress indigo, Waiting for
  parts orange, Fixed green, Not repairable grey). The word is always present, so colour is never
  the only signal.
- **Type:** Nunito Sans 400/600/700, bundled with the app (no external font requests).
- **Buttons and forms:** plain 36px buttons (filled blue primary, white secondary with a grey
  border), 40px inputs with a grey border that turns blue on focus.

## Comparison with the closest catalogue proposal (9, Building Leak Report Register)

Proposal 9 also puts an index beside a detail page. Differences in layout and interaction:
(1) this register is a multi-column table of dense rows rather than a narrow text-first list;
(2) create and edit happen in the side panel while the register stays visible, whereas
Proposal 9 replaces the detail with a form; (3) there is a top bar with a global "Report fault"
action and live counts, whereas Proposal 9 keeps the report action with the report;
(4) delete confirmation is inline in the panel. Visual differences beyond colour: tinted
status pills in a bordered table versus severity written in running text; white bordered panels
on a grey work area versus a single document-style reading page.
