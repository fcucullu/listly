import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { message, type, email } = await request.json();
  if (!message) return NextResponse.json({ error: "Message required" }, { status: 400 });

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Listly Feedback <feedback@franciscocucullu.com>",
      to: "francisco.cucullu@gmail.com",
      subject: `[Listly Feedback] ${type || "General"}`,
      text: `From: ${email || "Anonymous"}\nType: ${type || "General"}\n\n${message}`,
    }),
  });

  return NextResponse.json({ ok: true });
}
