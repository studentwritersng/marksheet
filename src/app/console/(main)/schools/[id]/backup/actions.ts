"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { importSchoolData } from "@/lib/backup/import";
import type { BackupExport } from "@/lib/backup/types";

export async function importSchoolBackupAction(schoolId: string, backup: BackupExport): Promise<{ success?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") return { error: "Not authorised. Platform owner access required." };

  if (backup.version !== 1) return { error: "Unsupported backup version." };
  if (!backup.data) return { error: "Invalid backup file: missing data." };

  try {
    const result = await importSchoolData(schoolId, backup);
    revalidatePath(`/console/schools/${schoolId}`);
    if (result.errors.length > 0) {
      return { success: `Restore completed with ${result.errors.length} error(s). ${result.entitiesCreated} entities created.`, error: result.errors.slice(0, 5).join("; ") };
    }
    return { success: `Restore completed successfully. ${result.entitiesCreated} entities created.` };
  } catch (e: any) {
    return { error: `Restore failed: ${e.message}` };
  }
}
