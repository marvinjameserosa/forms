insert into public.merch_items (name, tag, image, tone, price, sizes, sort_order)
values
  ('Black Shirt', 'Cotton Tee', '/shirts/adph_black_shirt1.png', 'from-slate-900/45 to-black/10', 240, array['XS','S','M','L','XL','XXL'], 10),
  ('Black Shirt (Alt)', 'Cotton Tee', '/shirts/adph_black_shirt2.png', 'from-slate-900/45 to-black/10', 240, array['XS','S','M','L','XL','XXL'], 20),
  ('White Shirt', 'Cotton Tee', '/shirts/adph_white_shirt1.png', 'from-slate-200/40 to-transparent', 240, array['XS','S','M','L','XL','XXL'], 30),
  ('White Shirt (Alt)', 'Cotton Tee', '/shirts/adph_white_shirt2.png', 'from-slate-200/40 to-transparent', 240, array['XS','S','M','L','XL','XXL'], 40),
  ('Black Tote Bag', 'Canvas Tote', '/tote_bag/black_tote_bag.png', 'from-slate-900/40 to-black/10', 145, array['One Size'], 50),
  ('White Tote Bag', 'Canvas Tote', '/tote_bag/white_tote_bag.png', 'from-slate-200/35 to-transparent', 115, array['One Size'], 60),
  ('Mug', 'Ceramic', '/mug/adph_mug.jpg', 'from-amber-200/35 to-transparent', 80, array['One Size'], 70),
  ('Ballpen', 'Fine Tip', '/ballpen/adph_ballpen.png', 'from-teal-400/30 to-transparent', 40, array['One Size'], 80);
