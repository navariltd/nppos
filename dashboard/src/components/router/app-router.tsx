"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { routes, type RouteConfig } from "@/config/routes";
import { Suspense } from "react";
import { Route, Routes } from "react-router-dom";

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-8">
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

function renderRoutes(routeConfigs: RouteConfig[]) {
  return routeConfigs.map((route, index) => (
    <Route
      key={(route.path || "") + index}
      path={route.path}
      element={<Suspense fallback={<PageSkeleton />}>{route.element}</Suspense>}
    >
      {route.children && renderRoutes(route.children)}
    </Route>
  ));
}

export function AppRouter() {
  return <Routes>{renderRoutes(routes)}</Routes>;
}
