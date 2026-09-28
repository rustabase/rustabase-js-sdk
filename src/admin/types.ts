import type { Json } from "../types";

/** Per-id delivery totals returned by webhook and function `stats()`. */
export interface RunStats {
    success: number;
    error: number;
    total: number;
    avg_ms: number;
    last_run: string;
}

export type RunStatsMap = Record<string, RunStats>;

/** One stored webhook delivery attempt. */
export interface WebhookDelivery extends Json {
    id: string;
    webhook_id: string;
    status: "success" | "error";
    status_code?: number;
    duration: number;
    error: string;
    created: string;
}

/** One stored edge function run. */
export interface FunctionLog extends Json {
    id: string;
    function_id: string;
    status: "success" | "error";
    duration: number;
    error: string;
    created: string;
}

export interface SqlColumn {
    name: string;
    type: string;
    nullable: boolean;
}

/** Response of `rb.admin.sql()`. */
export interface SqlResult {
    execTime: number;
    affectedRows: number;
    columns: SqlColumn[];
    rows: any[];
}

export interface RlsTestInput {
    table: string;
    userId?: string;
    role?: string;
    limit?: number;
}

export interface RlsTestResult {
    table: string;
    role: string;
    userId: string;
    totalRows: number;
    visibleRows: number;
    blockedRows: number;
    sampleRows: Json[];
    sampleLimit: number;
    rolledBackOk: boolean;
}

/** Templates accepted by `settings.testEmail()`. */
export type EmailTemplate = "verification" | "password-reset" | "email-change" | "otp" | "login-alert";
