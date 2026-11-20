-- Prompt 1.9: map routes and timelines are public reference data for the visual panel.
drop policy if exists map_routes_read on map_routes;
create policy map_routes_read on map_routes for select to anon, authenticated using (true);
drop policy if exists timelines_read on timelines;
create policy timelines_read on timelines for select to anon, authenticated using (true);
