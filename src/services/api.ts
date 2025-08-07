import { ApiResponse, Config, Endpoint, PBResponse, JavascriptFile, Finding, Sourcemap } from '../types';

const API_CONFIG = {
    BASE_URL: 'http://localhost:20450',
    TIMEOUT: 10000,
    ENDPOINTS: {
        HEALTH: '/api/health',
        CONFIG: '/api/config',
        ENDPOINTS: '/api/collections/endpoints/records',
        JS_FILES: '/api/collections/js_files/records',
        FINDINGS: '/api/collections/findings/records'
    }
};

export class ApiService {
    private static instance: ApiService;
    private baseUrl: string;

    private constructor() {
        this.baseUrl = API_CONFIG.BASE_URL;
    }

    static getInstance(): ApiService {
        if (!ApiService.instance) {
            ApiService.instance = new ApiService();
        }
        return ApiService.instance;
    }

    // --- Public methods to load data into the store ---

    async loadEndpoints(): Promise<ApiResponse<Endpoint[]>> {

        let endpoints: Endpoint[] = [];
        const endpoint = `${API_CONFIG.ENDPOINTS.ENDPOINTS}?expand=js_files&sort=url`;
        const result = await this.requestPagination<Endpoint>(endpoint)
        if (result.success && result.data) {
            endpoints = result.data;
        }
        return {
            success: true,
            data: endpoints
        };
    }

    async loadLazyLoadedJavascriptFiles(js_files: JavascriptFile[]): Promise<ApiResponse<JavascriptFile[]>> {
        const jsFilesWithChunks = js_files.filter((js) => js.has_chunks);
        const ids = jsFilesWithChunks.map((js) => js.id)
        const chunks = this.chunkArray(ids, 30);
        let results: JavascriptFile[] = [];
        for (const chunk of chunks) {
            const filter = chunk.map(id => `parent_id='${id}'`).join(' || ');
            const endpoint = `${API_CONFIG.ENDPOINTS.JS_FILES}?filter=(${filter})`;
            const result = await this.requestPagination<JavascriptFile>(endpoint);
            if (result.success && result.data) {
                results = [...results, ...result.data];
            }
        }
        return {
            success: true,
            data: results,
        };

    }
    async loadFindings(js_files: JavascriptFile[]): Promise<ApiResponse<Finding[]>> {
        const ids = js_files.map(js => js.id);
        const chunks = this.chunkArray(ids, 30);

        let results: Finding[] = [];
        for (const chunk of chunks) {
            const filter = chunk.map(id => `js_file='${id}'`).join(' || ');
            const endpoint = `${API_CONFIG.ENDPOINTS.FINDINGS}?filter=(${filter})&expand=js_file&sort=value`;
            const result = await this.requestPagination<Finding>(endpoint)
            if (result.success && result.data) {
                results = [...results, ...result.data];
            }
        }

        return {
            success: true,
            data: results,
        };;
    }
    async loadConfig(): Promise<ApiResponse<Config>> {
        return this.request<Config>(API_CONFIG.ENDPOINTS.CONFIG);
    }


    private async requestPagination<T>(api: string): Promise<ApiResponse<T[]>> {
        let page = 1;
        const perPage = 500;

        let data: T[] = [];
        while (true) {
            const endpoint = `${api}&perPage=${perPage}&page=${page}`;
            const result = await this.request<PBResponse<any>>(endpoint);
            if (result.success && result.data) {
                data = [...data, ...result.data.items];
                if (result.data.totalPages === 0 || result.data.totalPages === page) break;
                page += 1;
            } else {
                break;
            }
        }
        return {
            success: true,
            data
        }
    }
    // Generic request method for API calls
    private async request<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
        try {
            const url = `${this.baseUrl}${endpoint}`;

            const response = await fetch(url, {
                ...options,
                signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
            });

            const data = await response.json() as T;

            if (response.ok) {
                return {
                    success: true,
                    data,
                    timestamp: new Date().toISOString()
                };
            } else {
                return {
                    success: false,
                    error: (data as any)?.message || `HTTP ${response.status}`,
                    timestamp: new Date().toISOString()
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            };
        }
    }

    private chunkArray(arr: any[], size: number) {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    }

} 