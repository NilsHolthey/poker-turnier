import { auth0 } from "@/lib/auth0";

// Next.js 16 renamed middleware.js to proxy.js for the network interception
// boundary; middleware.js still works but is deprecated for the Node runtime
// (see @auth0/nextjs-auth0 README, "Add the authentication middleware").
export async function proxy(request) {
  return await auth0.middleware(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
