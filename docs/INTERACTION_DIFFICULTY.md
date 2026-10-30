# Difficulty guidance

The world-check inspector groups the comparison and difficulty in one threshold
card. Its calculator is authoring guidance for the active test profile; it does
not change execution, result routing, saved dice profiles or runtime exports.
Suggested thresholds change the local difficulty only after an explicit click.

For independent fair dice with integer face ranges, let `S` be the sum of all
dice, `A` the resolved attribute, and `M` the fixed modifier plus the applicable
conditional modifiers. The calculator evaluates:

```text
P(S + A + M >= D) = P(S >= ceil(D - A - M))
P(S + A + M >  D) = P(S >= floor(D - A - M) + 1)
```

Each die is uniform on its actual face range. The distribution of `S` is the
[convolution of the individual probability mass functions](https://www.statlect.com/glossary/convolutions),
not a uniform interpolation between its minimum and maximum. Thus the same
calculation covers D20, D100, mixed pools, compound D9, and zero-based ranges.
The mean is the sum of each die's `(minimum + maximum) / 2`, plus `A + M`.

Attribute and conditional bonuses use `freezeInteractionRoll`, the execution
resolver, with the active test profile and the selected actor context. Invalid
or unresolved operands suppress the calculator instead of becoming zero. The
advice describes the configured comparison; custom extreme-result ranges still
determine their own runtime outcomes. It is a snapshot: attributes and conditions
can change as the story runs.

Single dice use their exact closed-form tail probability. Other pools with total
width at most 65,536 use exact discrete convolution with sliding sums. Larger
pools convolve weighted integer buckets, retaining the last bucket's actual
weight. If each zero-based die is `X_i = step * Q_i + R_i`, then
`0 <= sum(R_i) <= sum(min(sides_i - 1, step - 1))`. This provides lower and upper
tail probabilities, displayed as a bounded estimate. No normal approximation,
sampling or runtime random source is used. Memory and work stay bounded by
65,537 buckets and at most 100 dice.

The suggested easy/balanced/hard thresholds target 75%, 50% and 25% respectively.
Discrete dice may not attain those percentages; each suggestion displays its
actual probability (or probability bounds). Descriptive difficulty bands are
editor guidance, not additional game rules. Guaranteed/impossible labels require
the actual support to establish probability 1/0.

Run `npm run verify:interaction-difficulty` for exhaustive small-pool comparison,
strict/inclusive thresholds and fractional bonuses, large-pool analytic bounds,
invalid inputs, runtime agreement, unresolved context and mutation preservation.
Desktop checks use the real Tauri WebView2 as described in `TAURI_DEBUG.md`.
