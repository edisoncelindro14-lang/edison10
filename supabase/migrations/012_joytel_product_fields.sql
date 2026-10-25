-- Add JoyTel order details to products so each product card can carry
-- the JoyTel product code, SIM type and warehouse needed to place an order.
alter table public.products
  add column if not exists joytel_enabled boolean default false,
  add column if not exists joytel_product_code text,
  add column if not exists joytel_type int default 3,
  add column if not exists joytel_warehouse text;

comment on column public.products.joytel_enabled is 'When true, this product is fulfilled via the JoyTel API';
comment on column public.products.joytel_product_code is 'JoyTel productCode used when placing a customerOrder';
comment on column public.products.joytel_type is 'JoyTel order type: 1 = physical SIM, 3 = eSIM';
comment on column public.products.joytel_warehouse is 'JoyTel warehouse code for the order';
