from Api.Health import handle_health

pub fn build_router() do
  let router = HTTP.router()
    |> HTTP.on_get("/health", handle_health)
  router
end
