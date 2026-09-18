# Two screens of dead space under the plot

Decision record, 2026-08-26. Decision taken by Igor Shuryak.

This record is written up from the change's own commit message and the state of
`docs/style.css` before and after it. It is promoted into the tree because the
change altered the published site's layout, and the reasoning for it -- in
particular two rejected alternatives -- existed only in a commit message, where
nobody reading the repository would find it.

## The problem

The plot sat in a `1fr` grid column with the seven explanatory cards in a fixed
320 px column beside it. Seven stacked cards run far taller than the 540 px plot,
so everything to the left of them below the figure was blank: close to two screens
of dead space on a laptop, with the cards squeezed into a narrow ribbon.

## What was done

The plot spans the full width and the cards flow underneath it.

## Why multi-column rather than a grid

`columns: 21rem` is a column **width**, not a count, so the browser fits as many
columns as the viewport allows and collapses to one on a phone with no media
query at all.

A grid was rejected for a specific reason rather than a stylistic one: the cards
differ several-fold in height, and a grid aligns row heights. Using one would have
reopened, between rows, exactly the dead space the change exists to close.

(That trade-off was revisited on 2026-08-27, when collapsing each card's long
prose behind a `<details>` disclosure removed the height spread that made a grid
unattractive. The layout moved back to a grid then, which is also what lets the
group headings stay attached to their cards -- a multi-column flow can break a
heading away from the card beneath it. See
`2026_08_27_site-review-comments.md`. Both decisions were right at the time they
were taken; the second became available only because the first change's successor
removed the constraint.)

## The defect one box up, exposed by fixing this one

Fixing the card column made it obvious that the eight method checkboxes had the
same problem: stacked vertically inside a grid column, they tripled the height of
the controls box. They now span the full width and wrap. Slider labels no longer
break between the word and its parenthesis.

## Verification

Rendered headless at 1920, 1440, 1280 and 820 px, and at four UI states driven
through `app.js`, so the layout was checked against the full range of card content
lengths rather than one screenshot of the default state.

No published number moves. `docs/style.css` and the `FIXES.md` record are the only
files changed; `docs/data/scenarios.json`, every figure, and every R script are
untouched.
