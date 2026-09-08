-- PART 3: Insert default data and admin account
insert into public.system_settings (setting_key, setting_value) values
  ('withdrawal_minimum_amount', '300'),
  ('tab_monitoring_visible', 'true'),
  ('tab_subadmin_visible', 'true'),
  ('tab_terms_visible', 'true'),
  ('tab_complan_visible', 'true')
on conflict (setting_key) do nothing;

insert into public.members (username, password, full_name, referral_code, status, role, tree_level)
values ('admin', 'admin123', 'Administrator', 'ADMIN001', 'approved', 'admin', 0)
on conflict (username) do nothing;
