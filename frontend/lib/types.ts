// Food & Menu Types
export interface Category {
    id: string;
    name: string;
    description?: string;
}

export interface Food {
    id: string;
    name: string;
    description?: string;
    price: number;
    image_url: string;
    category_id: string;
    is_available: boolean;
}

// Cart Types
export interface CartItem {
    food: Food;
    quantity: number;
}

// Order Types
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled' | 'paid' | 'payment_failed';

export interface OrderItem {
    food_id: string;
    food_name: string;
    quantity: number;
    unit_price: number;
    price?: number; // Compatibility with older patterns
    subtotal: number;
}

export interface Order {
    id: string;
    table_id: string;
    status: OrderStatus;
    payment_status: 'paid' | 'unpaid' | 'failed';
    items: OrderItem[];
    total_amount: number;
    total_price?: number; // Alias often used in frontend
    special_instructions?: string;
    created_at: string;
    updated_at: string;
}

export interface CreateOrderRequest {
    table_id: string;
    items: {
        food_id: string;
        quantity: number;
    }[];
    special_instructions?: string;
}

// Payment Types
export type PaymentProvider = 'vietqr' | 'cash';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'expired';

export interface Payment {
    id: number;
    transaction_id: string | null;
    order_id: number;
    amount: number;
    provider: PaymentProvider;
    status: PaymentStatus;
    created_at: string;
    expires_at: string | null;
}

export interface VietQRPayment extends Payment {
    qr_url: string;
    bank_id: string;
    account_no: string;
    account_name: string;
    transfer_content: string;
}

export interface InitiatePaymentRequest {
    order_id: number;
    provider: PaymentProvider;
    amount: number;
}

// Auth Types
export interface GuestAuthResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
}

export interface User {
    id: string;
    phone?: string;
    is_guest: boolean;
}

// API Response Types
export interface ApiError {
    detail: string;
    status_code?: number;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    size: number;
    pages: number;
}
