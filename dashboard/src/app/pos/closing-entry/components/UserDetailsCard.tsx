/** Read-only card displaying company, POS profile, cashier, and opening entry info. */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  company: string;
  posProfile: string;
  cashier: string;
  openingName: string;
}

export function UserDetailsCard({
  company,
  posProfile,
  cashier,
  openingName,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">User Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Company</Label>
            <Input value={company} readOnly className="bg-muted" />
          </div>
          <div className="space-y-1.5">
            <Label>POS Profile</Label>
            <Input value={posProfile} readOnly className="bg-muted" />
          </div>
          <div className="space-y-1.5">
            <Label>Cashier</Label>
            <Input value={cashier} readOnly className="bg-muted" />
          </div>
          <div className="space-y-1.5">
            <Label>POS Opening Entry</Label>
            <Input value={openingName} readOnly className="bg-muted" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}