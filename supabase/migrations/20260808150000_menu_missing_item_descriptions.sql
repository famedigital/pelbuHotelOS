-- Guest-facing menu blurbs for items that previously had no description.

update public.menu_items set description =
  'Warm black tea brewed with milk and a light spice — comforting and gentle, served hot.'
where name = 'Milk Tea' and outlet = 'restaurant';

update public.menu_items set description =
  'Fragrant wok-tossed rice with seasonal vegetables, light soy, and spring onion. Vegetarian.'
where name = 'Veg Fried Rice' and outlet = 'restaurant';

update public.menu_items set description =
  'Bhutan’s classic chili–cheese stew: green chili and melting cheese, rich and spicy, with rice on the side recommended.'
where name = 'Ema datsi' and outlet = 'restaurant';

update public.menu_items set description =
  'Crisp chicken stir-fried with green chili, onion, and peppers in a glossy Indo-Chinese sauce.'
where name = 'Chicken chilli' and outlet = 'restaurant';

update public.menu_items set description =
  'Soft whole-wheat flatbreads, hot off the griddle — perfect with curries and stews.'
where name = 'Roti' and outlet = 'restaurant';

update public.menu_items set description =
  'Dark rum served by the measure as ordered. Confirm pour size with the bar.'
where name = 'Old Monk' and outlet = 'bar';

update public.menu_items set description =
  'Bhutanese malt spirit (K5) by the pour — smooth and warming. Ask the team for measure options.'
where name = 'K5' and outlet = 'cafe';

update public.menu_items set description =
  'Chilled Bhutan Agro mineral water — pure bottled spring water for the table.'
where name = 'Mineral water' and outlet = 'restaurant';
