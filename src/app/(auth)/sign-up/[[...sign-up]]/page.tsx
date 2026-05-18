import { SignUp } from "@clerk/nextjs";
import { PageEnter } from "@/components/motion/page-enter";
import { getAfterAuthRedirectUrl } from "@/lib/auth-redirect-url";

export default function SignUpPage() {
  const afterAuth = getAfterAuthRedirectUrl();

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center p-6">
      <PageEnter>
        <SignUp
          routing="path"
          path="/sign-up"
          forceRedirectUrl={afterAuth}
          signInForceRedirectUrl={afterAuth}
        />
      </PageEnter>
    </div>
  );
}
