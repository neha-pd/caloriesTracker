export interface GeminiFood {
    name: string;
    quantity: number;
    unit: string;
    estimated_weight_g: number;
    confidence: number;
}
export interface GeminiResult {
    items: GeminiFood[];
    overall_confidence: number;
    notes?: string;
}
export declare function analyzeImageWithGemini(imageUrl: string): Promise<GeminiResult>;
//# sourceMappingURL=gemini.d.ts.map