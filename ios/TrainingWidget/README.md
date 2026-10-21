# Training lock screen widget (iPhone)

Shows today's AM/PM workouts from the `training_records` table on the lock screen.
It reads the public endpoint `https://db.abepasion.workers.dev/db/training_records`,
the same one the site uses, so the phone stores no credentials.

Lock screen widgets are native only, so this has to be built in Xcode on a Mac.
Requires iOS 17+ (the file uses `containerBackground` and `#Preview`).

## Setup

1. In Xcode: **File > New > Project > iOS > App** (SwiftUI). Name it `Training`.
2. **File > New > Target > Widget Extension**. Name it `TrainingWidget`.
   Untick *Include Live Activity* and *Include Configuration App Intent*.
3. Delete the template widget file Xcode generated in the `TrainingWidget` folder.
4. Drag `TrainingWidget.swift` into the `TrainingWidget` target (tick *TrainingWidget* in
   Target Membership). Its `@main` bundle replaces the template one.
5. Select your iPhone as the run destination and press Run. Xcode installs the app and the widget.
6. On the phone: long-press the lock screen > **Customize** > **Lock Screen** >
   tap the widget area > **Today's Training**.

Free Apple ID signing expires after 7 days, so re-run from Xcode when it stops launching.

## Notes

- The widget shows the row whose date matches today's local date, same as the Workout of
  the Day card. A row marked *Rest day* shows "Rest day".
- It refreshes about every 2 hours and at midnight. iOS limits how often widgets can refresh,
  so a plan pasted on the site can take a while to appear.
- Parsing rules mirror `src/training/workoutPlan.ts`: `•`/`-`/`*` bullets, `**bold**` stripped.
- Two families are supported: rectangular (main) and inline (one line above the clock).
