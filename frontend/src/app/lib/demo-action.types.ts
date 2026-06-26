export type DemoActionKind = 'reset' | 'apply_scenario';

export type DemoActionSeverity = 'normal' | 'destructive';

export interface DemoActionPreview {
  kind: DemoActionKind;
  title: string;
  subtitle?: string;
  can_apply: boolean;
  block_reason?: string;
  severity: DemoActionSeverity;
  summary_lines: string[];
  requires_reset?: boolean;
  confirm_label: string;
  applying_label: string;
}

export interface ResetPreview {
  can_apply: boolean;
  block_reason?: string;
  requires_reset: boolean;
  summary_lines: string[];
}
