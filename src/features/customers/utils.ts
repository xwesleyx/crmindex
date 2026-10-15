type CustomerLike = {
  company: { legalName: string; tradeName: string | null } | null;
  contact: { name: string } | null;
};

// Cliente pode ser PJ (via Company) ou PF (via Contact) — seção 6 do escopo.
export function getCustomerDisplayName(customer: CustomerLike): string {
  if (customer.company) return customer.company.tradeName || customer.company.legalName;
  if (customer.contact) return customer.contact.name;
  return "Cliente sem identificação";
}
