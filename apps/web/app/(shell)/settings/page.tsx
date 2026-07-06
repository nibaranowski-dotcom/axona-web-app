import { redirect } from "next/navigation";

// /settings → the first section (Members).
export default function SettingsIndex() {
  redirect("/settings/members");
}
