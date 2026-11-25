-- Vor der 3.2.2-Migration auf der lokalen Testdatenbank laden.
insert into public.farms (id, name) values
  ('a2200000-0000-4000-8000-000000000001', 'MAT-Testbetrieb mit eindeutigen Kurven'),
  ('a2200000-0000-4000-8000-000000000002', 'MAT-Testbetrieb mit verschiedenen Kurven'),
  ('a2200000-0000-4000-8000-000000000003', 'MAT-Testbetrieb mit Vollmilch');

insert into public.farm_milk_curves (farm_id, name, breed, sex, milk_type, grams_per_liter, points) values
  ('a2200000-0000-4000-8000-000000000001', 'MAT weiblich', 'Fleckvieh', 'female', 'mat', 150, '[{"day":0,"liters":5},{"day":30,"liters":7}]'),
  ('a2200000-0000-4000-8000-000000000001', 'MAT männlich', 'Fleckvieh', 'male', 'mat', 150, '[{"day":0,"liters":5},{"day":30,"liters":7}]'),
  ('a2200000-0000-4000-8000-000000000002', 'MAT weiblich', 'Fleckvieh', 'female', 'mat', 140, '[{"day":0,"liters":5},{"day":30,"liters":7}]'),
  ('a2200000-0000-4000-8000-000000000002', 'MAT männlich', 'Fleckvieh', 'male', 'mat', 160, '[{"day":0,"liters":5},{"day":30,"liters":7}]'),
  ('a2200000-0000-4000-8000-000000000003', 'Vollmilch weiblich', 'Fleckvieh', 'female', 'whole', 140, '[{"day":0,"liters":5},{"day":30,"liters":7}]');
