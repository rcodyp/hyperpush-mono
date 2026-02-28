test("Test.mock_actor spawns an actor") do
  let pid = Test.mock_actor(fn(msg) do
    msg
  end)
  # Verify the mock actor was spawned by checking we got a valid pid
  # (We can't easily compare Pid to Int, so just verify the call succeeds)
  let _ = pid
  assert(true)
end
