from Config import database_url_key, port_key, job_poll_ms_key, missing_required_env, invalid_positive_int
from Api.Router import build_router

fn normalize_positive_int(value :: Int) -> Int do
  if value > 0 do
    value
  else
    -1
  end
end

fn parse_required_positive_int(raw :: String) -> Int do
  let parsed = String.to_int(raw)
  case parsed do
    Some(value) -> normalize_positive_int(value)
    None -> -1
  end
end

fn required_positive_int_error(name :: String, raw :: String, value :: Int) -> String do
  if value > 0 do
    ""
  else
    if raw == "" do
      missing_required_env(name)
    else
      invalid_positive_int(name)
    end
  end
end

fn start_runtime(port :: Int, job_poll_ms :: Int, pool :: PoolHandle) do
  println("[reference-backend] Runtime ready worker_poll_ms=#{job_poll_ms}")
  let router = build_router()
  println("[reference-backend] HTTP server starting on :#{port}")
  HTTP.serve(router, port)
end

fn on_pool_ready(port :: Int, job_poll_ms :: Int, pool :: PoolHandle) do
  println("[reference-backend] PostgreSQL pool ready")
  start_runtime(port, job_poll_ms, pool)
end

fn start_with_values(database_url :: String, port :: Int, job_poll_ms :: Int) do
  println("[reference-backend] Config loaded port=#{port} job_poll_ms=#{job_poll_ms}")
  println("[reference-backend] Connecting to PostgreSQL pool...")
  let pool_result = Pool.open(database_url, 1, 4, 5000)
  case pool_result do
    Ok(pool) -> on_pool_ready(port, job_poll_ms, pool)
    Err(e) -> println("[reference-backend] PostgreSQL connect failed: #{e}")
  end
end

fn maybe_start_with_port(database_url :: String, port_raw :: String, job_poll_ms_raw :: String) do
  let port_env = port_key()
  let port = parse_required_positive_int(port_raw)
  let port_error = required_positive_int_error(port_env, port_raw, port)
  if port_error != "" do
    println("[reference-backend] Config error: #{port_error}")
  else
    let job_poll_ms_env = job_poll_ms_key()
    let job_poll_ms = parse_required_positive_int(job_poll_ms_raw)
    let job_poll_ms_error = required_positive_int_error(job_poll_ms_env, job_poll_ms_raw, job_poll_ms)
    if job_poll_ms_error != "" do
      println("[reference-backend] Config error: #{job_poll_ms_error}")
    else
      start_with_values(database_url, port, job_poll_ms)
    end
  end
end

fn main() do
  let database_url_env = database_url_key()
  let database_url = Env.get(database_url_env, "")
  if database_url == "" do
    println("[reference-backend] Config error: #{missing_required_env(database_url_env)}")
  else
    let port_raw = Env.get(port_key(), "")
    let job_poll_ms_raw = Env.get(job_poll_ms_key(), "")
    maybe_start_with_port(database_url, port_raw, job_poll_ms_raw)
  end
end
