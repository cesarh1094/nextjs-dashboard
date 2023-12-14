'use server';

import { custom, z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const InvoiceSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  // Coerce amount to string then covert dollars to cents
  amount: z.coerce.number().transform((amount) => amount * 100),
  status: z.enum(['pending', 'paid']),
  date: z.string(),
});

const CreateInvoiceSchema = InvoiceSchema.omit({ id: true, date: true });

type CreateInvoice = z.infer<typeof CreateInvoiceSchema>;
type EmptyInvoice = CreateInvoice & { status: null };

export async function createInvoice(formData: FormData) {
  const rawInvoice = Object.fromEntries(formData.entries()) as {
    customerID: string;
    amount: string;
    status: string;
  };

  console.log('Raw invoice to be added: ', { formDataObject: rawInvoice });

  const { customerId, amount, status } = CreateInvoiceSchema.parse(rawInvoice);

  console.log({ customerId, amount, status });

  const date = new Date().toISOString().split('T')[0];

  await sql`
  INSERT INTO invoices (customer_id, amount, status, date)
  VALUES (${customerId}, ${amount}, ${status}, ${date})
`;

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');

  // try {

  //   // return {
  //   //   invoice: {
  //   //     customerId: '',
  //   //     amount: 0,
  //   //     status: '',
  //   //   },
  //   // } as { invoice: EmptyInvoice };
  // } catch (e) {
  //   return {
  //     invoice: rawInvoice,
  //   };
  // }
}

// Use Zod to update the expected types
const UpdateInvoice = InvoiceSchema.omit({ id: true, date: true });

export async function updateInvoice(id: string, formData: FormData) {
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amount}, status = ${status}
    WHERE id = ${id}
  `;

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  console.log('Invoice about to be deleted: ', { id });

  await sql`DELETE FROM invoices WHERE id = ${id}`;
  revalidatePath('/dashboard/invoices');
}
