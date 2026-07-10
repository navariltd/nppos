import { POSProvider, usePOS } from "@/contexts/pos-context";
import { useUser } from "@/contexts/user-context";
import { Navigate } from "react-router-dom";
import { POSOpeningModal } from "../pos/components/POSOpeningModal";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

function ProtectedRouteContent({
  children,
  requiredRoles = [],
}: ProtectedRouteProps) {
  const { user, isLoading: isUserLoading } = useUser();
  const { posOpeningEntry, isLoadingMetadata, refreshPOSMetadata } = usePOS();

  if (isUserLoading || isLoadingMetadata) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/sign-in" replace />;
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
