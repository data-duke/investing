import { z } from 'zod';

// Investment validation schema
export const investmentSchema = z.object({
  symbol: z.string()
    .trim()
    .min(1, 'Stock symbol is required')
    .max(10, 'Stock symbol must be 10 characters or less')
    .regex(/^[A-Z0-9.:-]+$/i, 'Stock symbol contains invalid characters'),
  country: z.enum(['AT', 'DE', 'US', 'UK', 'CH'], {
    errorMap: () => ({ message: 'Please select a valid country' })
  }),
  quantity: z.number({
    required_error: 'Quantity is required',
    invalid_type_error: 'Quantity must be a number'
  })
    .positive('Quantity must be positive')
    .finite('Quantity must be a valid number')
    .max(1000000, 'Quantity cannot exceed 1,000,000'),
  amount: z.number({
    required_error: 'Amount is required',
    invalid_type_error: 'Amount must be a number'
  })
    .positive('Amount must be positive')
    .finite('Amount must be a valid number')
    .max(10000000, 'Amount cannot exceed 10,000,000'),
  tag: z.string()
    .trim()
    .max(50, 'Tag must be 50 characters or less')
    .optional()
    .or(z.literal('')),
  purchaseDate: z.date({
    required_error: 'Purchase date is required',
    invalid_type_error: 'Invalid date'
  })
});

// Edit investment validation schema (allows partial updates)
export const editInvestmentSchema = z.object({
  quantity: z.number()
    .positive('Quantity must be positive')
    .finite('Quantity must be a valid number')
    .max(1000000, 'Quantity cannot exceed 1,000,000'),
  originalPrice: z.number()
    .positive('Price must be positive')
    .finite('Price must be a valid number')
    .max(1000000, 'Price cannot exceed 1,000,000'),
  purchaseDate: z.date({
    required_error: 'Purchase date is required',
    invalid_type_error: 'Invalid date'
  }),
  tag: z.string()
    .trim()
    .max(50, 'Tag must be 50 characters or less')
    .optional()
    .or(z.literal(''))
});

// Authentication validation schemas
export const emailSchema = z.string()
  .trim()
  .email('Invalid email address')
  .max(255, 'Email must be 255 characters or less');

export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be 72 characters or less')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required')
});

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

// Stock symbol validation for edge functions
export const stockSymbolSchema = z.string()
  .trim()
  .min(1, 'Stock symbol is required')
  .max(10, 'Stock symbol too long')
  .regex(/^[A-Z0-9.:-]+$/i, 'Invalid stock symbol format');
