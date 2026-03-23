pub fn handle_health(request) do
  HTTP.response(200, json { status: "ok" })
end
