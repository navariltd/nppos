import { LinkField } from "@/components/fields/LinkField";
import { Table } from "@/components/fields/Table";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/user-context";
import { callPost, getDoc } from "@/lib/frappe-service";
import React, { useEffect, useState } from "react";

interface POSOpeningModalProps {
  onSuccess: () => void;
}

export function POSOpeningModal({ onSuccess }: POSOpeningModalProps) {
  const { user } = useUser();
  const [company, setCompany] = useState("");
  const [posProfile, setPosProfile] = useState("");
  const [openingBalances, setOpeningBalances] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { post: createOpeningVoucher } = callPost(
    "erpnext.selling.page.point_of_sale.point_of_sale.create_opening_voucher",
  );
  const { post: setValue } = callPost("frappe.client.set_value");
  const { post: getOpeningDoc } = callPost("frappe.client.get");

  const { data: posProfileDoc } = getDoc(
    "POS Profile",
    posProfile ? posProfile : undefined,
  );

  useEffect(() => {
    if (posProfileDoc && posProfileDoc.payments) {
      const initialBalances = posProfileDoc.payments.map(
        (p: any, index: number) => ({
          mode_of_payment: p.mode_of_payment,
          opening_amount: 0,
        }),
      );
      setOpeningBalances(initialBalances);
    } else {
      setOpeningBalances([]);
    }
  }, [posProfileDoc]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!company || !posProfile || !user?.name) {
      setError("Please fill in all required fields");
      return;
    }

    if (!openingBalances || openingBalances.length === 0) {
      setError("Please add at least one opening balance");
      return;
    }

    try {
      setIsSubmitting(true);

      const openingVoucherData = {
        pos_profile: posProfile,
        enable_entitlement_distribution: 1,
        company: company,
        balance_details: JSON.stringify(
          openingBalances.map((balance, index) => ({
            mode_of_payment: balance.mode_of_payment,
            opening_amount: balance.opening_amount || 0,
          })),
        ),
      };

      const createRes: any = await createOpeningVoucher(openingVoucherData);
      const createdName =
        createRes?.message?.name ??
        createRes?.message ??
        createRes?.name ??
        null;

      // Ensure enable_entitlement_distribution is 1 on the created opening
      // entry (ERPNext may not persist it in some paths). Fetch it and force
      // it to 1 + save if it came back 0/false.
      if (createdName) {
        const openingRes: any = await getOpeningDoc({
          doctype: "POS Opening Entry",
          name: createdName,
        });
        const opening = openingRes?.message ?? openingRes ?? {};
        if (opening.name && opening.enable_entitlement_distribution !== 1) {
          await setValue({
            doctype: "POS Opening Entry",
            name: opening.name,
            fieldname: "enable_entitlement_distribution",
            value: 1,
          });
        }
      }

      onSuccess();
    } catch (error: any) {
      console.error("Error creating opening voucher:", error);
      setError(error?.message || "Failed to create POS opening entry");
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
            You need an active POS opening entry.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}

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
                    setError(null);
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
                  onChange={(val) => {
                    setPosProfile(val);
                    setError(null);
                  }}
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
                onChange={(val) => {
                  setOpeningBalances(val);
                  setError(null);
                }}
                label="Opening Balance Details"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !company || !posProfile}
              className="w-full mt-4"
              size="default"
            >
              {isSubmitting ? "Opening Session..." : "Submit"}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
