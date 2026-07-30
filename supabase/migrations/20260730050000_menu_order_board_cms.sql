-- Retarget public dining CTAs to the unified /menu order board.
update cms_pages
set
  eyebrow = 'Menu',
  title = 'Add, review, order.',
  body = 'Every cafe, pastry, restaurant, and bar dish in one live list. Tap Add and your order builds on the right — pickup or Thimphu taxi delivery.',
  primary_cta_href = '/menu',
  primary_cta_label = 'Order now',
  secondary_cta_href = '/cafe',
  secondary_cta_label = 'Cafe & pastry',
  updated_at = now()
where slug = 'dine';

update cms_pages
set
  primary_cta_href = '/menu?outlet=cafe',
  secondary_cta_href = '/menu',
  secondary_cta_label = 'Full menu',
  updated_at = now()
where slug = 'cafe';

update cms_pages
set
  primary_cta_href = '/menu?outlet=restaurant',
  primary_cta_label = 'Order restaurant food',
  updated_at = now()
where slug = 'restaurant';

update cms_pages
set
  primary_cta_href = '/menu',
  primary_cta_label = 'Full menu',
  updated_at = now()
where slug = 'bar';
