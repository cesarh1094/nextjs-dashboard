'use server';

import { custom, z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

const InvoiceSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  // Coerce amount to string then covert dollars to cents
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' })
    .transform((amount) => amount * 100),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
});

const CreateInvoiceSchema = InvoiceSchema.omit({ id: true, date: true });

type CreateInvoice = z.infer<typeof CreateInvoiceSchema>;
type EmptyInvoice = CreateInvoice & { status: null };
type CreateInvoiceKeys = keyof CreateInvoice;

export type InvoiceFormState = {
  message?: string;
  errors?: {
    [key in CreateInvoiceKeys]?: Array<string>;
  };
};

export async function createInvoice(
  currentState: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const rawInvoice = Object.fromEntries(formData.entries()) as {
    customerID: string;
    amount: string;
    status: string;
  };

  const invoiceValidationResult = CreateInvoiceSchema.safeParse(rawInvoice);

  if (!invoiceValidationResult.success) {
    return {
      errors: invoiceValidationResult.error.flatten().fieldErrors,
      message: 'Failed to create invoice.',
    };
  }

  try {
    const { customerId, amount, status } = invoiceValidationResult.data;

    const date = new Date().toISOString().split('T')[0];

    await sql`
  INSERT INTO invoices (customer_id, amount, status, date)
  VALUES (${customerId}, ${amount}, ${status}, ${date})
`;
  } catch (e) {
    console.error('Failed to create invoice:', e);

    return {
      message: 'Database Error: Failed to create invoice.',
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

// Use Zod to update the expected types
const UpdateInvoice = InvoiceSchema.omit({ id: true, date: true });

export async function updateInvoice(
  id: string,
  currentState: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const updateInvoiceValidationResult = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!updateInvoiceValidationResult.success) {
    return {
      errors: updateInvoiceValidationResult.error.flatten().fieldErrors,
      message: 'Failed to update invoice.',
    };
  }

  const { customerId, amount, status } = updateInvoiceValidationResult.data;

  try {
    await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amount}, status = ${status}
    WHERE id = ${id}
  `;
  } catch (e) {
    console.error('Failed to update invoice:', e);

    return {
      message: 'Database Error: Failed to update invoice.',
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');

    return {
      message: 'Invoice deleted successfully.',
    };
  } catch (e) {
    console.error('Failed to delete invoice:', e);

    return {
      message: 'Database Error: Failed to delete invoice.',
    };
  }
}

export async function authenicateUser(
  currentState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (e) {
    if (e instanceof AuthError) {
      switch (e.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong. Please try again.';
      }
    }
  }
}
