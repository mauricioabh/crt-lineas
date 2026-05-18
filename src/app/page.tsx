import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Landing } from "@/app/_marketing/landing";
import { getAfterAuthRedirectUrl } from "@/lib/auth-redirect-url";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect(getAfterAuthRedirectUrl());
  }

  return <Landing />;
}
