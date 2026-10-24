import {tracedRoute} from "@/lib/observability/server"
import { NextResponse } from "next/server";
import {getTelemetryView} from "@/lib/telemetry-view";
async function handleGET() { return NextResponse.json(await getTelemetryView(), { headers: { "Cache-Control": "no-store" } }); }

export const GET=tracedRoute("GET /api/dashboard",handleGET)
