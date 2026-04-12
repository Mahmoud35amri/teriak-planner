"use client";

import AppShell from "@/components/layout/AppShell";
import ProposalsPanel from "@/components/planning/ProposalsPanel";

interface Props {
  canSubmit: boolean;
  canApprove: boolean;
}

export default function ProposalsClient({ canSubmit, canApprove }: Props) {
  return (
    <AppShell title="Propositions de modification">
      <ProposalsPanel canSubmit={canSubmit} canApprove={canApprove} />
    </AppShell>
  );
}
