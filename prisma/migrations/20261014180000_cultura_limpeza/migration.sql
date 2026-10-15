-- AlterTable
ALTER TABLE "messages" ADD COLUMN "mediaDeletedAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "companyId" TEXT,
    "contactId" TEXT,
    "responsibleId" TEXT,
    "regionId" TEXT,
    "becameCustomerAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "cultureContent" TEXT,
    "cultureAlert" TEXT,
    "cultureUpdatedAt" DATETIME,
    "cultureUpdatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "customers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "customers_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "customers_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "customers_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "customers_cultureUpdatedById_fkey" FOREIGN KEY ("cultureUpdatedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_customers" ("becameCustomerAt", "companyId", "contactId", "createdAt", "id", "notes", "regionId", "responsibleId", "status", "updatedAt") SELECT "becameCustomerAt", "companyId", "contactId", "createdAt", "id", "notes", "regionId", "responsibleId", "status", "updatedAt" FROM "customers";
DROP TABLE "customers";
ALTER TABLE "new_customers" RENAME TO "customers";
CREATE UNIQUE INDEX "customers_companyId_key" ON "customers"("companyId");
CREATE UNIQUE INDEX "customers_contactId_key" ON "customers"("contactId");
CREATE INDEX "customers_status_idx" ON "customers"("status");
CREATE INDEX "customers_responsibleId_idx" ON "customers"("responsibleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

