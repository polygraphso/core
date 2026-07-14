/**
 * /dashboard/upgrade — kept as a permanent redirect to the account hub, which
 * now owns plan management. Old links (the quota-exceeded CTA, bookmarks) still
 * work.
 */

import { redirect } from "next/navigation";

export default function UpgradeRedirect() {
  redirect("/dashboard/account");
}
