export interface SettingsView {
  id: string;

  // General Settings
  storeName: string;
  companyName: string;
  storeLogo: string | null;
  favicon: string | null;
  supportEmail: string;
  supportPhone: string;
  companyAddress: string;
  currency: string;
  currencySymbol: string;
  timezone: string;
  language: string;

  // Delivery Settings
  deliveryEnabled: boolean;
  freeDeliveryEnabled: boolean;
  insideDhakaDeliveryCharge: number;
  outsideDhakaDeliveryCharge: number;
  insideDhakaCharge?: number;
  outsideDhakaCharge?: number;
  freeShippingMinOrderAmount: number;
  estimatedDeliveryDays: number;
  delivery?: {
    deliveryEnabled: boolean;
    freeDeliveryEnabled: boolean;
    insideDhakaDeliveryCharge: number;
    outsideDhakaDeliveryCharge: number;
    insideDhakaCharge: number;
    outsideDhakaCharge: number;
    estimatedDeliveryDays: number;
  };

  // Payment Settings
  codEnabled: boolean;
  bkashEnabled: boolean;
  nagadEnabled: boolean;
  merchantName: string | null;
  merchantNumber: string | null;
  paymentInstructions: string | null;

  // SMTP Settings (Sensitive password omitted in responses)
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUsername: string | null;
  hasSmtpPassword: boolean;
  senderName: string | null;
  senderEmail: string | null;

  // Maintenance Settings
  maintenanceMode: boolean;
  maintenanceMessage: string | null;

  // Legacy fields
  customerDiscountPercentage?: number;
  couponCode?: string | null;
  couponActive?: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface UpdateSettingsInput {
  // General Settings
  storeName?: string;
  companyName?: string;
  storeLogo?: string | null;
  favicon?: string | null;
  supportEmail?: string;
  supportPhone?: string;
  companyAddress?: string;
  currency?: string;
  currencySymbol?: string;
  timezone?: string;
  language?: string;

  // Delivery Settings
  deliveryEnabled?: boolean;
  freeDeliveryEnabled?: boolean;
  insideDhakaDeliveryCharge?: number;
  outsideDhakaDeliveryCharge?: number;
  insideDhakaCharge?: number;
  outsideDhakaCharge?: number;
  freeShippingMinOrderAmount?: number;
  estimatedDeliveryDays?: number;

  // Payment Settings
  codEnabled?: boolean;
  bkashEnabled?: boolean;
  nagadEnabled?: boolean;
  merchantName?: string | null;
  merchantNumber?: string | null;
  paymentInstructions?: string | null;

  // SMTP Settings
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUsername?: string | null;
  smtpPassword?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;

  // Maintenance Settings
  maintenanceMode?: boolean;
  maintenanceMessage?: string | null;

  // Legacy fields
  customerDiscountPercentage?: number;
  couponCode?: string | null;
  couponActive?: boolean;
}

export interface DeliverySettingsView {
  deliveryEnabled: boolean;
  freeDeliveryEnabled: boolean;
  insideDhakaCharge: number;
  outsideDhakaCharge: number;
  estimatedDeliveryDays: number;
}

export interface UpdateDeliverySettingsInput {
  deliveryEnabled?: boolean;
  freeDeliveryEnabled?: boolean;
  insideDhakaCharge?: number;
  outsideDhakaCharge?: number;
  insideDhakaDeliveryCharge?: number;
  outsideDhakaDeliveryCharge?: number;
  estimatedDeliveryDays?: number;
  freeShippingMinOrderAmount?: number | null;
}