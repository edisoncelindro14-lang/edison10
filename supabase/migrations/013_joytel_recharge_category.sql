-- JoyTel recharges (joytel_type 9) are load products: they belong to the Load
-- category so they show up under E-Load and never under SIM cards or eSIM.
update public.products
set category = 'load'
where joytel_enabled = true
  and joytel_type = 9
  and category is distinct from 'load';

comment on column public.products.joytel_type is 'JoyTel order type: 1 = physical SIM, 3 = eSIM, 9 = JOY SIM recharge (Load)';
