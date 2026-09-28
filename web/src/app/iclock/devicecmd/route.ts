import { handleIclockRequest } from "@/lib/zk-adms-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  return handleIclockRequest(request, "devicecmd");
}

export async function POST(request: Request): Promise<Response> {
  return handleIclockRequest(request, "devicecmd");
}
