import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

const BUCKET = "hr-private";
const AUTHORIZED_PATH = "signatures/authorized-signatory.png";
const NAME_PATH = "signatures/authorized-name.txt";

export function scriptSignatureDataUrl(name: string): string {
  const safe = name.replace(/[<>&"]/g, "").slice(0, 40) || "Sign";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 72">
    <path d="M12 46 C 36 18, 58 62, 86 40 S 132 14, 160 42 S 210 64, 262 34" fill="none" stroke="#1a1410" stroke-width="1.7" stroke-linecap="round"/>
    <text x="16" y="40" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="30" fill="#1a1410">${safe}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function signedUrl(admin: Admin, path: string): Promise<string | null> {
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 60 * 30);
  if (error || !data?.signedUrl) return null;
  const probe = await admin.storage.from(BUCKET).download(path);
  if (probe.error || !probe.data) return null;
  return data.signedUrl;
}

export async function loadBillSignatures(
  admin: Admin,
  staffId: string | null,
): Promise<{
  preparedSignature: string | null;
  signatoryName: string;
  signatorySignature: string | null;
}> {
  const [preparedSignature, uploadedSign, nameFile] = await Promise.all([
    staffId ? signedUrl(admin, `signatures/${staffId}.png`) : Promise.resolve(null),
    signedUrl(admin, AUTHORIZED_PATH),
    admin.storage.from(BUCKET).download(NAME_PATH),
  ]);
  const storedName = nameFile.data ? (await nameFile.data.text()).trim() : "";
  const signatoryName = storedName || "Choki";
  return {
    preparedSignature,
    signatoryName,
    signatorySignature: uploadedSign ?? scriptSignatureDataUrl(signatoryName),
  };
}

export async function saveSignatureFile(
  admin: Admin,
  path: string,
  file: File,
): Promise<string | null> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
    upsert: true,
    contentType: file.type || "image/png",
  });
  return error ? error.message : null;
}

export async function saveAuthorizedSignatoryName(admin: Admin, name: string): Promise<string | null> {
  const { error } = await admin.storage.from(BUCKET).upload(
    NAME_PATH,
    new TextEncoder().encode(name.trim() || "Choki"),
    { upsert: true, contentType: "text/plain" },
  );
  return error ? error.message : null;
}

export { AUTHORIZED_PATH, BUCKET };
