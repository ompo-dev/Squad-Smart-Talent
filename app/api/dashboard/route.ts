import { NextResponse } from "next/server";
import { dashboardMock } from "@/lib/mock";
export async function GET() { return NextResponse.json(dashboardMock, { headers: { "Cache-Control": "public, max-age=30" } }); }
