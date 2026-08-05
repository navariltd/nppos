/** Dynamic doctype list page using DocTypeList component. */

"use client";

import { useParams } from "react-router-dom";
import { DocTypeList } from "@/components/doctype";
import { slugToDoctype } from "@/lib/doctype-map";

export default function AppListPage() {
  const { doctype: slug } = useParams<{ doctype: string }>();
  const doctype = slug ? slugToDoctype(slug) : "";

  if (!doctype) {
    return <div className="px-4 lg:px-6 text-center py-20 text-muted-foreground">No document type specified.</div>;
  }

  return <DocTypeList doctype={doctype} title={doctype} />;
}