import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Valid email is required" },
      { status: 400 },
    );
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "Email service not configured. Add RESEND_API_KEY." },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) {
    return NextResponse.json(
      { error: "You must be in a household to invite" },
      { status: 400 },
    );
  }

  const { data: household } = await supabase
    .from("households")
    .select("invite_code, name")
    .eq("id", profile.household_id)
    .single();

  if (!household?.invite_code) {
    return NextResponse.json(
      { error: "Household invite code not found" },
      { status: 500 },
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    request.headers.get("origin") ||
    "https://famous-bavarois-8c852a.netlify.app";
  const inviteLink = `${baseUrl.replace(/\/$/, "")}/join?code=${household.invite_code}`;

  const { error: sendError } = await resend.emails.send({
    from: "Livelist <onboarding@resend.dev>",
    to: [email],
    subject: `You're invited to join ${household.name ?? "our household"}`,
    html: `
      <p>Hi!</p>
      <p>You've been invited to join <strong>${household.name ?? "our household"}</strong> on Livelist.</p>
      <p>Click the link below to join:</p>
      <p><a href="${inviteLink}" style="color: #5034ff; font-weight: 600;">${inviteLink}</a></p>
      <p>If you didn't expect this invite, you can ignore this email.</p>
    `,
  });

  if (sendError) {
    return NextResponse.json(
      { error: sendError.message ?? "Failed to send email" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
