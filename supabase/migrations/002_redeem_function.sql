create or replace function public.redeem_maintenance_code(p_code text,p_member_id uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare c public.maintenance_codes%rowtype; m public.members%rowtype; u public.members%rowtype; lvl integer; bonus numeric;
begin
  select * into m from public.members where id=p_member_id and status='approved' for update;
  if not found then raise exception 'Member not found'; end if;

  select * into c from public.maintenance_codes where code=p_code for update;
  if not found then raise exception 'Maintenance code not found'; end if;
  if c.is_used then raise exception 'Maintenance code has already been used'; end if;
  if c.assigned_username is not null and c.assigned_username <> m.username then raise exception 'This code is locked to another username'; end if;
  if c.assigned_sub_admin_id is not null and c.assigned_sub_admin_id <> p_member_id and m.role <> 'admin' then raise exception 'Code is assigned to another sub-admin'; end if;

  update public.maintenance_codes
  set is_used=true,used_by_member_id=p_member_id,used_at=now()
  where id=c.id;

  update public.members
  set maintenance_timer_seconds=null,maintenance_timer_set_at=null,updated_at=now()
  where id=p_member_id;

  for lvl in 1..5 loop
    if lvl=1 then
      select * into u from public.members where id=m.referrer_id and status='approved';
    else
      select * into u from public.members where id=(select placement_id from public.members where id=u.id) and status='approved';
    end if;
    exit when not found;
    if u.id=p_member_id then continue; end if;
    if (public.compute_maintenance_status(u.id)->>'isGreen')::boolean then
      select bonus_amount into bonus from public.level_bonuses where level=lvl and is_active=true;
      if bonus is not null then
        insert into public.transactions(member_id,type,amount,description,status,from_member_id,bonus_level)
        values(u.id,'level_bonus',bonus,'Level '||lvl||' bonus from maintenance redemption','completed',p_member_id,lvl);
        update public.members set total_earnings=total_earnings+bonus,available_balance=available_balance+bonus,updated_at=now() where id=u.id;
      end if;
    end if;
  end loop;

  return jsonb_build_object('success',true,'code',c.code,'member_id',p_member_id);
end $$;