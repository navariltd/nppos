import { POSProvider, usePOS } from "@/contexts/pos-context";
import { useUser } from "@/contexts/user-context";
import { Navigate, useLocation } from "react-router-dom";
import { POSOpeningModal } from "../pos/components/POSOpeningModal";
import { Skeleton } from "@/components/ui/skeleton";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
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

function ProtectedRouteContent({
  children,
  requiredRoles = [],
}: ProtectedRouteProps) {
  const { user, isLoading: isUserLoading, isLoggedOut } = useUser();
  const { posOpeningEntry, isLoadingMetadata, refreshPOSMetadata } = usePOS();
  const location = useLocation();

  if (isUserLoading || isLoadingMetadata) {
    return <SkeletonContent />;
  }

  if (isLoggedOut && !user) {
    const currentPath = location.pathname + location.search;
    const encodedRedirect = encodeURIComponent(currentPath);
    return <Navigate to={`/auth/sign-in?redirect-to=${encodedRedirect}`} replace />;
  }

  if (!user) {
    return <SkeletonContent />;
  }

  if (requiredRoles.length > 0) {
    const userRoles = user.roles?.map((role: any) => role.role) || [];
    const hasRequiredRole = requiredRoles.some((role) =>
      userRoles.includes(role),
    );

    if (!hasRequiredRole) {
      return <Navigate to="/errors/forbidden" replace />;
    }
  }

  if (
    !posOpeningEntry ||
    (Array.isArray(posOpeningEntry) && posOpeningEntry.length === 0)
  ) {
    return (
      <>
        <div className="relative">
          <div className="pointer-events-none select-none blur-[2px]">
            {children}
          </div>
          <POSOpeningModal onSuccess={refreshPOSMetadata} />
        </div>
      </>
    );
  }

  return <>{children}</>;
}

export function ProtectedRoute({
  children,
  requiredRoles = [],
}: ProtectedRouteProps) {
  return (
    <POSProvider>
      <ProtectedRouteContent requiredRoles={requiredRoles}>
        {children}
      </ProtectedRouteContent>
    </POSProvider>
  );
}