"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { tr } from "@/locales/tr";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="font-display text-display-md text-foreground">{tr.dashboard.admin.import.title}</h1>
        <p className="text-data-sm text-muted-foreground mt-1">
          {tr.dashboard.admin.import.description}
        </p>
      </div>

      <Card className="animate-fade-up-delay-1">
        <CardHeader>
          <CardDescription>{tr.dashboard.admin.import.cards.process.label}</CardDescription>
          <CardTitle className="mt-1">{tr.dashboard.admin.import.cards.process.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-data-sm text-muted-foreground">
            {tr.dashboard.admin.import.cards.process.description}
          </p>
        </CardContent>
      </Card>

      <Card className="animate-fade-up-delay-2">
        <CardHeader>
          <CardDescription>{tr.dashboard.admin.import.cards.tasks.label}</CardDescription>
            <CardTitle className="mt-1">{tr.dashboard.admin.import.cards.tasks.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-border/30">
              <span className="text-data-sm text-muted-foreground">{tr.dashboard.admin.import.cards.tasks.tlref}</span>
              <span className="font-mono-data text-label text-primary">{tr.dashboard.admin.import.cards.tasks.schedule} 18:30</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
              <span className="text-data-sm text-muted-foreground">{tr.dashboard.admin.import.cards.tasks.calculation}</span>
              <span className="font-mono-data text-label text-primary">{tr.dashboard.admin.import.cards.tasks.schedule} 18:45</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
