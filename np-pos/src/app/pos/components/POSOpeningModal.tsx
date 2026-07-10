import { LinkField } from "@/components/fields/LinkField";
import { Table } from "@/components/fields/Table";
import { useUser } from "@/contexts/user-context";
import { insertDoc } from "@/lib/frappe-service";
import React, { useState } from "react";

interface POSOpeningModalProps {
  onSuccess: () => void;
}

export function POSOpeningModal({ onSuccess }: POSOpeningModalProps) {
  const { user } = useUser();
  const [company, setCompany] = useState("");
  const [posProfile, setPosProfile] = useState("");
  const [openingBalances, setOpeningBalances] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { insert } = insertDoc();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !posProfile || !user?.name) return;

    try {
      setIsSubmitting(true);
      await insert("POS Opening Entry", {
        user: user.name,
        company,
        pos_profile: posProfile,
        period_start_date: new Date()
          .toISOString()
          .replace("T", " ")
          .substring(0, 19),
        balances: openingBalances,
      });
      onSuccess();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-background/20 backdrop-blur-[2px] animate-in fade-in-0 duration-200" />

      <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in-0 duration-200">
        <div className="w-full max-w-2xl p-6 bg-popover border text-popover-foreground rounded-xl shadow-lg mx-4 max-h-[90vh] overflow-y-auto">
          <h2 className="text-xl font-semibold mb-1">
            Create POS Opening Entry
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            You need an active POS opening entry to access this section.
          </p>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <LinkField
                  doctype="Company"
                  value={company}
                  onChange={(val) => {
                    setCompany(val);
                    setPosProfile("");
                    setOpeningBalances([]);
                  }}
                  placeholder=""
                  label="Company"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <LinkField
                  doctype="POS Profile"
                  value={posProfile}
                  onChange={(val) => setPosProfile(val)}
                  placeholder="Select POS Profile"
                  referenceDoctype="POS Opening Entry"
                  linkFieldname="pos_profile"
                  query="erpnext.accounts.doctype.pos_profile.pos_profile.pos_profile_query"
                  filters={company ? { company } : {}}
                  disabled={!company}
                  label="POS Profile"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <Table
                doctype="POS Opening Entry Detail"
                value={openingBalances}
                onChange={(val) => setOpeningBalances(val)}
                label="Opening Balance Details"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !company || !posProfile}
              className="w-full mt-4 bg-primary text-primary-foreground py-2 px-4 rounded-md font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 select-none shadow-sm"
            >
              {isSubmitting ? "Opening Session..." : "Submit"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
