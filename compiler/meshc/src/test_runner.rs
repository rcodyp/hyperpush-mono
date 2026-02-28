//! Test runner for Mesh: discovers *.test.mpl files, compiles and executes each,
//! aggregates pass/fail results, and formats output with ANSI colors.
//!
//! Test files (*.test.mpl) use the Mesh test DSL:
//!
//! ```mesh
//! test("label") do
//!   assert(expr)
//!   assert_eq(lhs_str, rhs_str)
//! end
//!
//! describe("group") do
//!   setup() do ... end
//!   teardown() do ... end
//!   test("name") do ... end
//! end
//! ```
//!
//! The test runner preprocesses this into a valid Mesh program with `fn main()`.
//! The preprocessed program uses the test runtime builtins registered in
//! `mesh_typeck::builtins` and `mesh_codegen::mir::lower`.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Instant;

use mesh_typeck::diagnostics::DiagnosticOptions;

const GREEN: &str = "\x1b[32m";
const RED: &str = "\x1b[31m";
const BOLD: &str = "\x1b[1m";
const RESET: &str = "\x1b[0m";

/// Summary of a test run.
#[allow(dead_code)]
pub struct TestSummary {
    /// Number of test files that passed (exit code 0).
    pub passed: usize,
    /// Number of test files that failed (compile error or exit code non-zero).
    pub failed: usize,
}

/// Run tests in the given project directory.
///
/// - `filter_file`: if Some, run only that specific *.test.mpl file.
/// - `quiet`: compact output (dots instead of per-file names).
/// - `coverage`: stub flag — prints message and exits cleanly without running tests.
pub fn run_tests(
    project_dir: &Path,
    filter_file: Option<&Path>,
    quiet: bool,
    coverage: bool,
) -> Result<TestSummary, String> {
    // --coverage stub: accepted, prints message, exits cleanly
    if coverage {
        println!("Coverage reporting coming soon");
        return Ok(TestSummary { passed: 0, failed: 0 });
    }

    // Discover test files
    let test_files = if let Some(specific) = filter_file {
        // Single file mode: resolve relative to cwd
        let abs = if specific.is_absolute() {
            specific.to_path_buf()
        } else {
            std::env::current_dir().unwrap_or_default().join(specific)
        };
        if !abs.exists() {
            return Err(format!("Test file '{}' does not exist", abs.display()));
        }
        if !abs.file_name()
            .and_then(|n| n.to_str())
            .map(|n| n.ends_with(".test.mpl"))
            .unwrap_or(false)
        {
            return Err(format!("'{}' is not a *.test.mpl file", abs.display()));
        }
        vec![abs]
    } else {
        discover_test_files(project_dir)?
    };

    if test_files.is_empty() {
        println!("No *.test.mpl files found.");
        return Ok(TestSummary { passed: 0, failed: 0 });
    }

    let start = Instant::now();
    let mut passed = 0usize;
    let mut failed = 0usize;

    for test_file in &test_files {
        let rel = test_file.strip_prefix(project_dir)
            .unwrap_or(test_file.as_path());
        let label = rel.display().to_string();

        // Read the .test.mpl source and preprocess it into a valid Mesh program.
        let source = std::fs::read_to_string(test_file)
            .map_err(|e| format!("Failed to read '{}': {}", test_file.display(), e))?;

        let preprocessed = preprocess_test_source(&source);

        // Compile the preprocessed source to a temp binary.
        let tmp_dir = tempfile::tempdir()
            .map_err(|e| format!("Failed to create temp dir: {}", e))?;
        let bin_path = tmp_dir.path().join("test_bin");

        let main_path = tmp_dir.path().join("main.mpl");
        std::fs::write(&main_path, preprocessed)
            .map_err(|e| format!("Failed to write preprocessed source: {}", e))?;

        let diag_opts = DiagnosticOptions { color: true, json: false };
        let compile_result = crate::build(
            tmp_dir.path(),
            0,        // opt_level: debug
            false,    // emit_llvm
            Some(&bin_path),
            None,     // target: native
            &diag_opts,
        );

        if let Err(e) = compile_result {
            if quiet {
                print!("{RED}F{RESET}");
                use std::io::Write;
                std::io::stdout().flush().ok();
            } else {
                println!("{RED}{BOLD}COMPILE ERROR{RESET}: {label}");
                println!("  {}", e);
            }
            failed += 1;
            continue;
        }

        // Execute the compiled binary
        let output = Command::new(&bin_path)
            .output()
            .map_err(|e| format!("Failed to execute '{}': {}", bin_path.display(), e))?;

        // Pass stdout/stderr through to terminal
        if !output.stdout.is_empty() {
            print!("{}", String::from_utf8_lossy(&output.stdout));
        }
        if !output.stderr.is_empty() {
            eprint!("{}", String::from_utf8_lossy(&output.stderr));
        }

        if output.status.success() {
            if quiet {
                print!("{GREEN}.{RESET}");
                use std::io::Write;
                std::io::stdout().flush().ok();
            }
            passed += 1;
        } else {
            if quiet {
                print!("{RED}F{RESET}");
                use std::io::Write;
                std::io::stdout().flush().ok();
            }
            failed += 1;
        }
    }

    if quiet {
        println!(); // newline after dots
    }

    let elapsed = start.elapsed();
    let elapsed_secs = elapsed.as_secs_f64();

    // Summary line
    if failed > 0 {
        println!("\n{RED}{BOLD}{failed} failed{RESET}, {passed} passed in {elapsed_secs:.2}s");
    } else {
        println!("\n{GREEN}{BOLD}{passed} passed{RESET} in {elapsed_secs:.2}s");
    }

    Ok(TestSummary { passed, failed })
}

// ── Source Preprocessor ───────────────────────────────────────────────────

/// A test block extracted from the .test.mpl source.
#[derive(Debug)]
struct TestBlock {
    /// Full test label (includes describe group prefix when nested).
    label: String,
    /// Source text of the test body (between `do` and the matching `end`).
    body: String,
    /// Optional setup body to run before this test (from enclosing describe).
    setup_body: Option<String>,
    /// Optional teardown body to run after this test (from enclosing describe).
    teardown_body: Option<String>,
}

/// Preprocess a .test.mpl source file into a valid Mesh program.
///
/// Transforms:
/// - `test("label") do body end` → `fn __test_body_N() do body end`
/// - `describe("group") do setup/teardown/test blocks end` → grouped tests
/// - Generates `fn main() do test_begin/test_run_body/test_summary ... end`
///
/// The output is standard Mesh that the compiler accepts.
pub fn preprocess_test_source(source: &str) -> String {
    let tokens = tokenize_test_source(source);
    let blocks = extract_test_blocks(&tokens);

    if blocks.is_empty() {
        // Not a test file or no test blocks — pass through unchanged.
        return source.to_string();
    }

    let mut out = String::new();

    // Emit any top-level definitions from the source (fn, struct, etc.)
    // that aren't test/describe blocks.
    emit_non_test_items(source, &mut out);

    // Emit one function per test block.
    for (i, block) in blocks.iter().enumerate() {
        out.push_str(&format!("fn __test_body_{}() do\n", i));
        if let Some(ref setup) = block.setup_body {
            out.push_str("  # setup\n");
            for line in setup.lines() {
                out.push_str("  ");
                out.push_str(line);
                out.push('\n');
            }
        }
        for line in block.body.lines() {
            out.push_str("  ");
            out.push_str(line);
            out.push('\n');
        }
        if let Some(ref teardown) = block.teardown_body {
            out.push_str("  # teardown\n");
            for line in teardown.lines() {
                out.push_str("  ");
                out.push_str(line);
                out.push('\n');
            }
        }
        out.push_str("end\n\n");
    }

    // Emit fn main() harness.
    out.push_str("fn main() do\n");
    for (i, block) in blocks.iter().enumerate() {
        // Escape double-quotes in the label for the Mesh string literal.
        let escaped_label = block.label.replace('\\', "\\\\").replace('"', "\\\"");
        out.push_str(&format!(
            "  test_cleanup_actors()\n  test_begin(\"{}\")\n  test_run_body(fn() do __test_body_{}() end)\n",
            escaped_label, i
        ));
    }
    // Pass 0 for elapsed_ms; accurate timing is cosmetic and can be added later.
    out.push_str("  test_summary(test_pass_count(), test_fail_count(), 0)\n");
    out.push_str("end\n");

    out
}

// ── Tokenizer ─────────────────────────────────────────────────────────────

/// A token kind for the test source mini-lexer.
#[derive(Debug, Clone, PartialEq)]
enum TToken {
    /// `test` keyword (bare IDENT)
    TestKw,
    /// `describe` keyword (bare IDENT)
    DescribeKw,
    /// `setup` keyword (bare IDENT)
    SetupKw,
    /// `teardown` keyword (bare IDENT)
    TeardownKw,
    /// `do` keyword
    Do,
    /// `end` keyword
    End,
    /// `fn` keyword (to track nested fn do ... end)
    Fn,
    /// `if` keyword
    If,
    /// `while` keyword
    While,
    /// `case` keyword
    Case,
    /// `for` keyword
    For,
    /// `actor` keyword
    Actor,
    /// `service` keyword
    Service,
    /// `receive` keyword
    Receive,
    /// A string literal like `"..."` with the raw text (including quotes).
    StringLit(String),
    /// An open paren `(`
    LParen,
    /// A close paren `)`
    RParen,
    /// Everything else (whitespace, comments, other tokens).
    Other(String),
}

/// Tokenize the test source into a flat sequence of TTokens.
///
/// Handles:
/// - String literals (to avoid misidentifying keywords inside strings)
/// - Line comments `# ...`
/// - Keywords: test, describe, setup, teardown, do, end, fn, if, while, case
fn tokenize_test_source(source: &str) -> Vec<TToken> {
    let mut tokens = Vec::new();
    let chars: Vec<char> = source.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        // Skip line comments
        if chars[i] == '#' {
            let mut s = String::new();
            while i < chars.len() && chars[i] != '\n' {
                s.push(chars[i]);
                i += 1;
            }
            tokens.push(TToken::Other(s));
            continue;
        }

        // String literals
        if chars[i] == '"' {
            let mut s = String::new();
            s.push('"');
            i += 1;
            while i < chars.len() {
                if chars[i] == '\\' && i + 1 < chars.len() {
                    s.push(chars[i]);
                    s.push(chars[i + 1]);
                    i += 2;
                } else if chars[i] == '"' {
                    s.push('"');
                    i += 1;
                    break;
                } else {
                    s.push(chars[i]);
                    i += 1;
                }
            }
            tokens.push(TToken::StringLit(s));
            continue;
        }

        // String interpolation `"${...}"` — treat whole thing as string lit
        // (not common in test files but handle to avoid mis-tokenizing)

        // Identifiers and keywords
        if chars[i].is_alphabetic() || chars[i] == '_' {
            let mut ident = String::new();
            while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_') {
                ident.push(chars[i]);
                i += 1;
            }
            let tok = match ident.as_str() {
                "test"     => TToken::TestKw,
                "describe" => TToken::DescribeKw,
                "setup"    => TToken::SetupKw,
                "teardown" => TToken::TeardownKw,
                "do"       => TToken::Do,
                "end"      => TToken::End,
                "fn"       => TToken::Fn,
                "if"       => TToken::If,
                "while"    => TToken::While,
                "case"     => TToken::Case,
                "for"      => TToken::For,
                "actor"    => TToken::Actor,
                "service"  => TToken::Service,
                "receive"  => TToken::Receive,
                _          => TToken::Other(ident),
            };
            tokens.push(tok);
            continue;
        }

        // Parens
        if chars[i] == '(' {
            tokens.push(TToken::LParen);
            i += 1;
            continue;
        }
        if chars[i] == ')' {
            tokens.push(TToken::RParen);
            i += 1;
            continue;
        }

        // Everything else (whitespace, operators, numbers, etc.)
        let mut s = String::new();
        s.push(chars[i]);
        i += 1;
        tokens.push(TToken::Other(s));
    }

    tokens
}

/// Extract test blocks from the token stream.
///
/// Recognizes:
/// - `test(STRING) do BODY end`
/// - `describe(STRING) do [setup() do BODY end] [teardown() do BODY end] test(...) ... end`
fn extract_test_blocks(tokens: &[TToken]) -> Vec<TestBlock> {
    let mut blocks = Vec::new();
    let mut i = 0;
    extract_blocks_at(tokens, &mut i, None, None, None, &mut blocks);
    blocks
}

/// Extract test blocks starting at index `i`, up to end of token stream or end of a describe block.
///
/// `group_prefix`: label prefix from enclosing describe (e.g., "Group: ").
/// `setup_body`: setup body from enclosing describe.
/// `teardown_body`: teardown body from enclosing describe.
fn extract_blocks_at(
    tokens: &[TToken],
    i: &mut usize,
    group_prefix: Option<&str>,
    setup_body: Option<&str>,
    teardown_body: Option<&str>,
    blocks: &mut Vec<TestBlock>,
) {
    while *i < tokens.len() {
        match &tokens[*i] {
            TToken::TestKw => {
                // test(STRING) do BODY end
                *i += 1;
                // Expect ( STRING )
                let label = extract_string_arg(tokens, i)
                    .unwrap_or_else(|| "unnamed".to_string());
                let full_label = match group_prefix {
                    Some(prefix) => format!("{} > {}", prefix, label),
                    None => label,
                };
                // Expect 'do'
                skip_to_do(tokens, i);
                if *i < tokens.len() {
                    *i += 1; // consume 'do'
                }
                // Extract body until matching 'end'
                let body = extract_block_body(tokens, i);
                blocks.push(TestBlock {
                    label: full_label,
                    body,
                    setup_body: setup_body.map(|s| s.to_string()),
                    teardown_body: teardown_body.map(|s| s.to_string()),
                });
            }
            TToken::DescribeKw => {
                // describe(STRING) do [setup] [teardown] test... end
                *i += 1;
                let group_name = extract_string_arg(tokens, i)
                    .unwrap_or_else(|| "describe".to_string());
                skip_to_do(tokens, i);
                if *i < tokens.len() {
                    *i += 1; // consume 'do'
                }
                // Now parse the describe body: find setup, teardown, and test blocks.
                let (inner_setup, inner_teardown, inner_end) =
                    peek_describe_body(tokens, *i);
                // Recurse into describe body.
                let mut j = *i;
                // Find and skip setup/teardown inline; collect tests.
                extract_blocks_at(
                    tokens,
                    &mut j,
                    Some(&group_name),
                    inner_setup.as_deref(),
                    inner_teardown.as_deref(),
                    blocks,
                );
                // Advance past the describe body.
                *i = inner_end;
            }
            TToken::End => {
                // End of a describe block (caller handles this).
                *i += 1;
                return;
            }
            _ => {
                *i += 1;
            }
        }
    }
}

/// Parse the describe body to extract optional `setup()` and `teardown()` bodies.
///
/// Returns `(setup_body, teardown_body, end_index)`.
/// `end_index` points to the token AFTER the matching `end` of the describe.
fn peek_describe_body(
    tokens: &[TToken],
    start: usize,
) -> (Option<String>, Option<String>, usize) {
    let mut setup = None;
    let mut teardown = None;
    let mut i = start;
    let mut depth = 1usize; // we're inside the describe's 'do', depth starts at 1

    while i < tokens.len() {
        match &tokens[i] {
            TToken::SetupKw if depth == 1 => {
                i += 1;
                // Expect `() do BODY end`
                skip_to_do(tokens, &mut i);
                if i < tokens.len() { i += 1; } // consume 'do'
                let body = extract_block_body_raw(tokens, &mut i);
                setup = Some(body);
            }
            TToken::TeardownKw if depth == 1 => {
                i += 1;
                skip_to_do(tokens, &mut i);
                if i < tokens.len() { i += 1; } // consume 'do'
                let body = extract_block_body_raw(tokens, &mut i);
                teardown = Some(body);
            }
            // Same rule: only `do`, `if`, `while`, `case`, `for`, `receive` increase depth.
            TToken::Do | TToken::If | TToken::While
            | TToken::Case | TToken::For | TToken::Receive => {
                depth += 1;
                i += 1;
            }
            TToken::End => {
                if depth == 1 {
                    i += 1; // consume the closing 'end' of describe
                    return (setup, teardown, i);
                }
                depth -= 1;
                i += 1;
            }
            _ => {
                i += 1;
            }
        }
    }

    (setup, teardown, i)
}

/// Parse a string argument from `(STRING)` at position `i`.
/// Advances `i` past the closing `)`.
fn extract_string_arg(tokens: &[TToken], i: &mut usize) -> Option<String> {
    // Skip whitespace / Other tokens until we find '('
    while *i < tokens.len() {
        match &tokens[*i] {
            TToken::LParen => {
                *i += 1;
                break;
            }
            TToken::Other(_) => {
                *i += 1;
            }
            _ => break,
        }
    }

    // Find the string literal
    let mut label = None;
    while *i < tokens.len() {
        match &tokens[*i] {
            TToken::StringLit(s) => {
                // Strip surrounding quotes
                let inner = s.trim_matches('"').to_string();
                label = Some(inner);
                *i += 1;
            }
            TToken::RParen => {
                *i += 1;
                break;
            }
            TToken::Other(_) => {
                *i += 1;
            }
            _ => {
                *i += 1;
                break;
            }
        }
    }

    label
}

/// Skip tokens until we reach a `do` token. Advances `i` to point AT the `do` token.
fn skip_to_do(tokens: &[TToken], i: &mut usize) {
    while *i < tokens.len() {
        if matches!(tokens[*i], TToken::Do) {
            return;
        }
        *i += 1;
    }
}

/// Extract a block body from the token stream, tracking do/end nesting.
///
/// Called AFTER consuming the opening `do`. Advances `i` past the matching `end`.
/// Returns the extracted body as source text (reconstructed from tokens).
fn extract_block_body(tokens: &[TToken], i: &mut usize) -> String {
    extract_block_body_raw(tokens, i)
}

/// Extract block body as raw source text, tracking do/end nesting.
///
/// Only `do` (and keywords that introduce do..end blocks) increments depth.
/// `fn` by itself does NOT increment depth — it's the `do` keyword that follows it.
/// The nesting keywords tracked here are exactly those that require a matching `end`.
fn extract_block_body_raw(tokens: &[TToken], i: &mut usize) -> String {
    let mut body = String::new();
    let mut depth = 1usize;

    while *i < tokens.len() {
        match &tokens[*i] {
            // Only `do`, `if`, `while`, `case`, `for`, `receive` increase depth.
            // `fn` does NOT — in Mesh, `fn() do body end`, the `do` following `fn` does.
            // `actor`, `service` definitions always have a `do` block, so don't double-count.
            TToken::Do | TToken::If | TToken::While
            | TToken::Case | TToken::For | TToken::Receive => {
                depth += 1;
                body.push_str(&token_to_str(&tokens[*i]));
            }
            TToken::End => {
                if depth == 0 {
                    *i += 1;
                    break;
                }
                depth -= 1;
                if depth == 0 {
                    *i += 1; // consume 'end'
                    break;
                }
                body.push_str("end");
            }
            TToken::Fn => body.push_str("fn"),
            TToken::Actor => body.push_str("actor"),
            TToken::Service => body.push_str("service"),
            TToken::TestKw => body.push_str("test"),
            TToken::DescribeKw => body.push_str("describe"),
            TToken::SetupKw => body.push_str("setup"),
            TToken::TeardownKw => body.push_str("teardown"),
            TToken::LParen => body.push('('),
            TToken::RParen => body.push(')'),
            TToken::StringLit(s) => body.push_str(s),
            TToken::Other(s) => body.push_str(s),
        }
        *i += 1;
    }

    // Trim leading/trailing whitespace from the body
    body.trim().to_string()
}

fn token_to_str(tok: &TToken) -> String {
    match tok {
        TToken::TestKw => "test".to_string(),
        TToken::DescribeKw => "describe".to_string(),
        TToken::SetupKw => "setup".to_string(),
        TToken::TeardownKw => "teardown".to_string(),
        TToken::Do => "do".to_string(),
        TToken::End => "end".to_string(),
        TToken::Fn => "fn".to_string(),
        TToken::If => "if".to_string(),
        TToken::While => "while".to_string(),
        TToken::Case => "case".to_string(),
        TToken::For => "for".to_string(),
        TToken::Actor => "actor".to_string(),
        TToken::Service => "service".to_string(),
        TToken::Receive => "receive".to_string(),
        TToken::StringLit(s) => s.clone(),
        TToken::LParen => "(".to_string(),
        TToken::RParen => ")".to_string(),
        TToken::Other(s) => s.clone(),
    }
}

/// Emit non-test top-level definitions from the source (fn, struct, type, impl, etc.).
///
/// This preserves user-defined helper functions used in test bodies.
fn emit_non_test_items(source: &str, out: &mut String) {
    // Tokenize and find blocks that start with fn/struct/type/impl/interface/actor.
    // We skip lines that start with test/describe at depth 0.
    let chars: Vec<char> = source.chars().collect();
    let mut i = 0;
    let mut depth = 0usize;
    let mut in_skip_block = false;
    let mut pending_line = String::new();

    while i < chars.len() {
        let ch = chars[i];

        if ch == '\n' {
            // Check if this line should be emitted.
            let trimmed = pending_line.trim();

            if depth == 0 {
                // Check for block-opening keywords that we want to skip (test/describe).
                let is_test_block = trimmed.starts_with("test(") || trimmed.starts_with("test (")
                    || trimmed.starts_with("describe(") || trimmed.starts_with("describe (");
                if is_test_block {
                    in_skip_block = true;
                    // Count 'do' on this line to increase depth
                    let do_count = count_do_in_line(trimmed);
                    let end_count = count_end_in_line(trimmed);
                    depth = (depth + do_count).saturating_sub(end_count);
                } else if in_skip_block {
                    // Track depth
                    let do_count = count_do_in_line(trimmed);
                    let end_count = count_end_in_line(trimmed);
                    depth = (depth + do_count).saturating_sub(end_count);
                    if depth == 0 {
                        in_skip_block = false;
                    }
                } else {
                    out.push_str(&pending_line);
                    out.push('\n');
                }
            } else {
                // Inside a skip block
                let do_count = count_do_in_line(trimmed);
                let end_count = count_end_in_line(trimmed);
                depth = (depth + do_count).saturating_sub(end_count);
                if depth == 0 {
                    in_skip_block = false;
                }
            }

            pending_line.clear();
            i += 1;
            continue;
        }

        pending_line.push(ch);
        i += 1;
    }

    // Emit any trailing content
    if !pending_line.is_empty() && !in_skip_block {
        out.push_str(&pending_line);
        out.push('\n');
    }

    if !out.trim().is_empty() {
        out.push('\n');
    }
}

/// Count `do` keyword occurrences in a line (for depth tracking).
fn count_do_in_line(line: &str) -> usize {
    // Simple counting: don't bother with strings for now.
    // Keywords: "do" surrounded by non-alphanumeric chars.
    let mut count = 0;
    let chars: Vec<char> = line.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '#' { break; } // line comment
        if i + 2 <= chars.len()
            && &line[i..i+2] == "do"
            && (i == 0 || !chars[i-1].is_alphanumeric() && chars[i-1] != '_')
            && (i + 2 == chars.len() || !chars[i+2].is_alphanumeric() && chars[i+2] != '_')
        {
            count += 1;
            i += 2;
        } else {
            i += 1;
        }
    }
    count
}

/// Count `end` keyword occurrences in a line (for depth tracking).
fn count_end_in_line(line: &str) -> usize {
    let mut count = 0;
    let chars: Vec<char> = line.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '#' { break; }
        if i + 3 <= chars.len()
            && &line[i..i+3] == "end"
            && (i == 0 || !chars[i-1].is_alphanumeric() && chars[i-1] != '_')
            && (i + 3 == chars.len() || !chars[i+3].is_alphanumeric() && chars[i+3] != '_')
        {
            count += 1;
            i += 3;
        } else {
            i += 1;
        }
    }
    count
}

// ── Recursively discover all *.test.mpl files in a directory ─────────────

fn discover_test_files(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    discover_recursive(root, &mut files)
        .map_err(|e| format!("Failed to walk '{}': {}", root.display(), e))?;
    files.sort();
    Ok(files)
}

fn discover_recursive(dir: &Path, files: &mut Vec<PathBuf>) -> std::io::Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        // Skip hidden directories (e.g., .planning, .git, target) and build artifacts
        if name_str.starts_with('.') || name_str == "target" {
            continue;
        }
        if path.is_dir() {
            discover_recursive(&path, files)?;
        } else if path.file_name()
            .and_then(|n| n.to_str())
            .map(|n| n.ends_with(".test.mpl"))
            .unwrap_or(false)
        {
            files.push(path);
        }
    }
    Ok(())
}
