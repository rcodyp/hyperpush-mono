//! HTTP client runtime for the Mesh language.
//!
//! Provides both the legacy HTTP.get/post functions (backward compat) and the
//! new Http client builder API (Http.build/header/body/timeout/query/json/send).
//! Uses `ureq` 3 for HTTP requests.

use std::time::Duration;

use crate::gc::mesh_gc_alloc_actor;
use crate::io::MeshResult;
use crate::string::{mesh_string_new, MeshString};
use crate::collections::map::{mesh_map_new_typed, mesh_map_put};
use ureq::Agent;

/// Allocate a MeshResult on the GC heap.
fn alloc_result(tag: u8, value: *mut u8) -> *mut MeshResult {
    unsafe {
        let ptr = mesh_gc_alloc_actor(
            std::mem::size_of::<MeshResult>() as u64,
            std::mem::align_of::<MeshResult>() as u64,
        ) as *mut MeshResult;
        (*ptr).tag = tag;
        (*ptr).value = value;
        ptr
    }
}

// ── Legacy HTTP GET/POST (backward compatibility, updated for ureq 3) ────────

/// Make an HTTP GET request. Returns MeshResult:
/// - tag 0 (Ok): value = MeshString response body
/// - tag 1 (Err): value = MeshString error message
#[no_mangle]
pub extern "C" fn mesh_http_get(url: *const MeshString) -> *mut u8 {
    unsafe {
        let url_str = (*url).as_str();
        let agent = Agent::new_with_defaults();
        match agent.get(url_str).call() {
            Ok(mut response) => {
                let body = response.body_mut().read_to_string().unwrap_or_default();
                let body_mesh = mesh_string_new(body.as_ptr(), body.len() as u64);
                alloc_result(0, body_mesh as *mut u8) as *mut u8
            }
            Err(e) => {
                let msg = e.to_string();
                let msg_mesh = mesh_string_new(msg.as_ptr(), msg.len() as u64);
                alloc_result(1, msg_mesh as *mut u8) as *mut u8
            }
        }
    }
}

/// Make an HTTP POST request with a body. Returns MeshResult:
/// - tag 0 (Ok): value = MeshString response body
/// - tag 1 (Err): value = MeshString error message
#[no_mangle]
pub extern "C" fn mesh_http_post(url: *const MeshString, body: *const MeshString) -> *mut u8 {
    unsafe {
        let url_str = (*url).as_str();
        let body_str = (*body).as_str().to_string();
        let agent = Agent::new_with_defaults();
        match agent
            .post(url_str)
            .header("Content-Type", "application/json")
            .send(body_str.as_bytes())
        {
            Ok(mut response) => {
                let resp_body = response.body_mut().read_to_string().unwrap_or_default();
                let body_mesh = mesh_string_new(resp_body.as_ptr(), resp_body.len() as u64);
                alloc_result(0, body_mesh as *mut u8) as *mut u8
            }
            Err(e) => {
                let msg = e.to_string();
                let msg_mesh = mesh_string_new(msg.as_ptr(), msg.len() as u64);
                alloc_result(1, msg_mesh as *mut u8) as *mut u8
            }
        }
    }
}

// ── Http client builder API (Phase 137) ──────────────────────────────────────

/// MeshRequestData: heap-owned Rust struct, returned as opaque u64 handle.
/// Never put on GC heap — use Box::into_raw pattern (same as SqliteConn).
struct MeshRequestData {
    method: String,
    url: String,
    headers: Vec<(String, String)>,
    body: Option<Vec<u8>>,
    timeout_ms: Option<u64>,
    is_json: bool,
    query_params: Vec<(String, String)>,
}

/// MeshClientResponse: GC-allocated #[repr(C)] struct with 3 fields.
/// Layout: { status: i64, body: *mut u8, headers: *mut u8 }
/// Field order MUST match the MirStructDef registered in lower.rs.
#[repr(C)]
pub struct MeshClientResponse {
    pub status: i64,
    pub body: *mut u8,    // *mut MeshString (GC-allocated)
    pub headers: *mut u8, // *mut MeshMap (GC-allocated)
}

/// Http.build(method: String, url: String) -> Int (opaque handle)
///
/// Allocates a MeshRequestData on the Rust heap and returns it as an opaque u64.
/// The method atom is passed as a string (atom lowered to string ABI).
#[no_mangle]
pub extern "C" fn mesh_http_build(
    method: *const MeshString,
    url: *const MeshString,
) -> u64 {
    unsafe {
        let method_str = (*method).as_str().to_lowercase();
        let url_str = (*url).as_str().to_string();

        let data = Box::new(MeshRequestData {
            method: method_str,
            url: url_str,
            headers: Vec::new(),
            body: None,
            timeout_ms: None,
            is_json: false,
            query_params: Vec::new(),
        });

        Box::into_raw(data) as u64
    }
}

/// Http.header(req: Int, key: String, val: String) -> Int (same handle)
#[no_mangle]
pub extern "C" fn mesh_http_header(
    handle: u64,
    key: *const MeshString,
    val: *const MeshString,
) -> u64 {
    unsafe {
        let data = &mut *(handle as *mut MeshRequestData);
        let key_str = (*key).as_str().to_string();
        let val_str = (*val).as_str().to_string();
        data.headers.push((key_str, val_str));
        handle
    }
}

/// Http.body(req: Int, body: String) -> Int (same handle)
#[no_mangle]
pub extern "C" fn mesh_http_body(
    handle: u64,
    body: *const MeshString,
) -> u64 {
    unsafe {
        let data = &mut *(handle as *mut MeshRequestData);
        let body_str = (*body).as_str().as_bytes().to_vec();
        data.body = Some(body_str);
        handle
    }
}

/// Http.timeout(req: Int, ms: i64) -> Int (same handle)
#[no_mangle]
pub extern "C" fn mesh_http_timeout(handle: u64, ms: i64) -> u64 {
    unsafe {
        let data = &mut *(handle as *mut MeshRequestData);
        data.timeout_ms = Some(ms as u64);
        handle
    }
}

/// Http.query(req: Int, key: String, val: String) -> Int (same handle)
#[no_mangle]
pub extern "C" fn mesh_http_query(
    handle: u64,
    key: *const MeshString,
    val: *const MeshString,
) -> u64 {
    unsafe {
        let data = &mut *(handle as *mut MeshRequestData);
        let key_str = (*key).as_str().to_string();
        let val_str = (*val).as_str().to_string();
        data.query_params.push((key_str, val_str));
        handle
    }
}

/// Http.json(req: Int, body: String) -> Int (same handle)
///
/// Sets the body and marks the request as JSON (sets Content-Type: application/json).
#[no_mangle]
pub extern "C" fn mesh_http_json(
    handle: u64,
    body: *const MeshString,
) -> u64 {
    unsafe {
        let data = &mut *(handle as *mut MeshRequestData);
        let body_str = (*body).as_str().as_bytes().to_vec();
        data.body = Some(body_str);
        data.is_json = true;
        handle
    }
}

/// Http.send(req: Int) -> *mut u8 (Result<HttpResponse, String>)
///
/// Executes the HTTP request described by the opaque handle.
/// Returns a GC-allocated MeshResult:
///   - tag 0 (Ok): value = *mut MeshClientResponse
///   - tag 1 (Err): value = *mut MeshString with error message
///
/// Error message format:
///   "TIMEOUT: ..." for timeout errors
///   "DNS_FAILURE: ..." for DNS resolution errors
///   "TLS_ERROR: ..." for TLS errors
///   other errors as-is
#[no_mangle]
pub extern "C" fn mesh_http_send(handle: u64) -> *mut u8 {
    unsafe {
        // Take ownership of the request data
        let data = Box::from_raw(handle as *mut MeshRequestData);

        // Build the URL with query parameters
        let url_with_query = if data.query_params.is_empty() {
            data.url.clone()
        } else {
            let params: Vec<String> = data
                .query_params
                .iter()
                .map(|(k, v)| format!("{}={}", url_encode(k), url_encode(v)))
                .collect();
            if data.url.contains('?') {
                format!("{}&{}", data.url, params.join("&"))
            } else {
                format!("{}?{}", data.url, params.join("&"))
            }
        };

        // Build agent with optional timeout
        let timeout = data.timeout_ms.unwrap_or(30_000);
        let agent: Agent = Agent::config_builder()
            .timeout_global(Some(Duration::from_millis(timeout)))
            .http_status_as_error(false)
            .build()
            .into();

        // Determine if we have a body to send
        let method = data.method.as_str();
        let is_body_method = matches!(method, "post" | "put" | "patch" | "delete");

        // Build and execute the request
        let result: Result<ureq::http::Response<ureq::Body>, ureq::Error> = if is_body_method || data.body.is_some() {
            // Method with body — dispatch to the correct HTTP method
            let req = match method {
                "post" => agent.post(&url_with_query),
                "put" => agent.put(&url_with_query),
                "patch" => agent.patch(&url_with_query),
                _ => agent.post(&url_with_query), // DELETE with body falls back to post shape
            };

            // Add headers
            let req = data.headers.iter().fold(req, |r, (k, v)| r.header(k.as_str(), v.as_str()));

            // Add JSON content-type if needed
            let req = if data.is_json {
                req.header("Content-Type", "application/json")
            } else {
                req
            };

            // Send with or without body
            if let Some(body_bytes) = data.body {
                req.send(body_bytes.as_slice())
            } else {
                req.send(b"".as_ref())
            }
        } else {
            // Method without body (GET, HEAD, DELETE, OPTIONS)
            let req = match method {
                "get" => agent.get(&url_with_query),
                "head" => agent.head(&url_with_query),
                "delete" => agent.delete(&url_with_query),
                "options" => agent.options(&url_with_query),
                _ => agent.get(&url_with_query), // fallback
            };

            // Add headers
            let req = data.headers.iter().fold(req, |r, (k, v)| r.header(k.as_str(), v.as_str()));

            req.call()
        };

        match result {
            Ok(mut response) => {
                // Extract status code
                let status: i64 = response.status().as_u16() as i64;

                // Extract body
                let body_str = response.body_mut().read_to_string().unwrap_or_default();
                let body_mesh = mesh_string_new(body_str.as_ptr(), body_str.len() as u64);

                // Extract headers into a MeshMap
                let mut headers_map = mesh_map_new_typed(1); // 1 = string-keyed
                for (name, value) in response.headers() {
                    let name_str = name.as_str();
                    let value_str = value.to_str().unwrap_or("");
                    let key = mesh_string_new(name_str.as_ptr(), name_str.len() as u64);
                    let val = mesh_string_new(value_str.as_ptr(), value_str.len() as u64);
                    headers_map = mesh_map_put(headers_map, key as u64, val as u64);
                }

                // Allocate MeshClientResponse on GC heap
                let resp_ptr = mesh_gc_alloc_actor(
                    std::mem::size_of::<MeshClientResponse>() as u64,
                    std::mem::align_of::<MeshClientResponse>() as u64,
                ) as *mut MeshClientResponse;

                (*resp_ptr).status = status;
                (*resp_ptr).body = body_mesh as *mut u8;
                (*resp_ptr).headers = headers_map as *mut u8;

                alloc_result(0, resp_ptr as *mut u8) as *mut u8
            }
            Err(e) => {
                let msg = format_error(&e);
                let msg_mesh = mesh_string_new(msg.as_ptr(), msg.len() as u64);
                alloc_result(1, msg_mesh as *mut u8) as *mut u8
            }
        }
    }
}

/// Format ureq 3 errors with structured prefixes for Mesh error matching.
fn format_error(e: &ureq::Error) -> String {
    let msg = e.to_string();
    // Classify common error types
    if msg.contains("timed out") || msg.contains("timeout") {
        format!("TIMEOUT: {}", msg)
    } else if msg.contains("dns") || msg.contains("resolve") || msg.contains("failed to lookup") {
        format!("DNS_FAILURE: {}", msg)
    } else if msg.contains("tls") || msg.contains("TLS") || msg.contains("certificate") {
        format!("TLS_ERROR: {}", msg)
    } else {
        msg
    }
}

/// Simple percent-encode for query parameter keys and values.
/// Encodes characters that are not unreserved (RFC 3986).
fn url_encode(s: &str) -> String {
    let mut encoded = String::with_capacity(s.len());
    for byte in s.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9'
            | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            b => {
                encoded.push('%');
                encoded.push(char::from_digit((b >> 4) as u32, 16).unwrap_or('0').to_ascii_uppercase());
                encoded.push(char::from_digit((b & 0xf) as u32, 16).unwrap_or('0').to_ascii_uppercase());
            }
        }
    }
    encoded
}

// Note: HTTP client tests are not included since they require network access.
// The client is tested via E2E integration tests or manual testing.
