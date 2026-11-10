# Playtest 5: findings

**Date:** 2026-11-10. **Build:** /dev/ at 56e1e02 (develop with the juice, #27, and the sound, #28, merged before their playtests so one run covered all three). **Run:** seed `drf4yj`, the Hendersons, the General Contractor. Won 50,129 Wow against 37,490, the verdict "Charmer", all seven milestones, Drywall in overtime.

**How this was made:** from the user's notes, the end screen, and the run code's actions (decoded, not replayed). It covers playtest 4's changes (D-112 to D-114, D-119 to D-121, the re-fit D-123), the juice (D-124 to D-127, D-094's option 1, D-096) and the sound (D-128 to D-131).

---

## 1. The run in numbers

| Milestone | Score | Target | Lead | Playtest 4's lead |
|---|---|---|---|---|
| Groundbreaking | 46 | 23 | 2.0× | 7.1× |
| Foundation | 665 | 644 | 1.03× | 2.5× |
| Framing | 2,897 | 2,013 | 1.44× | 2.5× |
| Roofing | 5,769 | 5,578 | 1.03× | 1.9× |
| Drywall (overtime) | 13,073 | 11,730 | 1.11× | 1.34× |
| Finishes | 24,628 | 21,620 | 1.14× | 1.12× |
| Final Walkthrough (completed early) | 50,129 | 37,490 | 1.34× | 1.05× |

- The re-fit (D-123) took the early slack out: Foundation and Roofing were met by 3%, and Drywall needed overtime. The user called it harder than playtest 4 but possible.
- The last milestone was the loosest (1.34×, with the early completion's fast-forward in it). It's a note for the balance pass, which reads the sim, not a change from one run.
- **The run's actions (68):**
  - 22 pieces placed: 18 from the hand and 4 from the reserve
  - 10 rerolls: 8 Rooms and 2 Layout, with Rooms then Layout back to back twice
  - 6 Renovations (playtest 4 had none)
  - 2 change orders accepted
  - 11 purchases and a shop refresh
  - 3 demolitions
  - the final milestone completed early

## 2. What the user said, and what it settles

| Area | The user's words | What it settles |
|---|---|---|
| Overall | "shaping up to be real fun to play"; "we've done a good job of encouraging house structure and proper shape" | The layout work holds. Fusion and the layout data PR stay after the jam unless the user asks. |
| Hallways (D-114) | "the hallways felt good in this run and I did not end up bolting them to the outside just for their +2" | Accepted. The "between rooms" fallback isn't needed. |
| Difficulty (D-123) | "harder than the last time I played, but while challenging it still felt possible to complete" | Accepted. Milestone 2 keeps 560; the 450 step-down isn't needed. |
| The draw (D-121) | "two rows of the draw feel okay, but I think a reroll should reroll both sections of the draw instead of just one" | Accepted, with one change: **D-132**. |
| Creeks (D-119) | "the lack of creeks is okay, it was a bit crazy seeing them in pretty much every map" | Accepted. |
| The sun (D-120) | "The sunny side feels much better than the previous system we had" | Accepted. |
| Big weeks (D-124) | "The Good, Great, and Huge weeks all seem good" | Accepted. Huge's best-week clause stays. |
| The tally (D-094, D-096) | "I like the tally setup" | Already Accepted (2026-11-10). |
| Arrivals (D-126) | "the doorbell and arrivals is nice" | Accepted. |
| The roof (D-127) | "be able to toggle the roof view with some sort of button after the roofing phase, as it was only briefly visible and kind of happened at the end of a week and was easy to miss" | Accepted, with an addition: **D-133**. |
| Music (D-128) | "the current three, while nice, start to loop pretty noticeably throughout a run"; "the music is good, I just think we should add more if we can" | Accepted, with an addition: **D-134**. |

Played with no issues raised, so also Accepted: D-112 (playtest 4's quick fixes), D-113 (Inspect's hold and the house rules' fold), D-125 (the reward moments, particles and Flashing), D-129 (the recorded sound set), D-130 (the audio files and loading) and D-131 (the music bus).

## 3. Follow-ups, each its own fix PR

- **D-132, one reroll redraws both rows** (the draft session): the weekly draw's Rooms and Layout rows both redraw for one reroll, with one Reroll control. Its PR runs `--check` against develop. There's no re-fit until the balance pass, which comes after it.
- **D-133, the roof view** (the juice session): a Roof toggle by the camera controls once the house is topped out. The reveal holds until the player's next action instead of lifting on a timer, and the end screen opens with the roof on.
- **D-134, three more tracks** (the sound session): from the shortlist of six the user heard, so a run's music doesn't loop as soon.
- **After those:**
  - the balance pass and the one re-fit
  - M6's end-screen finale
  - playtest 6
  - the release into main

## 4. The run code

Paste it into a replay test, or open it on build 56e1e02 with `?run=`.

<details>
<summary>OH1 run code (seed drf4yj)</summary>

```
OH1.eyJidWlsZCI6IjU2ZTFlMDIiLCJjb250ZW50SGFzaCI6IjUxOTA0YjdiIiwic2V0dXAiOnsic2VlZCI6ImRyZjR5aiIsImNsaWVudElkIjoiaGVuZGVyc29ucyIsImNyZXdJZCI6ImdlbmVyYWxDb250cmFjdG9yIiwibW9kZSI6InN0YW5kYXJkIn0sImFjdGlvbnMiOlt7InQiOiJkZW1vbGlzaCIsIngiOjEsInkiOjE4fSx7InQiOiJ1c2VUb29sIiwiaSI6MH0seyJ0IjoicGxhY2UiLCJmcm9tIjoiaGFuZCIsImkiOjAsIngiOjEzLCJ5IjoxOSwicm90IjowfSx7InQiOiJwbGFjZSIsImZyb20iOiJoYW5kIiwiaSI6MSwieCI6MTUsInkiOjE5LCJyb3QiOjB9LHsidCI6InBsYWNlIiwiZnJvbSI6ImhhbmQiLCJpIjowLCJ4IjoxNSwieSI6MjEsInJvdCI6MX0seyJ0IjoicmVyb2xsIiwicm93Ijoicm9vbXMifSx7InQiOiJwbGFjZSIsImZyb20iOiJoYW5kIiwiaSI6MSwieCI6MTMsInkiOjE4LCJyb3QiOjB9LHsidCI6InBpY2siLCJpIjoxfSx7InQiOiJidXkiLCJpIjowfSx7InQiOiJsZWF2ZVNob3AifSx7InQiOiJwbGFjZSIsImZyb20iOiJoYW5kIiwiaSI6MCwieCI6MTQsInkiOjE4LCJyb3QiOjB9LHsidCI6InBsYWNlIiwiZnJvbSI6ImhhbmQiLCJpIjowLCJ4IjoxMywieSI6MjEsInJvdCI6MH0seyJ0IjoicGxhY2UiLCJmcm9tIjoiaGFuZCIsImkiOjEsIngiOjEzLCJ5IjoxNiwicm90IjowfSx7InQiOiJyZXJvbGwiLCJyb3ciOiJyb29tcyJ9LHsidCI6InJlcm9sbCIsInJvdyI6InJvb21zIn0seyJ0IjoicGxhY2UiLCJmcm9tIjoiaGFuZCIsImkiOjMsIngiOjE3LCJ5IjoyMywicm90IjowfSx7InQiOiJhbnN3ZXJDaGFuZ2VPcmRlciIsImFjY2VwdCI6dHJ1ZX0seyJ0IjoiYnV5IiwiaSI6NH0seyJ0IjoiYnV5IiwiaSI6MX0seyJ0IjoibGVhdmVTaG9wIn0seyJ0IjoiZGVtb2xpc2giLCJ4IjoxNSwieSI6MTd9LHsidCI6InBsYWNlIiwiZnJvbSI6ImhhbmQiLCJpIjowLCJ4IjoxNiwieSI6MTcsInJvdCI6MH0seyJ0IjoicGxhY2UiLCJmcm9tIjoiaGFuZCIsImkiOjMsIngiOjE1LCJ5IjoyMywicm90IjowfSx7InQiOiJyZXJvbGwiLCJyb3ciOiJyb29tcyJ9LHsidCI6InJlcm9sbCIsInJvdyI6ImxheW91dCJ9LHsidCI6InBsYWNlIiwiZnJvbSI6ImhhbmQiLCJpIjoyLCJ4IjoxNSwieSI6MTcsInJvdCI6MX0seyJ0IjoicGxhY2UiLCJmcm9tIjoiaGFuZCIsImkiOjEsIngiOjE4LCJ5IjoxNywicm90IjoyfSx7InQiOiJidXkiLCJpIjo0fSx7InQiOiJsZWF2ZVNob3AifSx7InQiOiJwbGFjZSIsImZyb20iOiJyZXNlcnZlIiwiaSI6MCwieCI6MTUsInkiOjE1LCJyb3QiOjB9LHsidCI6InJlcm9sbCIsInJvdyI6InJvb21zIn0seyJ0IjoicmVyb2xsIiwicm93IjoibGF5b3V0In0seyJ0IjoicmVub3ZhdGUiLCJmcm9tIjoiaGFuZCIsImkiOjAsInVpZCI6OX0seyJ0IjoicGxhY2UiLCJmcm9tIjoiaGFuZCIsImkiOjAsIngiOjE5LCJ5IjoxNSwicm90IjowfSx7InQiOiJwbGFjZSIsImZyb20iOiJoYW5kIiwiaSI6MywieCI6MTgsInkiOjIzLCJyb3QiOjB9LHsidCI6ImFuc3dlckNoYW5nZU9yZGVyIiwiYWNjZXB0Ijp0cnVlfSx7InQiOiJidXkiLCJpIjoyfSx7InQiOiJidXkiLCJpIjo0fSx7InQiOiJsZWF2ZVNob3AifSx7InQiOiJpbnN0YWxsIiwiZnJvbSI6InN1cHBsaWVzIiwiaSI6MCwidWlkIjoxMn0seyJ0IjoiaW5zdGFsbCIsImZyb20iOiJzdXBwbGllcyIsImkiOjAsInVpZCI6M30seyJ0IjoicGxhY2UiLCJmcm9tIjoicmVzZXJ2ZSIsImkiOjEsIngiOjE4LCJ5IjoyMCwicm90IjowfSx7InQiOiJwbGFjZSIsImZyb20iOiJyZXNlcnZlIiwiaSI6MSwieCI6MTgsInkiOjIyLCJyb3QiOjB9LHsidCI6InBsYWNlIiwiZnJvbSI6ImhhbmQiLCJpIjoxLCJ4IjoxOSwieSI6MjIsInJvdCI6MH0seyJ0IjoicGxhY2UiLCJmcm9tIjoiaGFuZCIsImkiOjIsIngiOjE5LCJ5IjoxMywicm90IjowfSx7InQiOiJyZXJvbGwiLCJyb3ciOiJyb29tcyJ9LHsidCI6InJlcm9sbCIsInJvdyI6InJvb21zIn0seyJ0IjoicmVub3ZhdGUiLCJmcm9tIjoiaGFuZCIsImkiOjEsInVpZCI6Mn0seyJ0IjoiYnV5IiwiaSI6NH0seyJ0IjoibGVhdmVTaG9wIn0seyJ0IjoicGxhY2UiLCJmcm9tIjoicmVzZXJ2ZSIsImkiOjEsIngiOjE1LCJ5IjoxMywicm90IjoyfSx7InQiOiJwbGFjZSIsImZyb20iOiJoYW5kIiwiaSI6MiwieCI6MTMsInkiOjIyLCJyb3QiOjB9LHsidCI6InJlcm9sbCIsInJvdyI6InJvb21zIn0seyJ0IjoicmVub3ZhdGUiLCJmcm9tIjoiaGFuZCIsImkiOjEsInVpZCI6OX0seyJ0IjoicmVub3ZhdGUiLCJmcm9tIjoiaGFuZCIsImkiOjEsInVpZCI6Mn0seyJ0IjoiYnV5IiwiaSI6Nn0seyJ0IjoiYnV5IiwiaSI6MTB9LHsidCI6ImJ1eSIsImkiOjl9LHsidCI6InJlZnJlc2hTaG9wIn0seyJ0IjoiYnV5IiwiaSI6NH0seyJ0IjoibGVhdmVTaG9wIn0seyJ0IjoiaW5zdGFsbCIsImZyb20iOiJzdXBwbGllcyIsImkiOjEsInVpZCI6Mn0seyJ0IjoicGxhY2UiLCJmcm9tIjoiaGFuZCIsImkiOjIsIngiOjIwLCJ5IjoyMSwicm90IjowfSx7InQiOiJ1c2VUb29sIiwiaSI6MH0seyJ0IjoiZGVtb2xpc2giLCJ4IjoxNywieSI6MTJ9LHsidCI6InJlbm92YXRlIiwiZnJvbSI6ImhhbmQiLCJpIjoxLCJ1aWQiOjN9LHsidCI6InJlbm92YXRlIiwiZnJvbSI6ImhhbmQiLCJpIjowLCJ1aWQiOjEyfSx7InQiOiJjb21wbGV0ZUVhcmx5In1dfQ
```

</details>
