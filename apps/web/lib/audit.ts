// AUDIT.1 — thin re-export of the @axona/db writer so app routes/actions import it
// from "@/lib/audit" (parallels lib/storage.ts). The core lives in the db package
// so apps/worker shares one implementation.
export {
  writeAudit,
  AuditActor,
  type WriteAuditInput,
  type AuditActorInput,
} from "@axona/db";
