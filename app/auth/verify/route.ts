import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieName, sessionMaxAgeSeconds } from "@/lib/auth";
import { activateUserByEmail, findMagicToken, markMagicTokenUsed } from "@/lib/data-store";
import { checkMagicToken } from "@/lib/magic-link";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const magicToken = await findMagicToken(token);
  const check = checkMagicToken(magicToken, Date.now());

  if (check !== "valid" || !magicToken) {
    return NextResponse.redirect(new URL(`/login?status=${check}`, request.url));
  }

  await markMagicTokenUsed(token);
  const user = await activateUserByEmail(magicToken.email);

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(sessionCookieName, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds
  });

  return response;
}
