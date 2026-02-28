//! Test runtime support functions for the Mesh testing framework (Phase 138).
//!
//! Provides `extern "C"` functions called by compiled `*.test.mpl` programs.
//! The test harness (lowered by Plan 03) calls these functions to:
//!   - Begin each test (`mesh_test_begin`)
//!   - Record pass/fail outcomes (`mesh_test_pass`, `mesh_test_fail_msg`)
//!   - Assert conditions (`mesh_test_assert`, `mesh_test_assert_eq`,
//!     `mesh_test_assert_ne`, `mesh_test_assert_raises`)
//!   - Print summary at the end of the run (`mesh_test_summary`)
//!   - Clean up mock actors (`mesh_test_cleanup_actors`)
//!
//! ## State model
//!
//! All state is kept in `thread_local!` statics. Tests run single-threaded
//! from the generated `main`, so no locking is required.
//!
//! ## Failure output
//!
//! Failures print inline as each test fails, and are also accumulated in
//! `FAIL_MESSAGES`. `mesh_test_summary` reprints all failures in a
//! `Failures:` section before the final count line.

use std::cell::{Cell, RefCell};
use std::io::Write as _;

use crate::string::MeshString;

// ── ANSI color codes ─────────────────────────────────────────────────────────

const GREEN: &str = "\x1b[32m";
const RED: &str   = "\x1b[31m";
const BOLD: &str  = "\x1b[1m";
const DIM: &str   = "\x1b[2m";
const RESET: &str = "\x1b[0m";

// ── Per-process test state ────────────────────────────────────────────────────

thread_local! {
    static PASS_COUNT: Cell<i64> = Cell::new(0);
    static FAIL_COUNT: Cell<i64> = Cell::new(0);
    static CURRENT_TEST: RefCell<String> = RefCell::new(String::new());
    static QUIET_MODE: Cell<bool> = Cell::new(false);
    /// Accumulates failure messages for the end-of-run `Failures:` reprint.
    static FAIL_MESSAGES: RefCell<Vec<String>> = RefCell::new(Vec::new());
    /// Pids of mock actors spawned during the run; drained by cleanup_actors.
    static MOCK_ACTOR_PIDS: RefCell<Vec<i64>> = RefCell::new(Vec::new());
}

// ── Helper: read a MeshString as a &str ──────────────────────────────────────

/// Extract a `&str` from a pointer to a `MeshString`.
///
/// # Safety
///
/// `s` must be a valid, non-null pointer to an initialised `MeshString`
/// whose data bytes are valid UTF-8.
unsafe fn mesh_str<'a>(s: *const MeshString) -> &'a str {
    (*s).as_str()
}

/// Helper: create a Rust `String` failure message and forward it to
/// `mesh_test_fail_msg` via a temporary `MeshString` on the stack.
///
/// This is used by the assert helpers to avoid duplicating the
/// fail-msg accumulation / print logic.
fn fail_with(msg: &str) {
    // We need a MeshString to pass to mesh_test_fail_msg.
    // Allocate one from the GC so the pointer remains valid.
    let ms = crate::string::mesh_string_new(msg.as_ptr(), msg.len() as u64);
    unsafe { mesh_test_fail_msg(ms) };
}

// ── Public extern "C" functions ───────────────────────────────────────────────

/// Called by the test harness immediately before each test body.
///
/// Stores the test name for subsequent `pass`/`fail_msg` calls and,
/// in verbose mode, prints `"  running: <name>"` (no trailing newline)
/// so that the pass/fail line can overwrite it with `\r`.
#[no_mangle]
pub extern "C" fn mesh_test_begin(name: *const MeshString) {
    let name_str = unsafe { mesh_str(name) }.to_owned();
    CURRENT_TEST.with(|ct| *ct.borrow_mut() = name_str.clone());

    if !QUIET_MODE.with(|q| q.get()) {
        print!("  {DIM}running:{RESET} {name_str}");
        let _ = std::io::stdout().flush();
    }
}

/// Called by the test harness after the test body returns without panicking.
///
/// Increments `PASS_COUNT` and, in verbose mode, overwrites the
/// `running:` line with a green checkmark.
#[no_mangle]
pub extern "C" fn mesh_test_pass() {
    PASS_COUNT.with(|c| c.set(c.get() + 1));

    if !QUIET_MODE.with(|q| q.get()) {
        let name = CURRENT_TEST.with(|ct| ct.borrow().clone());
        println!("\r  {GREEN}✓{RESET} {name}");
    }
}

/// Called when an assertion fails (or when the test harness catches a panic
/// from one of the assert helpers).
///
/// Increments `FAIL_COUNT`, prints the failure inline (verbose mode), and
/// accumulates the failure message for the end-of-run `Failures:` section.
#[no_mangle]
pub unsafe extern "C" fn mesh_test_fail_msg(msg: *const MeshString) {
    FAIL_COUNT.with(|c| c.set(c.get() + 1));
    let msg_str = mesh_str(msg).to_owned();
    let name = CURRENT_TEST.with(|ct| ct.borrow().clone());

    if !QUIET_MODE.with(|q| q.get()) {
        println!("\r  {RED}✗{RESET} {name}");
        println!("    {RED}{msg_str}{RESET}");
    }

    let entry = format!(
        "  {RED}{BOLD}✗{RESET} {name}\n    {RED}{msg_str}{RESET}"
    );
    FAIL_MESSAGES.with(|fm| fm.borrow_mut().push(entry));
}

/// Assert that `cond` is non-zero.
///
/// On failure, records the failure message and panics so the test harness
/// can catch the unwind and continue to the next test.
#[no_mangle]
pub unsafe extern "C" fn mesh_test_assert(
    cond: i8,
    expr_src: *const MeshString,
    _file: *const u8,
    _file_len: i64,
    _line: i64,
) {
    if cond == 0 {
        let src = mesh_str(expr_src);
        let msg = format!("assert failed: {src}");
        fail_with(&msg);
        // Panic so the harness (catch_unwind in the test runner) can skip
        // the remainder of this test body.
        panic!("mesh_test_assert: {}", msg);
    }
}

/// Assert that `lhs` and `rhs` (already converted to strings by the lowerer)
/// are equal. Fails with an `expected`/`actual` diagnostic.
#[no_mangle]
pub unsafe extern "C" fn mesh_test_assert_eq(
    lhs: *const MeshString,
    rhs: *const MeshString,
    expr_src: *const MeshString,
    _file: *const u8,
    _file_len: i64,
    _line: i64,
) {
    let l = mesh_str(lhs);
    let r = mesh_str(rhs);
    if l != r {
        let src = mesh_str(expr_src);
        let msg = format!("assert_eq failed: {src}\n  left:  {l}\n  right: {r}");
        fail_with(&msg);
        panic!("mesh_test_assert_eq: {}", msg);
    }
}

/// Assert that `lhs` and `rhs` are NOT equal. Fails when they are equal.
#[no_mangle]
pub unsafe extern "C" fn mesh_test_assert_ne(
    lhs: *const MeshString,
    rhs: *const MeshString,
    expr_src: *const MeshString,
    _file: *const u8,
    _file_len: i64,
    _line: i64,
) {
    let l = mesh_str(lhs);
    let r = mesh_str(rhs);
    if l == r {
        let src = mesh_str(expr_src);
        let msg = format!("assert_ne failed: {src}\n  both sides equal: {l}");
        fail_with(&msg);
        panic!("mesh_test_assert_ne: {}", msg);
    }
}

/// Assert that calling the closure `fn_ptr(env_ptr)` raises (panics).
///
/// Passes when the closure panics; fails when it returns normally.
///
/// The closure ABI matches the Mesh runtime closure convention:
/// `extern "C" fn(*const u8) -> i64`.
#[no_mangle]
pub unsafe extern "C" fn mesh_test_assert_raises(
    fn_ptr: *const u8,
    env_ptr: *const u8,
    _file: *const u8,
    _file_len: i64,
    _line: i64,
) {
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let f: extern "C" fn(*const u8) -> i64 = std::mem::transmute(fn_ptr);
        f(env_ptr);
    }));

    match result {
        Ok(_) => {
            // The closure returned normally — expected a panic, got none.
            let msg = "assert_raises failed: expression did not raise";
            fail_with(msg);
            panic!("mesh_test_assert_raises: {}", msg);
        }
        Err(_) => {
            // Raised as expected — assertion passes.
        }
    }
}

/// Print the run summary.
///
/// First reprints all accumulated failure messages in a `Failures:` section,
/// then prints the final `N passed` / `N failed, M passed` count line.
///
/// The harness (`Plan 03`) passes the elapsed time as milliseconds.
#[no_mangle]
pub extern "C" fn mesh_test_summary(passed: i64, failed: i64, elapsed_ms: i64) {
    // Reprint accumulated failures at the bottom of the run.
    FAIL_MESSAGES.with(|fm| {
        let messages = fm.borrow();
        if !messages.is_empty() {
            println!("\n{BOLD}Failures:{RESET}");
            for msg in messages.iter() {
                println!("{msg}");
            }
        }
    });

    let elapsed = elapsed_ms as f64 / 1000.0;
    if failed > 0 {
        println!(
            "\n{RED}{BOLD}{failed} failed{RESET}, {passed} passed in {elapsed:.2}s"
        );
    } else {
        println!("\n{GREEN}{BOLD}{passed} passed{RESET} in {elapsed:.2}s");
    }
}

/// Clean up any mock actors registered during the test run.
///
/// Drains `MOCK_ACTOR_PIDS` and calls `mesh_actor_exit` for each Pid.
/// Plan 03 populates `MOCK_ACTOR_PIDS` when `Test.mock_actor` is called.
#[no_mangle]
pub extern "C" fn mesh_test_cleanup_actors() {
    let pids: Vec<i64> = MOCK_ACTOR_PIDS.with(|p| std::mem::take(&mut *p.borrow_mut()));
    for pid in pids {
        // Reason tag 0 = normal exit (same convention as actor/mod.rs).
        unsafe {
            crate::actor::mesh_actor_exit(pid as u64, 0);
        }
    }
}

/// Register a mock actor Pid for cleanup at the end of the run.
///
/// Called by the Plan 03 `Test.mock_actor` implementation.
#[allow(dead_code)]
pub fn register_mock_actor_pid(pid: i64) {
    MOCK_ACTOR_PIDS.with(|p| p.borrow_mut().push(pid));
}
