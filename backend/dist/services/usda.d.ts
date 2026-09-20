export interface FoodItem {
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
export declare function searchFoods(query: string, limit?: number): Promise<FoodItem[]>;
export declare function getNutrientsForItems(items: Array<{
    name: string;
    quantity: number;
    unit: string;
    estimated_weight_g?: number;
}>): Promise<NutritionResult[]>;
export declare function getFoodById(fdcId: string): Promise<FoodItem | null>;
//# sourceMappingURL=usda.d.ts.map