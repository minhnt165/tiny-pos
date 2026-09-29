export interface Category {
  id: number;
  name: string;
  sortOrder: number;
  productCount: number;
}

export interface Product {
  id: number;
  barcode: string | null;
  name: string;
  unit: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  isWeighed: boolean;
  categoryId: number | null;
  minStock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  categoryName: string | null;
}

export interface ProductUnit {
  id: number;
  productId: number;
  name: string;
  barcode: string | null;
  factor: number;
  sellPrice: number;
}

export interface ProductWithUnits extends Product {
  units: ProductUnit[];
}

export interface BarcodeLookup {
  product: Product;
  unit: ProductUnit | null;
}

export interface CsvRowError {
  line: number;
  message: string;
}

export interface CsvImportResult {
  created: number;
  updated: number;
  errors: CsvRowError[];
}
