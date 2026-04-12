export type Role =
  | "PLANIFICATEUR"
  | "RESPONSABLE_ATELIER"
  | "ADMINISTRATEUR"
  | "DIRECTION";

export interface Permission {
  canEditPDP: boolean;
  canRunScheduler: boolean;
  canManageScenarios: boolean;
  canManageGammes: boolean;
  canApproveProposals: boolean;
  canSubmitProposals: boolean;
  canViewKPIs: boolean;
  canExportReports: boolean;
  canManageUsers: boolean;
  canViewLogs: boolean;
  canViewBusinessData: boolean;
}

const PERMISSIONS: Record<Role, Permission> = {
  PLANIFICATEUR: {
    canEditPDP: true,
    canRunScheduler: true,
    canManageScenarios: true,
    canManageGammes: true,
    canApproveProposals: true,
    canSubmitProposals: false,
    canViewKPIs: true,
    canExportReports: true,
    canManageUsers: false,
    canViewLogs: false,
    canViewBusinessData: true,
  },
  RESPONSABLE_ATELIER: {
    canEditPDP: false,
    canRunScheduler: false,
    canManageScenarios: false,
    canManageGammes: false,
    canApproveProposals: false,
    canSubmitProposals: true,
    canViewKPIs: true,
    canExportReports: true,
    canManageUsers: false,
    canViewLogs: false,
    canViewBusinessData: true,
  },
  ADMINISTRATEUR: {
    canEditPDP: false,
    canRunScheduler: false,
    canManageScenarios: false,
    canManageGammes: false,
    canApproveProposals: false,
    canSubmitProposals: false,
    canViewKPIs: false,
    canExportReports: false,
    canManageUsers: true,
    canViewLogs: true,
    canViewBusinessData: false,
  },
  DIRECTION: {
    canEditPDP: false,
    canRunScheduler: false,
    canManageScenarios: false,
    canManageGammes: false,
    canApproveProposals: false,
    canSubmitProposals: false,
    canViewKPIs: true,
    canExportReports: true,
    canManageUsers: false,
    canViewLogs: false,
    canViewBusinessData: true,
  },
};

export function getPermissions(role: Role): Permission {
  return PERMISSIONS[role];
}

export function can(role: Role, action: keyof Permission): boolean {
  return PERMISSIONS[role][action];
}

export const ROLE_LABELS: Record<Role, string> = {
  PLANIFICATEUR: "Planificateur",
  RESPONSABLE_ATELIER: "Responsable Atelier",
  ADMINISTRATEUR: "Administrateur",
  DIRECTION: "Direction",
};
