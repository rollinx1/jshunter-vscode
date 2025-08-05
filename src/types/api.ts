export interface HealthCheckResult {
    isHealthy: boolean;
    message: string;
    responseTime?: number;
}

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    timestamp?: string;
}

//Pocketbase response
export interface PBResponse<T> {
    items: T[];
    page: number;
    perPage: number;
    totalItems: number;
    totalPages: number;
}

export interface BackendStatus {
    status: 'online' | 'offline' | 'unknown';
    lastCheck: Date;
    responseTime?: number;
}

export type Config = {
    target: string;
    storage_dir: string;
}

export type JavascriptFile = {
    id: string;
    url: string;
    hash: string;
    has_chunks: boolean;
    parent_id?: string; // For chunked files, this points to the parent JS file
    prettify_status: "processed" | "pending" | "failed" | "processing";
    sourcemap_status: "processed" | "pending" | "failed" | "processing";
    analysis_status: "processed" | "pending" | "failed" | "processing";
    type: "normal" | "inline" | "mobile" | "chunk";
    endpoint: string;
    created_at: string;
    last_modified: string;
}

export type Sourcemap = string;

export type Endpoint = {
    id: string;
    url: string;
    hash: string;
    mobile_hash?: string; // Optional mobile version
    prettify_status: "processed" | "pending" | "failed" | "processing";
    created_at: string;
    last_modified: string;
    expand?: {
        js_files: JavascriptFile[] | null;
    }
}

export interface Finding {
    id: string;
    type: string;
    line?: number;
    column?: number;
    value: string;
    metadata?: any;
    expand?: {
        js_file: JavascriptFile | null;
    }
    endpoint?: string;
    created_at: string;
}

export type FindingsByCategory = {
    urls?: UrlFinding[];
    gql?: GqlFinding[];
    domxss?: DomXssFinding[];
    events?: EventFinding[];
    httpapi?: HttpApiFinding[];
}

export type UrlFinding = {
    value: string;
    line: number;
    column: number;
    type: "full-url" | "api-endpoint" | "path-only";
    metadata?: {
        confidence?: number;
        hostname?: string;
        pathname?: string;
        isSecure?: boolean;
        hasParams?: boolean;
        hasFragment?: boolean;
        isApi?: boolean;
        extension?: string;
    };
}

export type GqlFinding = {
    value: string;
    line: number;
    column: number;
    type: "gql-query" | "gql-mutation" | "gql-subscription";
}

export type DomXssFinding = {
    value: string;
    line: number;
    column: number;
    type: "dom-eval" | "dom-write" | "dom-innerHTML" | "dom-postmessage" | "dom-domain";
}

export type EventFinding = {
    value: string;
    line: number;
    column: number;
    type: "event-listener" | "event-onmessage" | "event-onhashchange" | "event-window-open" | "event-location";
}

export type HttpApiFinding = {
    value: string;
    line: number;
    column: number;
    type: "http-fetch" | "http-xhr" | "http-axios" | "http-jquery";
    url?: string;
    options?: string[];
    method?: string;
} 