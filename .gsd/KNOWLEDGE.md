# Knowledge

- `reference-backend` currently hits a native `EXC_BAD_ACCESS` when startup reaches a non-empty `DATABASE_URL` path; `lldb --batch -o run -o bt -- ./reference-backend/reference-backend` points at `parse_required_positive_int` in the generated binary. Build-only verification is reliable, but DB-backed runtime work in S01 should resume from that concrete crash site instead of re-investigating package scaffolding.
