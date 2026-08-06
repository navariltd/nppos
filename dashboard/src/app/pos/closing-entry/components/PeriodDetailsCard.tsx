/** Card with period start/end datetime inputs and posting date/time fields. */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  periodStart: string;
  periodEnd: string;
  postingDate: string;
  postingTime: string;
  onPeriodStartChange: (v: string) => void;
  onPeriodEndChange: (v: string) => void;
  onPostingDateChange: (v: string) => void;
  onPostingTimeChange: (v: string) => void;
}

export function PeriodDetailsCard({
  periodStart,
  periodEnd,
  postingDate,
  postingTime,
  onPeriodStartChange,
  onPeriodEndChange,
  onPostingDateChange,
  onPostingTimeChange,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Period Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="ps">Period Start Date</Label>
            <Input
              id="ps"
              type="datetime-local"
              value={periodStart}
              onChange={(e) => onPeriodStartChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pe">Period End Date</Label>
            <Input
              id="pe"
              type="datetime-local"
              value={periodEnd}
              onChange={(e) => onPeriodEndChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pd">Posting Date</Label>
            <Input
              id="pd"
              type="date"
              value={postingDate}
              onChange={(e) => onPostingDateChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pt">Posting Time</Label>
            <Input
              id="pt"
              type="time"
              value={postingTime}
              onChange={(e) => onPostingTimeChange(e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}