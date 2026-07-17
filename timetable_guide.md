# Timetable Generator — Complete Guide

The Timetable Generator is a constraint-based scheduler that automatically creates collision-free timetables for your school. It has **6 tabs** you work through sequentially.

---

## 1. Template Tab (Foundation)

Defines the **time grid** — which days and periods exist.

### Create a Template
- **Template Name** — e.g. "Default Timetable" or "2025/2026 Timetable"
- **Applies To** — comma-separated class levels (e.g. `JSS1,JSS2`). Leave empty to apply to **all** levels.

### Select a Template
Pick from the dropdown to configure days and periods.

### Teaching Days
Toggle each day (Mon–Fri) on/off. Non-teaching days (like a mid-week holiday) are excluded from scheduling.

### Periods
Define your school's period structure. Each period has:
- **Period Number** — display order (1, 2, 3...)
- **Start Time** / **End Time** — e.g. 08:00 – 08:40
- **Period Type**:
  - `Teaching` — available for subject scheduling
  - `Break` — recess time, skipped by the solver
  - `Assembly` — whole-school gathering, skipped by the solver
  - `Fixed` — reserved for fixed activities, skipped by the solver

> **Only "Teaching" periods are used by the generation algorithm.** Add all your actual teaching periods here. Breaks and assemblies are listed for reference so the generated timetable reflects the full school day.

---

## 2. Requirements Tab (What to teach)

Defines **how many periods** each subject needs per week, per class.

### Add a Requirement

| Field | Description |
|-------|-------------|
| **Class** | Select the class this requirement applies to. Only classes with subjects linked via **Class Subjects** page appear. |
| **Subject** | Filtered automatically to show only subjects linked to the selected class. |
| **Weekly Periods** | How many 40-minute (or whatever your period length is) periods this subject gets per week. |
| **Time Preference** | `Any` / `Morning` / `Afternoon` — the solver will try to honour this. |
| **Allow double periods** | If checked, the subject can take two consecutive periods (useful for practicals). If unchecked, only one period per day. |
| **Is practical** | Marks this as a practical subject for rule evaluation. |

### Example
To give JSS1A Mathematics 5 periods per week:
```
Class: JSS1A → Subject: Mathematics → Weekly Periods: 5 → Save
```

### Requirement Table
Shows all saved requirements. Delete any with the red link.

---

## 3. Staff Availability Tab (Who teaches when)

Sets each teacher's **maximum load** per day and per week.

### Add Availability

| Field | Description |
|-------|-------------|
| **Staff** | Select a teacher |
| **Day** | Monday through Friday |
| **Max Periods/Day** | How many periods this teacher can handle on this day (default: 8) |
| **Max Periods/Week** | Their total weekly capacity (default: 40) |

> You must save an entry for **each day** a teacher works. Teachers with no availability record for a day won't be scheduled on that day.

### Availability Overview
A matrix showing all teachers and their per-day max. Cells show `X/day` or `—` (no limit set).

---

## 4. Rules Tab (Constraints)

Optional rules that guide (or restrict) the solver. Each rule is either **Hard** (cannot be violated) or **Soft** (violations reduce the score).

### Rule Types

| Rule | Type | What it does | Example Parameters |
|------|------|-------------|-------------------|
| **Max Consecutive Periods** | Hard/Soft | Limits how many periods in a row a subject/teacher can have | `{"max": 3}` |
| **Max Subject Periods/Day** | Hard/Soft | Caps a subject's daily periods for any class | `{"max": 2}` |
| **Fixed Period Assignment** | Hard | Pins a subject/teacher to a specific time slot | `{"day": 1, "period": 2, "subjectId": "..."}` |
| **Subject Time Preference** | Soft | Penalises scheduling a subject outside its preferred window | `{"subjectId": "...", "preference": "morning"}` |
| **Max Teacher Subjects** | Hard/Soft | Limits how many different subjects one teacher can handle | `{"max": 4}` |
| **Practical Double Period** | Hard | Ensures practical subjects always get consecutive double slots | `{}` |

### Parameters (JSON)
Each rule accepts parameters as a JSON object. Examples:
- `{"max": 2}` — limits to 2
- `{"max": 3, "subjectId": "abc123"}` — limit specific subject
- `{"subjectId": "abc123", "preference": "morning"}` — time preference

### Hard vs Soft
- **Hard constraints** are absolute — the solver will never violate them, even if it means leaving slots empty.
- **Soft constraints** use a **Weight** (1–100) to determine penalty severity. Higher weight = bigger score penalty if violated.

---

## 5. Rooms Tab (Physical spaces)

Optional. Define room types and specific rooms for subjects that need specialised spaces.

### Room Types
Create categories like "Physics Lab", "Computer Lab", "Art Studio".

### Rooms
Add individual rooms under each type:
- **Name** — e.g. "Lab 101"
- **Type** — link to a room type
- **Capacity** — student capacity

> Rooms are stored for reference but the current solver doesn't assign them yet. Future updates will allow subject-level room requirements.

---

## 6. Generate Tab (Run the solver)

The solver runs a **backtracking constraint satisfaction algorithm** to fill the timetable grid.

### How the solver works

1. It calculates the **total slots**: `classes × teaching days × teaching periods`
2. For each class, it counts the total weekly periods needed from the Requirements
3. It iterates class-by-class, slot-by-slot, trying to place a subject
4. For each placement attempt it checks:
   - Does this subject still need periods for this class?
   - Is a qualified teacher available (has load capacity on this day/week)?
   - Is the teacher's daily/weekly max respected?
   - Does the subject allow double periods (checking daily cap)?
   - Do all hard rules pass?
5. Assignments that pass all checks are committed
6. After all classes, a score is calculated (starts at 1000, −100 per violation, minimum 0)

### Generate Button
Click to run. The generation is done server-side; the page updates with results.

### Results

| Indicator | Meaning |
|-----------|---------|
| **Success** | All required periods were placed, no hard violations |
| **Partial** | Some periods couldn't be placed (check violations list) |
| **Score** | 0–1000. Higher = better schedule. Each unplaced period or soft violation reduces the score |

### Violations
Listed issues like:
- `Could only place 4/5 periods for JSS1A` — not enough slots
- Hard constraint conflicts (e.g. fixed period clashes)

### Generated Timetables
Shows history of all generated timetables with their scores. Select one to view entries.

### Publish to Timetable
Once satisfied with a generated timetable, click **Publish to Timetable** to copy it to the main **Timetable** view (the manual period-by-period grid at the top of the page). Published entries can be manually adjusted there.

---

## Prerequisites Checklist

Before generating, ensure:

- [ ] **Template** has at least one teaching day and one teaching period
- [ ] **Requirements** exist (at least one class → subject → period count)
- [ ] **Staff availability** set for all teachers involved
- [ ] **Class Subjects** are linked (via `/class-subjects` page)
- [ ] A **current session** and **current term** are active in the system
- [ ] The **Timetable Generator addon** is active for your school

---

## Common Pitfalls

| Symptom | Likely Cause |
|---------|-------------|
| "No timetable template configured" | Haven't created a template in the Template tab |
| "No teaching days/periods" | Template has days/periods but none marked as "Teaching" type |
| "No current session/term found" | School needs an active session and term set |
| "Could only place X/Y periods" | Not enough teaching periods in the day, or too many requirements for available slots |
| Subjects missing from requirements dropdown | The selected class doesn't have the subject linked via Class Subjects |
| Teacher not being assigned | No availability record for that teacher on that day, or daily/weekly max reached |
| Generation seems random | The solver uses random shuffling for variety. Run multiple times for better results |
