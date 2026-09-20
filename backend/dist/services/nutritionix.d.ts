export interface NutritionixFood {
    external_id: string;
    name: string;
    brand?: string;
    serving_qty: number;
    serving_unit: string;
    serving_weight_g?: number;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
    sugar_g?: number;
    sodium_mg?: number;
}
export interface NutritionResult {
    name: string;
    quantity: number;
    unit: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
    sodium_mg: number;
}
export declare function searchNutritionix(query: string, limit?: number): Promise<NutritionixFood[]>;
export declare function getNutrientsForItems(items: Array<{
    name: string;
    quantity: number;
    unit: string;
}>): Promise<NutritionResult[]>;
export declare function getNutritionixById(id: string): Promise<NutritionixFood | null>;
//# sourceMappingURL=nutritionix.d.ts.map