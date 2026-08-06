import { useUser } from "@/contexts/user-context";
import { Navigate, useLocation } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  roles: string[];
  redirectTo?: string;
}

/** Placeholder content matching AppLayout's content area dimensions for use during authentication resolution. */
function SkeletonContent() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Skeleton className="h-[400px] w-full rounded-lg" />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-[500px] w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function RoleProtectedRoute({
  children,
  roles,
  redirectTo = "/errors/forbidden",
}: RoleProtectedRouteProps) {
  const { user, isLoading, isLoggedOut } = useUser();
  const location = useLocation();

  if (isLoading) {
    return <SkeletonContent />;
  }

  if (isLoggedOut) {
    const currentPath = location.pathname + location.search;
    const encodedRedirect = encodeURIComponent(currentPath);
    return <Navigate to={`/auth/sign-in?redirect-to=${encodedRedirect}`} replace />;
  }

  if (!user) {
    return <SkeletonContent />;
  }

  const userRoles = user.roles?.map((role: any) => role.role) || [];
  const hasAccess = roles.some((role) => userRoles.includes(role));

  if (!hasAccess) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
