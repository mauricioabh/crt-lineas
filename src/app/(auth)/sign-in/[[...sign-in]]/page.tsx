import { SignIn } from "@clerk/nextjs";
import { PageEnter } from "@/components/motion/page-enter";
import { getAfterAuthRedirectUrl } from "@/lib/auth-redirect-url";

export default function SignInPage() {
  const afterAuth = getAfterAuthRedirectUrl();

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center p-6">
      <PageEnter>
        <SignIn
          routing="path"
          path="/sign-in"
          forceRedirectUrl={afterAuth}
          signUpForceRedirectUrl={afterAuth}
        />
      </PageEnter>
    </div>
  );
}
