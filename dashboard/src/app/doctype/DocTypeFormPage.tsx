/** Dynamic doctype detail/form page using DocTypeForm component. */

"use client";

import { useParams } from "react-router-dom";
import { DocTypeForm } from "@/components/doctype";
import { slugToDoctype } from "@/lib/doctype-map";

export default function AppDetailPage() {
  const { doctype: slug, id } = useParams<{ doctype: string; id: string }>();
  const doctype = slug ? slugToDoctype(slug) : "";

  if (!doctype) {
    return <div className="px-4 lg:px-6 text-center py-20 text-muted-foreground">No document type specified.</div>;
  }

  return <DocTypeForm doctype={doctype} docname={id === "new" ? undefined : id} forceNew={id === "new"} />;
}