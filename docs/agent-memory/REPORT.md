# Agent memory report

Compiled 2026-10-23 from 50 parent chats and 812 keyword lines.

Agents do not load this report or the keyword file whole. Each question runs a local hook that injects at most four matching lines inside `<mem>`. The same line is not injected again in that chat.

Operating facts are the `seed` lines at the top of `.cursor/memory/KEYWORDS.md`. Every later user ask is one keyword line. New chats append a `live` line when the agent finishes.

## Operating facts

- Every agent chat is stored as one keyword line in .cursor/memory/KEYWORDS.md. The beforeSubmitPrompt hook injects only matching lines. Do not load the file whole.
- Open-folio edits use cookie hotelos_folio_edit for 4 hours after the manager PIN, scoped to one property. After the master bill, corrections are a credit note.
- Staff numbers are prefix + FN/BK/BN + year + 5 digits. Pelbu prefix is PS: folio PSFN-2026-00160, booking PSBK-2026-00088, master bill PSBN-2026-00041. Booking code PS-2026-00160 is not the folio number.
- Room prices stay on room_rates. An offer has a label (Standard and others), optional agent_id, optional guest_label, and active. The stay copies the chosen nightly amount.
- A stay-card print failed with column folios_1.doc_no does not exist. Confirm the column exists before selecting it.
- A zero balance must not settle the folio until the master bill exists. maybeSettleZeroBalanceFolio still runs from issue-document, folio ops, and POS.

## Deploy and login (60)

- Ask: commit and deploy (a0d9c6b6)
- Ask: deploy (8f45e9fd)
- Ask: so now u see the issues, i am not able to do anything from the main droplet site, i still ve to depend on u here in cursor ide, so innora is not… (db93bf8a)
- Ask: fix it and deploy (db93bf8a)
- Ask: before it was in vercel and supabase cloud now it is in droplet, the design, architecture, codebase, everything has to adopt to droplet right, i dont… (a72c49e1)
- Ask: Adapt the desk to the droplet Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself. To-do's from the… (a72c49e1)

## Folio, bill, GST (113)

- Ask: i just thought of sth else, u see today i had to do so many changes in folio, so is it possible to have a edit option, put manager pin, than can edit… (d039dffd)
- Ask: and folio can u make it more human readible room type and room no check-in & check-out no of nights no of guests rates total Amount Hotel name FNX… (d039dffd)
- Ask: Central rates, then folio edit Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself. To-do's from the… (d039dffd)
- Ask: where to print folio for tomorow check out (d039dffd)
- Ask: i want to print folio for this (d039dffd)
- Ask: PS-2026-00160 it sud be PSFN-2026-xx right?? we talked abt this earlier right?? (d039dffd)

## Rates (47)

- Ask: and i need central rate module, where all rates are stored there, public, agents, personal, specific agents rates, and so on. we ve diff diff rates.… (d039dffd)
- Ask: and wat is that agreed rate and stuff (a0d9c6b6)
- Ask: rate change dialogue box is not on TOPPEST layer (4eeede49)
- Ask: ad tours, dainty and travel yak & yeti (have lunch as well, 202 lunch Chicken Daal Sabji Rice 2pax) none of them are paid one, rates are all 5600… (db93bf8a)
- Ask: BTW check the room rates from sheet comments also ok @c:\Users\rajiv\Downloads\Reservation 2026 (3).xlsx (db93bf8a)
- Ask: and pelbu suites olakha is total of 27 rooms, 26 deluxe, 1 suite @docs/rate-public.html check here all actual room inventory and rates (d639dba3)

## Rooms and stays (78)

- Ask: http://localhost:3000/erp/in-house?booking=6f73719f-677d-42e3-89d0-4cecc76db106&step=stay_money weird page need complete 360 redesign , it sud be… (d039dffd)
- Ask: http://localhost:3000/erp/in-house this page also completely redesign (d039dffd)
- Ask: Little Bhutan Guest Name: Mrs. Olwyn Jung x 5 Pax (Canada) Check-in: 22nd Oct, 2026 Check-out: 24th Oct, 2026 Number of nights: 2 Room Category: 2… (56bae2c1)
- Ask: @c:\Users\rajiv\Downloads\Reservation 2026 (3).xlsx as per this can u put all reservation till date and future to correct agent list, u see ST means… (56bae2c1)
- Ask: Walk-In Guest Group Name: Check-In: 19/10/2026 Check-Out: 23/10/2026 Meal: CP(4000 X 4Nights) Keep Specific Room 501 Twin bed By whatsapp(17481672)… (a0d9c6b6)
- Ask: need option in in-house list, to assign diff rooms, as there was mistake, so i guess we need manager pin first, than can edit any in-house list to… (a0d9c6b6)

## Agents (24)

- Ask: Available subagent_types and a quick description of what they do: - generalPurpose: General-purpose agent for researching complex questions,… (d039dffd)
- Ask: can u gather all the agents transcript chat and compile a reports, and put all those into memory of this project so agents knws abt it (eb7848d2)
- Ask: one agent is making stayhub as sidehub, check (db93bf8a)
- Ask: wat skill u need to copy from github?? to make this project a living project with agents attached to it from here, i am looking to sth a AI agent… (a72c49e1)
- Ask: @c:\Users\rajiv\Downloads\aura_enterprise_pms_portal.html check dis design (d639dba3)
- Ask: cant type agent name to search repeated menu, big table row, very less space to work, how about the sub menu comes in side bar?? is it intelligent?? (d639dba3)

## POS and kitchen (33)

- Ask: no just create it in pos (40f7ffae)
- Ask: PREPARE THE fnb guest list to sign, as we dont knw which guests have gone and come (5cd5681e)
- Ask: hw to send pos re\ceipt via whatsapp (3b0e44b9)
- Ask: i did back to pos, no sidebar, no top bar?? have to refresh to get all of them (449f8f60)
- Ask: ok now, i have 1 big issue KITCHEN 2 GUY, FNB TEAM they are never on time, sometimes doesn come to work, they come and go, purchase mgt zero, like i… (6acbe198)
- Ask: can u send this user to pelbu suites olakha POS (6acbe198)

## Desk UI (27)

- Ask: Stay card redesign Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself. To-do's from the plan have… (d039dffd)
- Ask: @c:\Users\rajiv\Videos\Screen Recordings\Screen Recording 2026-10-[phone].mp4 (db93bf8a)
- Ask: so looking at this, u must have found a pattern, a premium component in shadcn (90fc0e2b)
- Ask: Full-surface redesign (all ~197 scanned pages) Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.… (90fc0e2b)
- Ask: REMOVE THIS IMPROVE THE DASHBOARD MORE PROFESSIONAL, COMPACT, USE PREMIUM SHADCN (90fc0e2b)
- Ask: and regarding the stay hub, making things are still confusing to me also analyze, fix the term, use common wording, also fix the flow, for single,… (0bcf2baa)

## Other (424)

- Ask: make it more compact and professional, cuz middle one needs more space to work, and i think u sud increase the width lil but (d039dffd)
- Ask: Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself. To-do's from the plan have already been… (d039dffd)
- Ask: where to edit those Description? (d039dffd)
- Ask: i click stay, url changes to /stay than it change to arrival (d039dffd)
- Ask: http://localhost:3000/erp/arrivals need to completely change the design (d039dffd)
- Ask: all sidebar need to increase the width (d039dffd)

## Chat catalog

- 2026-10-23 `d039dffd` — i just thought of sth else, u see today i had to do so many changes in folio, so is it possible to have a… (21 asks)
- 2026-10-23 `eb7848d2` — can u gather all the agents transcript chat and compile a reports, and put all those into memory of this… (1 asks)
- 2026-10-23 `56bae2c1` — there is no folio for this (23 asks)
- 2026-10-23 `a0d9c6b6` — Walk-In Guest Group Name: Check-In: 19/10/2026 Check-Out: 23/10/2026 Meal: CP(4000 X 4Nights) Keep Specific… (21 asks)
- 2026-10-23 `6046ff63` — Arrival for the day Bhutan - Bhutan Travel(12Pax)- MAP, Nat:Belgium Room No. #302/303/304/305/403/503/404 Yak… (8 asks)
- 2026-10-23 `4eeede49` — Date 23 Oct 2026 Inv no. INV-2026-0091 Room 506 Click to change the room number. Print uses what you type.… (5 asks)
- 2026-10-23 `d406a02d` — Date 23 Oct 2026 Inv no. INV-2026-0093 Room 503, 504 Click to change the room number. Print uses what you… (8 asks)
- 2026-10-23 `92689a6d` — Mr. Jianzhou Jason Zhao 201 In-house · Room 201 occupied · Little Bhutan 10-21→10-23 · PS-2026-00029 no… (2 asks)
- 2026-10-23 `8f45e9fd` — deploy (1 asks)
- 2026-10-23 `db93bf8a` — so 23 oct, hw many rooms and agents are checking out, list it, i ve to prepare the invoice, so far nthing is… (39 asks)
- 2026-10-23 `c59ec1ab` — which port are running?? (1 asks)
- 2026-10-23 `a72c49e1` — u ve all the detail knowledge of this project right (24 asks)
- 2026-10-23 `d639dba3` — @c:\Users\rajiv\Downloads\grand_horizon_front_desk_pms.tsx… (31 asks)
- 2026-10-22 `40f7ffae` — can u create a food bill in pelbu suites pos i ve pasted the items and amount and room no (14 asks)
- 2026-10-20 `90fc0e2b` — can u see all the pages, all the process?? USE DEMO HOTEL under thi02001 THIS IS UAT TESTING i want u to use… (80 asks)
- 2026-10-20 `5cd5681e` — PREPARE THE fnb guest list to sign, as we dont knw which guests have gone and come (2 asks)
- 2026-10-20 `aaab9cd6` — @docs/rate-public.html can u remove that gst and create new html for agent rate as follow incl of s.c 10%… (12 asks)
- 2026-10-18 `1a878f6a` — create a reservation local Norbu 502 suite room 8500 per night checkin 17 check 18 1 night make invoice (3 asks)
- 2026-10-17 `9e17c445` — ok do a thourough check on middleware logging in is not working (13 asks)
- 2026-10-17 `3b0e44b9` — @c:\Users\rajiv\Downloads\Travel Agent Payment .xlsx this is the payment collected and dues, updat the same… (50 asks)
- 2026-10-17 `0bcf2baa` — scan entire pages of this project and thier design, css, tokems, ui and give me a report analysis. this… (119 asks)
- 2026-10-16 `449f8f60` — @docs/rate-public.html where is the location (6 asks)
- 2026-10-15 `6acbe198` — How many staffs pelbu has, ?? from oct kelden anjana priya has left (16 asks)
- 2026-10-14 `ab96ce53` — Create a New property tenant PELBU SUITES OLAKHA @c:\Users\rajiv\Downloads\Reservation 2026.xlsx this is the… (37 asks)
- 2026-10-14 `b27a6981` — please copy the menu for pos from pelbu suites to pelbu suites olakha (10 asks)
- 2026-10-14 `4def87c3` — i didnt like this ui layout and design, its looking confusing, cramped, plz see which shadcn components we… (19 asks)
- 2026-10-13 `1a4c5696` — this design is not good, u need make the layout professional, invoice preview in right, options in left (4 asks)
- 2026-10-10 `5dbb1511` — make a bill LUNCH grateful Bhutan 2 pax, lunch Beef, chicken drumstick, mash potato, mixed veg 1350 + 10% S.C… (2 asks)
- 2026-10-08 `d46467db` — create a MAP of everything abt this project related to UI, css, components, buttons, everything, create… (23 asks)
- 2026-10-07 `571e22ce` — financial module 1. bank statement recouncilation: a. every income sud be recounciled with invoices and pos… (18 asks)
- 2026-10-07 `cbfbd7a0` — do u have access to pelbu suites staffs details?? (54 asks)
- 2026-10-07 `be1a091c` — lets plan to design the front public page, u keep on asking me my requirement if u want, or present me the… (76 asks)
- 2026-09-29 `d4787e6d` — what are the websites, where i an copy the UI template, that includes css, layout, text, fonts, everything (3 asks)
- 2026-09-29 `71694a05` — ok now, i want u to create a ops sop for HOTEL i have following staffs FO: anjana rigzang mohan Meg Raj F&B… (5 asks)
- 2026-09-28 `25f2890a` — https://southeasthimalaya.com/ run a analysis, i knw this is fully AI generated. jst get me niche details (3 asks)
- 2026-09-28 `ee140f45` — work on this images, this are all false images not real gho and kira browse the internet (7 asks)
- 2026-09-28 `0ec3038e` — we have biometric installed, its network, i want to integrate biometric to this software so i can see which… (14 asks)
- 2026-09-28 `5e165b00` — @web/docs/pelbu-invoice-14-heads.html sample reference create following invoice Lunch 550+10% S.c * 11 pax… (42 asks)
- 2026-09-28 `9d25cdb5` — i need a hotspot setup in this software, most hotel uses hotspot express, they have setup fortigate, than 1… (16 asks)
- 2026-09-28 `9219af64` — scan entire hotel ERP, make a map of everything, hw they are interconnected and hw they functions make of… (9 asks)
- 2026-09-28 `664f11cd` — now somehotel like mine pelbusuites uses keycard, now keycard has its own software where we ve to programed… (1 asks)
- 2026-09-28 `51c79d21` — i want u to analyse the reservation process,(1 room or multiple rooms as group) booking process, sending… (50 asks)
- 2026-09-27 `7e73dd46` — ok this modal check-in and check-out nights arrange more better, and room assignment beside this row only… (10 asks)
- 2026-09-26 `839f028d` — need to redefine the login screen 1. first hotel code, after authentication only username and password… (53 asks)
- 2026-09-26 `aca4419d` — i need features, which agents who have checkout didnt pay, who paid, all this kinda reports needed, so we can… (1 asks)
- 2026-09-25 `1a1421f7` — wat is the standard rule of optimizing droplet sin digital ocean, how often we have to optimize, i thought… (2 asks)
- 2026-09-25 `a11e2a77` — in the os 1. for every department (fo, f&b ,kitchen, hk, laundry) need following information at dashboard and… (4 asks)
- 2026-09-16 `d73136a7` — pull and sync (9 asks)
- 2026-09-15 `dea79a97` — C:\GitHub\pelbusuites copy the erp, dont copy the website, i want to white lable the ERP for all hotels as… (30 asks)
- 2026-09-15 `dc54dac0` — You are working in C:\GitHub\Hotel OS Bhutan (NOT pelbusuites). Website routes/components were already… (2 asks)
