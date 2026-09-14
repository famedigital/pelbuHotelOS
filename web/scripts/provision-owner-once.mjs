/**
 * One-shot: create Olakha OWNER-01 staff + Auth PIN (desk_role = owner).
 * Run: node --env-file=.env.local scripts/provision-owner-once.mjs
 * Do not commit the printed PIN.
 */
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const PROPERTY_ID = "c22c44c1-547c-4351-b1ec-608f6590e340";
const EMPLOYEE_CODE = "OWNER-01";
const PIN = String(randomInt(10_000_000, 99_999_999));

function staffAuthEmail(propertyId, employeeCode) {
  const propertyKey = propertyId.replace(/-/g, "").slice(0, 12).toLowerCase();
  const code = employeeCode.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  return `${code}.${propertyKey}@staff.pelbusuites.internal`;
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: existing, error: lookErr } = await admin
  .from("staff_members")
  .select("id, auth_user_id, employee_code, can_access_desk, desk_role")
  .eq("property_id", PROPERTY_ID)
  .eq("employee_code", EMPLOYEE_CODE)
  .maybeSingle();
if (lookErr) {
  console.error(lookErr.message);
  process.exit(1);
}

let staffId = existing?.id ?? null;
let authUserId = existing?.auth_user_id ?? null;

if (!staffId) {
  const { data: inserted, error: insErr } = await admin
    .from("staff_members")
    .insert({
      property_id: PROPERTY_ID,
      employee_code: EMPLOYEE_CODE,
      full_name: "Property Owner",
      role_label: "manager",
      access_level: "owner",
      desk_role: "owner",
      department: "Management",
      position_title: "Owner",
      employment_type: "full_time",
      status: "active",
      can_login: false,
      can_access_desk: true,
    })
    .select("id")
    .single();
  if (insErr) {
    console.error(insErr.message);
    process.exit(1);
  }
  staffId = inserted.id;
}

const email = staffAuthEmail(PROPERTY_ID, EMPLOYEE_CODE);
const appMetadata = {
  kind: "staff",
  staff_id: staffId,
  property_id: PROPERTY_ID,
  access_level: "owner",
};

if (authUserId) {
  const { error } = await admin.auth.admin.updateUserById(authUserId, {
    password: PIN,
    app_metadata: appMetadata,
    ban_duration: "none",
  });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PIN,
    email_confirm: true,
    user_metadata: { full_name: "Property Owner" },
    app_metadata: appMetadata,
  });
  if (error || !data.user) {
    console.error(error?.message || "createUser failed");
    process.exit(1);
  }
  authUserId = data.user.id;
}

const { error: updErr } = await admin
  .from("staff_members")
  .update({
    auth_user_id: authUserId,
    can_login: true,
    can_access_desk: true,
    desk_role: "owner",
    access_level: "owner",
    pin_set_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  .eq("id", staffId);
if (updErr) {
  console.error(updErr.message);
  process.exit(1);
}

console.log("OK owner desk account ready");
console.log(`employee_code=${EMPLOYEE_CODE}`);
console.log(`desk_role=owner`);
console.log(`pin=${PIN}`);
console.log("Sign in at /staff/login or /erp/login (staff form)");
