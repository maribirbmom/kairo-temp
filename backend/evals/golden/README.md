# Golden cases

`example_synthetic.json` is a fabricated pair that shows the format and is safe to commit.

Put real resume/JD pairs in `private/` (gitignored). Reference labels can come from a career-ops report
(`## Machine Summary` score + decision, `## B) Match with CV` rows) or from careful hand labelling.
Never commit a real resume: this repo is public.

## `cases/` (committed, synthetic)

Six fabricated candidate/JD pairs spanning fresher vs senior, strong vs wrong-stack, a career switcher and a
borderline junior DevOps fit. No real person or company. **The reference labels are written by applying the
career-ops rubric by hand (importance bands, strong/partial/missing, holistic 1-5), not measured ground truth.**
Treat them as a regression suite and a calibration aid; a reviewer should spot-check them. Add your own pairs the same way.
