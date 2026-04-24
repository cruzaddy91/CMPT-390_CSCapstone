# Video for General Audience (Professional Development)

**Category:** Professional Development (PD) — not Capstone Project (CP).  
**Capstone demo:** Only the **Project Demo Video** counts toward CP.

| Field | Detail |
|--------|--------|
| **Points** | 3 |
| **Submit** | Website URL, media recording, or file upload |
| **Length** | Polished **2–3 minutes** (assignment text: over **90 seconds** and under **3 minutes**) |
| **Audience** | General public; may be shared at **Westminster Student Showcase (5/1)** |

## Core rules

- Show the **finished project** in use.
- **No code** in the presentation (no IDE, no source on screen).
- Mention **what technology you used**, but avoid **technical jargon** otherwise.
- Think **movie trailer**: most interesting parts, not rushed, not too much.

## Title page (before recording)

Create one full-screen title slide (PowerPoint or Google Slides works well: **Slide Show → From Current Slide**).

Include:

- Project title  
- Your name (optional: photo of you)  
- Affiliation: **Westminster University, CMPT 390: Senior Capstone**

**Practice** the talk several times before recording.

## Recording setup

- Hide desktop icons if the desktop might appear; prefer solid or on-brand desktop background.  
- **Open the running app**; use the **GUI**; **hide the IDE** so only the product is visible.  
- Open the title page in full screen (it will cover the app — that is OK).

**Software:** Use a recorder you are comfortable with; **MP4** is common. Record in a **quiet** place.

## Recording flow (as described in the assignment)

1. Start recording.  
2. On the **title page**: brief intro to the project and the programmer(s).  
3. **Pause** recording; close or minimize the title page so only the **running project** is visible.  
4. **Resume** recording for the demo portion.

## Closed captions

Add **accurate captions for the full video** (assignment requires captions throughout for Meets Expectation).

---

## Rubric: Meets Expectation

Your video must:

- [ ] Be **over 90 seconds** and **less than 3 minutes**  
- [ ] Include a **title screen**  
- [ ] **Highlight** the most important parts of the project  
- [ ] Include a **short demo** (no code)  
- [ ] Include **accurate captions** throughout  

## Rubric: Exemplary

Everything above, plus:

- [ ] **Polished and professional**  
- [ ] **Clear, well-organized, logical** structure; key ideas come through  
- [ ] **Enthusiastic, confident** delivery that **engages** and sustains interest  
- [ ] **Clear audio** and **high-resolution** visuals where applicable  

---

## Quick beat sheet (2–3 min) — draft here while building

| Time (approx.) | On screen | Say (plain language) |
|----------------|-----------|----------------------|
| 0:00–0:20 | Title page | Who you are, project name, one sentence “what it is for” |
| 0:20–2:40 | Live app only | 2–3 “hero” flows: problem → you use the app → outcome; name tools in one line |
| 2:40–2:55 | App or simple end card | One sentence impact / who it helps |
| — | Captions | Full coverage, synced to speech |

Adjust times to stay **under 3:00** with a safety margin after captions export.

---

## Project anchor (this repo)

Runnable product for demos: **`115-weightlifting/`** (Django + React). Use **`./bin/zw dev`** (or your usual flow) so the recording shows **only** the app in the browser, not the editor.

---

## Efficient completion workflow (start after last code change)

Goal: **one focused evening** (or two short blocks) from “feature complete” to **submit-ready MP4 with captions**, without re-recording because the app or script kept moving.

### 0. Handoff from implementation (5–10 min)

Do this **once** when you and the other agent agree the UI is stable enough to film:

- [ ] Run **`./bin/zw doctor`** (and your usual smoke path) so the demo build is trustworthy.  
- [ ] **Freeze the demo story**: pick **exactly 2–3 “hero” user flows** (e.g. coach sees X, athlete logs Y). Write their **click order** in 5–10 bullets — this is the only script the recording needs.  
- [ ] **Lock demo data**: one seed / user / program state you will use on camera; note how to reset it in one command or fresh login.  
- [ ] Rule: after this point, **no UI changes** unless you re-run the script timer and accept a possible re-record.

### 1. Assets and environment (15–20 min, can parallelize with 2)

- [ ] **Title slide** finished and tested full-screen on the **same display** you will record.  
- [ ] **Browser**: single window, sensible zoom (100–125%), bookmarks bar off, extensions that pop up notifications disabled.  
- [ ] **Desktop**: icons hidden, neutral wallpaper, **Do Not Disturb** on.  
- [ ] **Audio**: input level check; one test clip 20s — listen with headphones for hum/clipping.

### 2. Script polish (20–30 min)

- [ ] **Title segment** (15–25s spoken): name, project title, one plain-language sentence (“this helps coaches and athletes…”), optional teammate credit.  
- [ ] **Demo segment**: walk the hero flows **out loud** while clicking; use the assignment’s **non-jargon** rule; **one line** of stack (“web app built with …”) only.  
- [ ] **Time budget**: aim for **~2:00–2:30** total; staying under 3:00 is easier than cutting a tight 2:55.  
- [ ] **Two dry runs** with a phone timer — second run is the “dress rehearsal.”

### 3. Capture (30–45 min including retries)

- [ ] App running **before** you start; log in to the right account **before** title slide if that saves time.  
- [ ] Follow assignment flow: **record → title + intro → pause → app only → resume → demo → stop.**  
- [ ] If a take fails, **only re-record the failed segment** if your editor supports stitching; otherwise full re-take is still cheaper than endless perfect takes.  
- [ ] Export **MP4**; watch once at **100%** for stray IDE windows, cursor chaos, or wrong account.

### 4. Captions (often the real bottleneck — schedule explicitly)

- [ ] Auto-caption the full file, then **edit every line** for accuracy (names, domain words, “Sinclair,” etc.).  
- [ ] Spot-check: **opening**, **stack name line**, and **any fast demo** segments — errors cluster there.  
- [ ] Confirm LMS/player shows captions **throughout** (Meets Expectation requirement).

### 5. Rubric QA (10 min)

- [ ] Length: **>90s and <3:00** on the **final** file.  
- [ ] Meets checklist (title, highlights, demo, no code on screen, captions).  
- [ ] Exemplary pass: energy, pacing, audio clarity, sharp visuals (resolution + not blurry zoom).

### 6. Submit

- [ ] Upload / URL; play back **in the same environment a grader would use** (browser or download).

**Parallel agents:** keep implementation chats on **features and bugs**; keep this doc’s **hero flow list** as the single “video contract.” When the contract changes, update the list and assume **caption + possibly video** need another pass.
