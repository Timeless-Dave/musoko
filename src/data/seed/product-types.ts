import { asId, type MeasureUnit, type ProductCategory, type ProductType, type ProductTypeId } from '@/domain/types';

type Row = [slug: string, name: string, category: ProductCategory, comparisonUnit: MeasureUnit];

const ROWS: Row[] = [
  ['tomatoes', 'Tomatoes', 'vegetables', 'lb'],
  ['collard-greens', 'Collard greens', 'vegetables', 'lb'],
  ['mustard-greens', 'Mustard greens', 'vegetables', 'lb'],
  ['sweet-potatoes', 'Sweet potatoes', 'vegetables', 'lb'],
  ['pole-beans', 'Pole beans', 'vegetables', 'lb'],
  ['winter-squash', 'Winter squash', 'vegetables', 'lb'],
  ['turnips', 'Turnips', 'vegetables', 'lb'],
  ['kale', 'Kale', 'vegetables', 'lb'],
  ['okra', 'Okra', 'vegetables', 'lb'],
  ['sweet-corn', 'Sweet corn', 'vegetables', 'dozen'],
  ['strawberries', 'Strawberries', 'fruits', 'lb'],
  ['watermelon', 'Watermelon', 'fruits', 'lb'],
  ['peaches', 'Peaches', 'fruits', 'lb'],
  ['blueberries', 'Blueberries', 'fruits', 'lb'],
  ['apples', 'Apples', 'fruits', 'lb'],
  ['persimmons', 'Persimmons', 'fruits', 'lb'],
  ['culinary-herbs', 'Culinary herbs', 'herbs', 'oz'],
  ['eggs', 'Eggs', 'eggs', 'dozen'],
  ['whole-chicken', 'Whole chicken', 'meat_poultry', 'lb'],
  ['ground-beef', 'Ground beef', 'meat_poultry', 'lb'],
  ['pork-products', 'Pork products', 'meat_poultry', 'lb'],
  ['milk', 'Milk', 'dairy', 'gallon'],
  ['fresh-cheese', 'Fresh cheese', 'dairy', 'lb'],
  ['rice', 'Rice', 'grains_legumes', 'lb'],
  ['cornmeal', 'Cornmeal and grits', 'grains_legumes', 'lb'],
  ['field-peas', 'Field peas', 'grains_legumes', 'lb'],
  ['honey', 'Honey', 'other', 'lb'],
  ['pecans', 'Pecans', 'other', 'lb'],
  ['sorghum-syrup', 'Sorghum syrup', 'other', 'fl_oz'],
];

export const productTypeId = (slug: string): ProductTypeId => asId<ProductTypeId>(`ptype-${slug}`);

export function buildProductTypes(): ProductType[] {
  return ROWS.map(([slug, name, category, comparisonUnit]) => ({
    id: productTypeId(slug), slug, name, category, comparisonUnit,
  }));
}
